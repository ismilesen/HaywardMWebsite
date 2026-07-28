(() => {
  "use strict";

  const DATA_URL = "./data/prayer-times.json";
  const TIMEZONE = "America/Los_Angeles";
  const ORDER = ["Fajr", "Sunrise", "Dhuhr", "Asr", "Maghrib", "Isha"];
  const ICONS = { Fajr: "◐", Sunrise: "☼", Dhuhr: "◉", Asr: "◒", Maghrib: "◑", Isha: "☾" };
  let schedule;

  function localNow() {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: TIMEZONE,
      year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", second: "2-digit",
      hour12: false
    }).formatToParts(new Date());
    const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
    return {
      year: Number(values.year), month: Number(values.month), day: Number(values.day),
      hour: Number(values.hour), minute: Number(values.minute), second: Number(values.second)
    };
  }

  function todayISO() {
    const now = localNow();
    return `${now.year}-${String(now.month).padStart(2, "0")}-${String(now.day).padStart(2, "0")}`;
  }

  function toMinutes(value) {
    if (!value) return null;
    const match = value.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
    if (!match) return null;
    let hour = Number(match[1]);
    const minute = Number(match[2]);
    const period = match[3].toUpperCase();
    if (period === "AM" && hour === 12) hour = 0;
    if (period === "PM" && hour !== 12) hour += 12;
    return hour * 60 + minute;
  }

  function validate(data) {
    for (const prayer of ORDER) {
      const item = data?.prayers?.[prayer];
      if (!item || toMinutes(item.adhan) === null) throw new Error(`Invalid ${prayer} adhan time`);
      if (prayer !== "Sunrise" && toMinutes(item.iqamah) === null) throw new Error(`Invalid ${prayer} iqamah time`);
    }
    return data;
  }

  function renderPrayers() {
    const list = document.getElementById("prayer-list");
    list.innerHTML = "";
    for (const prayer of ORDER) {
      const item = schedule.prayers[prayer];
      const row = document.createElement("div");
      row.className = "prayer-row";
      row.dataset.prayer = prayer;
      row.innerHTML = `
        <div class="prayer-name">
          <span class="prayer-name-icon" aria-hidden="true">${ICONS[prayer]}</span>
          <strong>${prayer}</strong>
        </div>
        <div class="prayer-time-cell"><span>Adhan</span>${item.adhan}</div>
        <div class="prayer-time-cell"><span>Iqamah</span>${item.iqamah || "—"}</div>`;
      list.appendChild(row);
    }
  }

  function renderJummah() {
    const list = document.getElementById("jummah-list");
    const services = schedule.jummah || [];
    list.innerHTML = services.length
      ? services.map((service) => `
          <div class="jummah-row">
            <div><span>${service.label}</span><small>${service.description || "Khutbah and prayer"}</small></div>
            <strong>${service.time}</strong>
          </div>`).join("")
      : `<div class="jummah-row"><div><span>Schedule unavailable</span></div></div>`;
  }

  function nextPrayer() {
    const now = localNow();
    const current = now.hour * 60 + now.minute + now.second / 60;
    for (const prayer of ["Fajr", "Dhuhr", "Asr", "Maghrib", "Isha"]) {
      const minutes = toMinutes(schedule.prayers[prayer].adhan);
      if (minutes > current) return { prayer, minutes, tomorrow: false };
    }
    return { prayer: "Fajr", minutes: toMinutes(schedule.prayers.Fajr.adhan), tomorrow: true };
  }

  function updateCountdown() {
    const next = nextPrayer();
    const now = localNow();
    const currentSeconds = now.hour * 3600 + now.minute * 60 + now.second;
    let targetSeconds = next.minutes * 60;
    if (next.tomorrow) targetSeconds += 86400;
    const remaining = Math.max(0, targetSeconds - currentSeconds);
    const hours = Math.floor(remaining / 3600);
    const minutes = Math.floor((remaining % 3600) / 60);
    const seconds = remaining % 60;
    const item = schedule.prayers[next.prayer];

    document.getElementById("next-prayer-name").textContent = next.tomorrow ? `${next.prayer} Tomorrow` : next.prayer;
    document.getElementById("next-prayer-adhan").textContent = item.adhan;
    document.getElementById("next-prayer-iqamah").textContent = item.iqamah || "—";
    document.getElementById("next-prayer-countdown").textContent =
      `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;

    document.querySelectorAll(".prayer-row").forEach((row) => {
      row.classList.toggle("is-next", !next.tomorrow && row.dataset.prayer === next.prayer);
    });
  }

  function status(type, text) {
    const dot = document.getElementById("api-status-dot");
    dot.classList.remove("is-live", "is-error");
    dot.classList.add(type === "live" ? "is-live" : "is-error");
    document.getElementById("api-status-text").textContent = text;
  }

  async function start() {
    try {
      const response = await fetch(`${DATA_URL}?v=${Date.now()}`, { cache: "no-store" });
      if (!response.ok) throw new Error(`Request failed: ${response.status}`);
      schedule = validate(await response.json());
      renderPrayers();
      renderJummah();
      document.getElementById("date-line").textContent = [schedule.date, schedule.hijriDate].filter(Boolean).join(" • ");
      updateCountdown();
      setInterval(updateCountdown, 1000);
      const stale = schedule.dateISO !== todayISO();
      status(stale ? "error" : "live", stale ? `Showing the latest saved schedule for ${schedule.date}` : "Official schedule from MosquePrayerTimes");
    } catch (error) {
      console.error(error);
      document.getElementById("prayer-list").innerHTML = `<div class="loading-row">The official prayer schedule could not be loaded.</div>`;
      document.getElementById("next-prayer-name").textContent = "Unavailable";
      document.getElementById("next-prayer-adhan").textContent = "—";
      document.getElementById("next-prayer-iqamah").textContent = "—";
      document.getElementById("next-prayer-countdown").textContent = "—";
      document.getElementById("date-line").textContent = "Schedule temporarily unavailable";
      status("error", "Official prayer schedule unavailable");
    }
  }

  window.addEventListener("DOMContentLoaded", start);
})();
