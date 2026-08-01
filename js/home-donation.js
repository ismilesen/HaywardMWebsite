(() => {
  "use strict";

  const FALLBACK = { raised: 30168‎, goal: 50000 };
  const money = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0
  });

  async function loadDonationProgress() {
    let data = FALLBACK;
    try {
      const response = await fetch("data/donation.json", { cache: "no-store" });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      data = { ...FALLBACK, ...(await response.json()) };
    } catch (error) {
      console.warn("Using fallback donation progress.", error);
    }

    const raised = Number(data.raised);
    const goal = Number(data.goal);
    const percent = goal > 0 ? Math.max(0, Math.min(100, (raised / goal) * 100)) : 0;

    document.querySelectorAll("[data-home-raised]").forEach((el) => {
      el.textContent = money.format(raised);
    });
    document.querySelectorAll("[data-home-goal]").forEach((el) => {
      el.textContent = money.format(goal);
    });
    document.querySelectorAll("[data-home-percent]").forEach((el) => {
      el.textContent = `${Math.round(percent)}%`;
    });
    document.querySelectorAll("[data-home-progress]").forEach((el) => {
      el.style.setProperty("--progress", `${percent}%`);
      el.setAttribute("aria-valuenow", Math.round(percent).toString());
    });
  }

  function handleFloatingButton() {
    const button = document.querySelector(".floating-donate");
    if (!button) return;

    const update = () => button.classList.toggle("is-visible", window.scrollY > 320);
    update();
    window.addEventListener("scroll", update, { passive: true });
  }

  loadDonationProgress();
  handleFloatingButton();
})();
