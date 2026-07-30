(() => {
  "use strict";

  const FALLBACK = {
    campaignTitle: "Help Build Masjid As-Salafi",
    raised: 29868,
    goal: 50000,
    launchGoodUrl: "https://www.launchgood.com/v4/campaign/the_salafi_masjid?src=6867116",
    zeffyUrl: "https://www.zeffy.com/fundraising/help-build-a-salafi-masjid-in-the-bay-area",
    zelle: "thesalafimasjid@gmail.com",
    paypal: "thesalafimasjid@gmail.com"
  };

  const money = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0
  });

  function safePercent(raised, goal) {
    if (!Number.isFinite(raised) || !Number.isFinite(goal) || goal <= 0) return 0;
    return Math.max(0, Math.min(100, (raised / goal) * 100));
  }

  async function getCampaign() {
    try {
      const response = await fetch("data/donation.json", { cache: "no-store" });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      return { ...FALLBACK, ...data };
    } catch (error) {
      console.warn("Donation data could not be loaded; using built-in values.", error);
      return FALLBACK;
    }
  }

  function setText(selector, value) {
    document.querySelectorAll(selector).forEach((element) => {
      element.textContent = value;
    });
  }

  function populateCampaign(data) {
    const raised = Number(data.raised);
    const goal = Number(data.goal);
    const percent = safePercent(raised, goal);

    setText("[data-campaign-title]", data.campaignTitle);
    setText("[data-raised]", money.format(raised));
    setText("[data-goal]", money.format(goal));
    setText("[data-percent]", `${Math.round(percent)}%`);

    document.querySelectorAll("[data-progress-fill]").forEach((bar) => {
      bar.style.setProperty("--progress", `${percent}%`);
      bar.setAttribute("aria-valuenow", Math.round(percent).toString());
    });

    document.querySelectorAll("[data-launchgood]").forEach((link) => {
      link.href = data.launchGoodUrl;
    });
    document.querySelectorAll("[data-zeffy]").forEach((link) => {
      link.href = data.zeffyUrl;
    });
    document.querySelectorAll("[data-zelle-value]").forEach((element) => {
      element.textContent = data.zelle;
    });
    document.querySelectorAll("[data-paypal-value]").forEach((element) => {
      element.textContent = data.paypal;
    });
  }

  async function copyValue(button) {
    const value = button.dataset.copyValue;
    const source = value === "zelle"
      ? document.querySelector("[data-zelle-value]")
      : document.querySelector("[data-paypal-value]");

    if (!source) return;

    const original = button.textContent;
    try {
      await navigator.clipboard.writeText(source.textContent.trim());
      button.textContent = "Copied!";
      button.classList.add("is-copied");
    } catch {
      const range = document.createRange();
      range.selectNodeContents(source);
      const selection = window.getSelection();
      selection.removeAllRanges();
      selection.addRange(range);
      button.textContent = "Select & copy";
    }

    window.setTimeout(() => {
      button.textContent = original;
      button.classList.remove("is-copied");
    }, 2200);
  }

  document.addEventListener("click", (event) => {
    const copyButton = event.target.closest("[data-copy-value]");
    if (copyButton) copyValue(copyButton);
  });

  getCampaign().then(populateCampaign);
})();
