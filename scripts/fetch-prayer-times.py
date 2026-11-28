#!/usr/bin/env python3
#!/usr/bin/env python3
from __future__ import annotations

import json
import re
import sys
from datetime import datetime, timedelta
from pathlib import Path
from zoneinfo import ZoneInfo

import requests

SOURCE_URL = (
    "https://mawaqit.net/en/"
    "masjid-as-salafi-hayward-94544-united-states"
)
OUTPUT = Path("data/prayer-times.json")
TZ = ZoneInfo("America/Los_Angeles")

ORDER = ("Fajr", "Sunrise", "Dhuhr", "Asr", "Maghrib", "Isha")


def extract_config(html):
    match = re.search(r"\b(?:let|const|var)\s+confData\s*=\s*", html)
    if not match:
        raise ValueError("Mawaqit schedule data was not found.")

    # Decode just the JSON object, ignoring the JavaScript after it.
    config, _ = json.JSONDecoder().raw_decode(html[match.end():])
    if not isinstance(config, dict):
        raise ValueError("Unexpected Mawaqit data format.")
    return config


def calendar_row(config, key, day, expected_length):
    calendar = config.get(key)
    if not isinstance(calendar, list) or len(calendar) != 12:
        raise ValueError(f"Missing or invalid {key}.")

    month = calendar[day.month - 1]
    if not isinstance(month, dict):
        raise ValueError(f"Invalid month in {key}.")

    row = month.get(str(day.day))
    if not isinstance(row, list) or len(row) != expected_length:
        raise ValueError(f"Invalid {key} entry for {day.isoformat()}.")
    return row


def parse_clock(value):
    if not isinstance(value, str):
        raise ValueError(f"Invalid time: {value!r}")

    value = value.strip()
    if not re.fullmatch(r"\d{1,2}:\d{2}", value):
        raise ValueError(f"Invalid time: {value!r}")

    return datetime.strptime(value, "%H:%M")


def display_time(clock):
    return clock.strftime("%I:%M %p").lstrip("0")


def resolve_iqamah(value, adhan):
    if isinstance(value, str):
        value = value.strip()
        if re.fullmatch(r"\+\d+", value):
            return display_time(
                parse_clock(adhan) + timedelta(minutes=int(value[1:]))
            )

    return display_time(parse_clock(value))


def main():
    try:
        response = requests.get(
            SOURCE_URL,
            timeout=30,
            headers={"User-Agent": "MasjidAsSalafiPrayerUpdater/1.0"},
        )
        response.raise_for_status()
        config = extract_config(response.text)

        if config.get("timezone") != str(TZ):
            raise ValueError("Unexpected mosque timezone.")

        if config.get("displayingSabahImsak"):
            raise ValueError("The mosque's prayer layout has changed.")

        now = datetime.now(TZ)
        today = now.date()

        # Select the Hayward date explicitly instead of using "times",
        # which may reflect a different server date.
        adhan = calendar_row(config, "calendar", today, 6)
        iqamah = calendar_row(config, "iqamaCalendar", today, 5)

        prayers = {}
        iqamah_index = 0

        for index, prayer in enumerate(ORDER):
            prayers[prayer] = {
                "adhan": display_time(parse_clock(adhan[index])),
                "iqamah": None,
            }

            if prayer != "Sunrise":
                prayers[prayer]["iqamah"] = resolve_iqamah(
                    iqamah[iqamah_index], adhan[index]
                )
                iqamah_index += 1

        jummah = []
        for key in ("jumua", "jumua2", "jumua3"):
            value = config.get(key)
            if value:
                number = len(jummah) + 1
                jummah.append({
                    "label": "Jumu'ah" if number == 1 else f"Jumu'ah {number}",
                    "description": "Khutbah and prayer",
                    "time": display_time(parse_clock(value)),
                })

        payload = {
            "source": {
                "name": "Mawaqit",
                "url": SOURCE_URL,
                "masjidId": "masjid-as-salafi-hayward-94544-united-states",
            },
            "date": now.strftime("%A, %B %d, %Y").replace(" 0", " "),
            "dateISO": today.isoformat(),
            "hijriDate": "",
            "timezone": str(TZ),
            "updatedAt": now.isoformat(timespec="seconds"),
            "prayers": prayers,
            "jummah": jummah,
        }

        OUTPUT.parent.mkdir(parents=True, exist_ok=True)
        temporary = OUTPUT.with_suffix(".json.tmp")
        temporary.write_text(
            json.dumps(payload, indent=2) + "\n",
            encoding="utf-8",
        )
        temporary.replace(OUTPUT)
        print(f"Updated {OUTPUT} for {today} using Mawaqit")
        return 0

    except Exception as error:
        print(f"Prayer schedule update failed: {error}", file=sys.stderr)
        print("The existing JSON schedule was preserved.", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
