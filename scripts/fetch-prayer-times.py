#!/usr/bin/env python3
from __future__ import annotations

import json
import re
import sys
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

import requests
from bs4 import BeautifulSoup

SOURCE_URL = "https://mosqueprayertimes.com/widget/Salafimasjid/1/0"
OUTPUT = Path("data/prayer-times.json")
TZ = ZoneInfo("America/Los_Angeles")

NAME_MAP = {
    "fajr": "Fajr", "shurooq": "Sunrise", "shuruq": "Sunrise",
    "sunrise": "Sunrise", "zuhr": "Dhuhr", "dhuhr": "Dhuhr",
    "asr": "Asr", "maghrib": "Maghrib", "isha": "Isha",
    "jum'ah": "Jumu'ah", "jumah": "Jumu'ah",
    "jumu'ah": "Jumu'ah", "jumuah": "Jumu'ah",
}
REQUIRED = ("Fajr", "Sunrise", "Dhuhr", "Asr", "Maghrib", "Isha")
DATE_RE = re.compile(r"^(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday),\s+[A-Za-z]+\s+\d{1,2},\s+\d{4}$")
TIME_RE = re.compile(r"^\d{1,2}:\d{2}(?:\s*[AP]M)?$", re.I)
HIJRI_RE = re.compile(r"^[A-Za-z' -]+\s+\d{1,2},\s+1\d{3}$")


def clean(value: str) -> str:
    return " ".join(value.replace("\xa0", " ").split()).strip()


def normalize_name(value: str):
    return NAME_MAP.get(clean(value).lower().replace("’", "'"))


def add_period(prayer: str, value: str) -> str:
    value = clean(value).upper()
    if re.search(r"\b(?:AM|PM)$", value):
        return value
    return f"{value} {'AM' if prayer in {'Fajr', 'Sunrise'} else 'PM'}"


def find_container(date_node):
    candidate = date_node.parent
    for _ in range(8):
        if candidate is None:
            break
        text = clean(candidate.get_text(" ", strip=True)).lower()
        if "fajr" in text and "isha" in text and ("jum'ah" in text or "jumah" in text):
            return candidate
        candidate = candidate.parent
    raise ValueError("Could not isolate a complete daily schedule.")


def extract_rows(container):
    rows = {}
    for tr in container.find_all("tr"):
        cells = [clean(cell.get_text(" ", strip=True)) for cell in tr.find_all(["th", "td"])]
        if not cells:
            continue
        prayer = normalize_name(cells[0])
        if not prayer:
            continue
        times = [item for item in cells[1:] if TIME_RE.match(item)]
        if times:
            rows[prayer] = times[:2]
    return rows


def main() -> int:
    try:
        response = requests.get(SOURCE_URL, timeout=30, headers={"User-Agent": "MasjidAsSunnahPrayerUpdater/1.0"})
        response.raise_for_status()
        soup = BeautifulSoup(response.text, "html.parser")

        date_nodes = [node for node in soup.find_all(string=True) if DATE_RE.match(clean(str(node)))]
        if not date_nodes:
            raise ValueError("No dated schedule was found.")

        today = datetime.now(TZ).strftime("%A, %B %d, %Y").replace(" 0", " ")
        selected = next((node for node in date_nodes if clean(str(node)) == today), date_nodes[0])
        container = find_container(selected)
        rows = extract_rows(container)

        for prayer in REQUIRED:
            if prayer not in rows:
                raise ValueError(f"Missing required prayer: {prayer}")

        prayers = {}
        for prayer in REQUIRED:
            values = rows[prayer]
            prayers[prayer] = {
                "adhan": add_period(prayer, values[0]),
                "iqamah": None if prayer == "Sunrise" else (add_period(prayer, values[1]) if len(values) > 1 else None),
            }

        for prayer in ("Fajr", "Dhuhr", "Asr", "Maghrib", "Isha"):
            if not prayers[prayer]["iqamah"]:
                raise ValueError(f"Missing iqamah time for {prayer}")

        lines = [clean(line) for line in container.get_text("\n", strip=True).splitlines()]
        hijri = next((line for line in lines if HIJRI_RE.match(line)), "")
        date_text = clean(str(selected))
        date_iso = datetime.strptime(date_text, "%A, %B %d, %Y").strftime("%Y-%m-%d")

        jummah = []
        if rows.get("Jumu'ah"):
            jummah.append({"label": "Jumu'ah", "description": "Khutbah and prayer", "time": add_period("Jumu'ah", rows["Jumu'ah"][0])})

        payload = {
            "source": {"name": "MosquePrayerTimes", "url": SOURCE_URL, "masjidId": "Salafimasjid"},
            "date": date_text,
            "dateISO": date_iso,
            "hijriDate": hijri,
            "timezone": str(TZ),
            "updatedAt": datetime.now(TZ).isoformat(timespec="seconds"),
            "prayers": prayers,
            "jummah": jummah,
        }

        OUTPUT.parent.mkdir(parents=True, exist_ok=True)
        temporary = OUTPUT.with_suffix(".json.tmp")
        temporary.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
        temporary.replace(OUTPUT)
        print(f"Updated {OUTPUT} for {date_text}")
        return 0

    except Exception as error:
        print(f"Prayer schedule update failed: {error}", file=sys.stderr)
        print("The existing JSON schedule was preserved.", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
