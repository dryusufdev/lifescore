const navToggle = document.querySelector(".nav-toggle");
const navLinks = document.querySelector(".nav-links");

if (navLinks && !navLinks.querySelector(".nav-about-link")) {
  const aboutLink = document.createElement("a");
  aboutLink.className = "nav-about-link";
  aboutLink.href = "about.html";
  aboutLink.textContent = "About";
  if (document.body.classList.contains("about-page")) aboutLink.setAttribute("aria-current", "page");
  navLinks.append(aboutLink);
}

const creditMenu = [...document.querySelectorAll(".nav-group")].find((group) =>
  group.querySelector(".nav-parent")?.textContent.trim() === "Credit"
)?.querySelector(".nav-menu");

if (creditMenu && !creditMenu.querySelector('a[href="credit-score.html"]')) {
  const creditScoreLink = document.createElement("a");
  creditScoreLink.href = "credit-score.html";
  creditScoreLink.textContent = "Credit Score";
  if (document.body.classList.contains("credit-score-page")) creditScoreLink.setAttribute("aria-current", "page");
  const travelLink = creditMenu.querySelector('a[href="travel-cards.html"]');
  creditMenu.insertBefore(creditScoreLink, travelLink);
}

navToggle?.addEventListener("click", () => {
  const isOpen = navLinks.classList.toggle("is-open");
  navToggle.setAttribute("aria-expanded", String(isOpen));
  navToggle.setAttribute("aria-label", isOpen ? "Close navigation" : "Open navigation");
});

navLinks?.addEventListener("click", (event) => {
  if (event.target instanceof HTMLAnchorElement) {
    navLinks.classList.remove("is-open");
    navToggle?.setAttribute("aria-expanded", "false");
  }
});

const formatMoney = (value) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);

function getNewYorkDateKey(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function shiftIsoDate(dateKey, dayOffset) {
  const [year, month, day] = dateKey.split("-").map(Number);
  const utcDate = new Date(Date.UTC(year, month - 1, day + dayOffset));
  return utcDate.toISOString().slice(0, 10);
}

function getCurrentFridayKey(date = new Date()) {
  const todayKey = getNewYorkDateKey(date);
  const [year, month, day] = todayKey.split("-").map(Number);
  const dayOfWeek = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  const daysSinceFriday = (dayOfWeek + 2) % 7;
  return shiftIsoDate(todayKey, -daysSinceFriday);
}

function selectWeeklyTip(tips, date = new Date()) {
  if (!Array.isArray(tips)) return null;
  const todayKey = getNewYorkDateKey(date);
  return tips
    .filter((tip) => tip?.status === "published" && tip.publishDate && tip.publishDate <= todayKey)
    .sort((a, b) => String(b.publishDate).localeCompare(String(a.publishDate)) || String(b.id).localeCompare(String(a.id)))[0] || null;
}

async function hydrateWeeklyTip(options = {}) {
  const card = document.querySelector("[data-weekly-tip]");
  if (!card) return null;

  const titleEl = card.querySelector("[data-weekly-tip-title]");
  const bodyEl = card.querySelector("[data-weekly-tip-body]");
  const ctaEl = card.querySelector("[data-weekly-tip-cta]");
  const now = options.now instanceof Date ? options.now : new Date();
  const weekKey = getCurrentFridayKey(now);

  try {
    const response = await fetch(`data/weekly-tips.json?v=${encodeURIComponent(weekKey)}`, { cache: "no-store" });
    if (!response.ok) throw new Error(`Weekly tips request failed with ${response.status}`);
    const tips = await response.json();
    const tip = selectWeeklyTip(tips, now);
    if (!tip) return null;

    if (titleEl && tip.title) titleEl.textContent = tip.title;
    if (bodyEl && tip.body) bodyEl.textContent = tip.body;

    if (ctaEl) {
      const prompt = String(tip.scorePrompt || "").trim();
      const ctaText = String(tip.ctaText || "").trim();
      if (prompt && ctaText) {
        ctaEl.textContent = ctaText;
        ctaEl.hidden = false;
        ctaEl.setAttribute("data-score-open", "");
        ctaEl.dataset.scoreMessage = prompt;
      } else {
        ctaEl.hidden = true;
        ctaEl.removeAttribute("data-score-open");
        delete ctaEl.dataset.scoreMessage;
      }
    }

    card.dataset.weeklyTipId = tip.id || "";
    card.dataset.weeklyTipCategory = tip.category || "";
    return tip;
  } catch (error) {
    console.warn("[LifeScore] Weekly tip fallback kept.", error);
    return null;
  }
}

const studentLimitButtons = document.querySelectorAll("[data-limit-option]");

function updateStudentCreditLimit(limit) {
  const clean = limit * 0.1;
  const high = limit * 0.3;
  const maxed = limit * 0.9;
  document.querySelectorAll("[data-student-limit]").forEach((node) => {
    node.textContent = formatMoney(limit);
  });
  document.querySelectorAll("[data-clean-usage]").forEach((node) => {
    node.textContent = formatMoney(clean);
  });
  document.querySelectorAll("[data-high-usage]").forEach((node) => {
    node.textContent = formatMoney(high);
  });
  document.querySelectorAll("[data-max-usage]").forEach((node) => {
    node.textContent = formatMoney(maxed);
  });
  document.querySelectorAll("[data-utilization-note]").forEach((node) => {
    node.textContent = `With a ${formatMoney(limit)} limit, about ${formatMoney(clean)} reported is cleaner than ${formatMoney(maxed - clean)}.`;
  });
  studentLimitButtons.forEach((button) => {
    button.classList.toggle("is-active", Number(button.dataset.limitOption) === limit);
  });
}

studentLimitButtons.forEach((button) => {
  button.addEventListener("click", () => updateStudentCreditLimit(Number(button.dataset.limitOption || 500)));
});

if (studentLimitButtons.length) updateStudentCreditLimit(500);

const homeRange = document.querySelector("[data-calc-range]");
const homeDeposit = document.querySelector("[data-calc-deposit]");
const regularEarnings = document.querySelector("[data-regular-earnings]");
const highEarnings = document.querySelector("[data-high-earnings]");

function updateHomeCalc() {
  if (!homeRange) return;
  const deposit = Number(homeRange.value);
  homeDeposit.textContent = formatMoney(deposit);
  regularEarnings.textContent = formatMoney(deposit * 0.004);
  highEarnings.textContent = formatMoney(deposit * 0.04);
}

homeRange?.addEventListener("input", updateHomeCalc);
updateHomeCalc();

const hysaAccounts = [
  { name: "SoFi Checking and Savings", apy: 4.0, min: 0, promoted: true, note: "Up to 4.00% APY snapshot with qualifying terms to verify.", lane: "Online bundle", simplicity: 8, access: 9 },
  { name: "Barclays Tiered Savings Account", apy: 3.65, min: 0, promoted: true, note: "$200 bonus example from your provided research; terms apply.", lane: "Bonus watcher", simplicity: 7, access: 7 },
  { name: "Marcus by Goldman Sachs Online Savings Account", apy: 3.5, min: 0, promoted: true, pick: true, note: "3.50% APY snapshot, no monthly fees, no minimum balance to earn APY, Member FDIC. Marcus does not offer a checking account.", lane: "Strong rate track record", simplicity: 9, access: 8 },
  { name: "American Express High Yield Savings", apy: 3.1, min: 0, promoted: true, note: "3.10% APY snapshot as of the provided May 2026 research; verify current terms.", lane: "Simple parked cash", simplicity: 9, access: 8 },
  { name: "Capital One 360 Performance Savings", apy: 3.1, min: 0, promoted: true, note: "3.10% APY snapshot, no monthly fees, no minimum balance, Member FDIC.", lane: "No-fee parked cash", simplicity: 9, access: 9 },
];

const hysaList = document.querySelector("[data-hysa-list]");
const hysaDeposit = document.querySelector("[data-hysa-deposit]");
const hysaFilter = document.querySelector("[data-hysa-filter]");
const hysaSort = document.querySelector("[data-hysa-sort]");
let sortHighToLow = true;

function renderHysa() {
  if (!hysaList) return;
  const deposit = Number(hysaDeposit?.value || 20000);
  const filter = hysaFilter?.value || "all";
  const accounts = [...hysaAccounts]
    .filter((account) => {
      if (filter === "no-min") return account.min === 0;
      if (filter === "boost") return account.promoted;
      return true;
    })
    .sort((a, b) => {
      const pickSort = Number(Boolean(b.pick)) - Number(Boolean(a.pick));
      if (pickSort) return pickSort;
      return sortHighToLow ? b.apy - a.apy : a.apy - b.apy;
    });

  hysaList.innerHTML = accounts
    .map((account, index) => {
      const earnings = deposit * (account.apy / 100);
      return `
        <article class="offer-card ${account.pick ? "is-pick" : ""}" style="--offer-index: ${index}">
          <div>
            <span class="offer-kind">Savings - Member FDIC</span>
            ${account.pick ? `<span class="pick-emblem"><i aria-hidden="true"></i><b>LifeScore pick</b></span>` : ""}
            <h3>${account.name}</h3>
            <p>${account.note}</p>
          </div>
          <div class="metric"><span>APY snapshot</span><strong>${account.apy.toFixed(2)}%</strong></div>
          <div class="metric"><span>Min. deposit</span><strong>${formatMoney(account.min)}</strong></div>
          <div class="metric"><span>Est. earnings on ${formatMoney(deposit)}</span><strong>${formatMoney(earnings)}</strong></div>
          <div class="metric"><span>Best lane</span><strong>${account.lane}</strong></div>
          <div class="metric"><span>LifeScore</span><strong>${account.simplicity}/10 simple</strong></div>
        </article>
      `;
    })
    .join("");
}

hysaDeposit?.addEventListener("input", renderHysa);
hysaFilter?.addEventListener("change", renderHysa);
hysaSort?.addEventListener("click", () => {
  sortHighToLow = !sortHighToLow;
  hysaSort.textContent = sortHighToLow ? "Sort by APY" : "Sort low to high";
  renderHysa();
});
renderHysa();

const allocationModule = document.querySelector("[data-allocation-module]");

if (allocationModule) {
  const allocationBars = allocationModule.querySelector(".allocation-bars");
  const allocationTitle = allocationModule.querySelector("[data-allocation-title]");
  const allocationNote = allocationModule.querySelector("[data-allocation-note]");
  const usMarket = allocationModule.querySelector("[data-us-market]");
  const intlMarket = allocationModule.querySelector("[data-intl-market]");
  const vtiPercent = allocationModule.querySelector("[data-vti-percent]");
  const vxusPercent = allocationModule.querySelector("[data-vxus-percent]");
  const allocationButtons = allocationModule.querySelectorAll("[data-vti][data-vxus]");

  allocationButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const vti = Number(button.dataset.vti || 0);
      const vxus = Number(button.dataset.vxus || 0);
      allocationBars?.style.setProperty("--vti", `${vti}%`);
      allocationBars?.style.setProperty("--vxus", `${vxus}%`);
      allocationModule.style.setProperty("--vti", `${vti}%`);
      allocationModule.style.setProperty("--vxus", `${vxus}%`);
      if (allocationTitle) allocationTitle.textContent = vxus === 0 ? "U.S. market core" : "Starter global mix";
      if (allocationNote) allocationNote.textContent = button.dataset.note || "";
      if (usMarket) usMarket.textContent = `${vti}%`;
      if (intlMarket) intlMarket.textContent = `${vxus}%`;
      if (vtiPercent) vtiPercent.textContent = `${vti}%`;
      if (vxusPercent) vxusPercent.textContent = `${vxus}%`;
      allocationButtons.forEach((option) => option.classList.toggle("is-active", option === button));
    });
  });
}

const growthModule = document.querySelector("[data-growth-module]");

if (growthModule) {
  const monthlyContribution = Number(growthModule.dataset.monthly || 250);
  const annualReturn = Number(growthModule.dataset.return || 0.07);
  const growthLine = growthModule.querySelector("[data-growth-line]");
  const growthEnd = growthModule.querySelector("[data-growth-end]");
  const growthValue = growthModule.querySelector("[data-growth-value]");
  const growthHorizon = growthModule.querySelector("[data-growth-horizon]");
  const growthButtons = growthModule.querySelectorAll("[data-growth-years]");
  const chart = { left: 24, right: 396, top: 28, bottom: 132 };

  function projectedRothValue(years) {
    const months = years * 12;
    const monthlyRate = annualReturn / 12;
    return monthlyContribution * ((Math.pow(1 + monthlyRate, months) - 1) / monthlyRate);
  }

  function growthPoints(years) {
    const months = years * 12;
    const maxValue = projectedRothValue(years);
    const steps = Math.min(36, Math.max(10, years * 2));
    return Array.from({ length: steps + 1 }, (_, index) => {
      const month = Math.round((months / steps) * index);
      const value = month === 0 ? 0 : monthlyContribution * ((Math.pow(1 + annualReturn / 12, month) - 1) / (annualReturn / 12));
      const x = chart.left + ((chart.right - chart.left) * index) / steps;
      const y = chart.bottom - ((chart.bottom - chart.top) * value) / maxValue;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(" ");
  }

  function updateGrowth(years) {
    const endingValue = projectedRothValue(years);
    const roundedValue = Math.round(endingValue / 100) * 100;
    if (growthLine) growthLine.setAttribute("points", growthPoints(years));
    if (growthEnd) {
      growthEnd.setAttribute("cx", chart.right);
      growthEnd.setAttribute("cy", chart.top);
    }
    if (growthValue) growthValue.textContent = formatMoney(roundedValue);
    if (growthHorizon) growthHorizon.textContent = `${years}Y`;
    growthButtons.forEach((button) => {
      button.classList.toggle("is-active", Number(button.dataset.growthYears) === years);
    });
  }

  growthButtons.forEach((button) => {
    button.addEventListener("click", () => updateGrowth(Number(button.dataset.growthYears || 10)));
  });

  updateGrowth(10);
}

const hysaCalculator = document.querySelector("[data-hysa-calculator]");

function compoundSavings(principal, monthly, years, apy) {
  const months = years * 12;
  const monthlyRate = apy / 100 / 12;
  let balance = principal;
  for (let month = 0; month < months; month += 1) {
    balance += monthly;
    balance *= 1 + monthlyRate;
  }
  const contributed = principal + monthly * months;
  return { balance, interest: balance - contributed };
}

function updateHysaCalculator() {
  if (!hysaCalculator) return;
  const principal = Number(hysaCalculator.querySelector("[data-hysa-principal]").value || 0);
  const monthly = Number(hysaCalculator.querySelector("[data-hysa-monthly]").value || 0);
  const years = Number(hysaCalculator.querySelector("[data-hysa-years]").value || 1);
  const rate = Number(hysaCalculator.querySelector("[data-hysa-rate]").value || 0);
  const dropRate = Number(hysaCalculator.querySelector("[data-hysa-drop-rate]").value || 0);
  const taxRate = Number(hysaCalculator.querySelector("[data-hysa-tax]").value || 0);
  const normal = compoundSavings(principal, monthly, years, rate);
  const dropped = compoundSavings(principal, monthly, years, dropRate);
  const afterTaxInterest = normal.interest * (1 - taxRate / 100);

  hysaCalculator.querySelector("[data-hysa-balance]").textContent = formatMoney(normal.balance);
  hysaCalculator.querySelector("[data-hysa-interest]").textContent = formatMoney(normal.interest);
  hysaCalculator.querySelector("[data-hysa-drop]").textContent = formatMoney(dropped.balance);
  hysaCalculator.querySelector("[data-hysa-after-tax]").textContent = formatMoney(afterTaxInterest);
}

hysaCalculator?.addEventListener("input", updateHysaCalculator);
updateHysaCalculator();

document.querySelectorAll(".accordion").forEach((button) => {
  button.addEventListener("click", () => button.classList.toggle("is-open"));
});

const quiz = document.querySelector("[data-card-quiz]");
const quizResult = document.querySelector("[data-card-result]");

quiz?.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-result]");
  if (!button) return;
  quiz.querySelectorAll("button").forEach((option) => option.classList.remove("is-active"));
  button.classList.add("is-active");
  quizResult.textContent = `Start with a ${button.dataset.result}. Then compare fees, interest, rewards, and approval requirements.`;
});

const cardForm = document.querySelector("[data-card-form]");

cardForm?.addEventListener("submit", (event) => {
  event.preventDefault();
  const paysFull = cardForm.querySelector("[data-card-payfull]").value;
  const spend = cardForm.querySelector("[data-card-spend]").value;
  const travels = cardForm.querySelector("[data-card-travel]").value;
  const fee = cardForm.querySelector("[data-card-fee]").value;
  let result = "";

  if (paysFull === "no") {
    result = "Your lane: payoff-first card. Focus on APR, balance transfer terms, and debt payoff. Rewards are not the main game while interest is running.";
  } else if (spend === "build") {
    result = "Your lane: student or secured card. Examples to research: Chase Freedom Rise, Capital One Savor Student, or Capital One Platinum Secured.";
  } else if (spend === "travel" || (travels === "yes" && fee !== "no")) {
    result = "Your lane: travel card. Starter examples: Chase Sapphire Preferred or Capital One Venture. Premium examples: Venture X or Amex Platinum if credits and lounges are real for you.";
  } else if (spend === "food") {
    result = "Your lane: food and grocery cash back. Examples to research: Amex Blue Cash Everyday or Capital One Savor.";
  } else {
    result = "Your lane: simple cash-back card. Examples to research: Citi Double Cash, Chase Freedom Unlimited, or Capital One Quicksilver.";
  }

  quizResult.textContent = result;
});

const cardComparison = document.querySelector("[data-card-comparison]");
const cardDetail = document.querySelector("[data-card-detail]");
const cardFilters = document.querySelector("[data-card-filters]");
const compareLeft = document.querySelector("[data-compare-left]");
const compareRight = document.querySelector("[data-compare-right]");
const sideBySide = document.querySelector("[data-card-side-by-side]");

const cardProfiles = [
  {
    name: "Citi Double Cash",
    category: "Cash back",
    fee: "$0",
    lane: "Flat-rate cash back",
    bestFor: "Simple cash back without tracking categories.",
    avoidIf: "You want travel points, lounges, or premium trip benefits.",
    rewards: "2% total cash back: 1% when you buy and 1% when you pay. 5% total cash back on hotels, car rentals, and attractions booked with Citi Travel.",
    bonus: "$200 cash back after $1,500 in purchases in the first 6 months, based on your provided Credit Karma snapshot.",
    travel: "Limited travel-benefit focus.",
    lounge: "Not a lounge card.",
    foreign: "Foreign transaction fee applies; verify current terms.",
    complexity: "Low",
    note: "Good no-thinking cash-back lane if you pay in full and want simple rewards.",
  },
  {
    name: "Wells Fargo Active Cash",
    category: "Cash back",
    fee: "$0",
    lane: "Flat-rate cash back",
    bestFor: "Consistent everyday cash back.",
    avoidIf: "You want transfer partners or airport perks.",
    rewards: "2% cash rewards on purchases.",
    bonus: "$200 cash rewards bonus snapshot; verify current public offer.",
    travel: "Not travel-focused.",
    lounge: "Not a lounge card.",
    foreign: "Foreign transaction fee applies; verify current terms.",
    complexity: "Low",
    note: "A clean flat-rate comparison point against Apple Card's 2% Apple Pay / 1% physical-card split.",
  },
  {
    name: "Chase Freedom Unlimited",
    category: "Cash back",
    fee: "$0",
    lane: "Catch-all cash back",
    bestFor: "No-fee Chase rewards and starter cash back.",
    avoidIf: "You want premium lounge access.",
    rewards: "1.5% cash back on everyday purchases, 5% on travel through Chase Travel, and 3% on dining and drugstores with current terms.",
    bonus: "$200 cash-back snapshot; verify current Chase offer.",
    travel: "Can pair with premium Chase travel cards later.",
    lounge: "Not a lounge card.",
    foreign: "Foreign transaction fee applies; verify current terms.",
    complexity: "Low-medium",
    note: "A strong beginner bridge into the Chase ecosystem.",
  },
  {
    name: "Chase Freedom Flex",
    category: "Cash back",
    fee: "$0",
    lane: "Rotating category cash back",
    bestFor: "Quarterly categories and Chase cash-back users.",
    avoidIf: "You do not want to activate or track rotating categories.",
    rewards: "5% rotating quarterly categories when activated, plus Chase Travel, dining, and drugstore categories with current terms.",
    bonus: "$200 cash-back snapshot; verify current Chase offer.",
    travel: "Can pair with Sapphire cards later.",
    lounge: "Not a lounge card.",
    foreign: "Foreign transaction fee applies; verify current terms.",
    complexity: "Medium",
    note: "A good category card if you will actually track the quarterly calendar.",
  },
  {
    name: "Capital One Quicksilver",
    category: "Cash back",
    fee: "$0",
    lane: "Simple cash back",
    bestFor: "Simple everyday rewards.",
    avoidIf: "You want category maximization or transfer-partner strategy.",
    rewards: "1.5% unlimited cash back on everyday purchases.",
    bonus: "$200 bonus snapshot; verify current Capital One offer.",
    travel: "Light travel value compared with travel cards.",
    lounge: "Not a lounge card.",
    foreign: "No foreign transaction fee.",
    complexity: "Low",
    note: "Easy to understand, which is the whole point for many first cash-back setups.",
  },
  {
    name: "Bank of America Customized Cash Rewards",
    category: "Cash back",
    fee: "$0",
    lane: "Flexible category cash back",
    bestFor: "People who want to choose one main cash-back category.",
    avoidIf: "You want travel transfer partners or premium perks.",
    rewards: "Flexible category cash-back structure with a first-year 6% offer snapshot; verify current Bank of America terms, caps, and categories.",
    bonus: "$200 snapshot; verify current Bank of America offer.",
    travel: "Not travel-focused.",
    lounge: "Not a lounge card.",
    foreign: "Foreign transaction fee applies; verify current terms.",
    complexity: "Medium",
    note: "Useful when your main spend lane is gas, online shopping, dining, travel, drugstores, or home improvement.",
  },
  {
    name: "Amex Blue Cash Everyday",
    category: "Cash back",
    fee: "$0",
    lane: "Category cash back",
    bestFor: "Groceries, gas, and online retail style spending.",
    avoidIf: "You want travel transfer strategy or lounge access.",
    rewards: "3% cash back at U.S. supermarkets, 3% at U.S. gas stations, and 3% on U.S. online retail purchases, with category caps and terms.",
    bonus: "As high as $200 cash back. Find out your offer; verify current Amex terms.",
    travel: "Not travel-focused.",
    lounge: "Not a lounge card.",
    foreign: "Foreign transaction fee applies; verify current terms.",
    complexity: "Medium",
    note: "Useful if your spending matches the categories; less useful if you ignore category caps.",
  },
  {
    name: "Amex Blue Cash Preferred",
    category: "Cash back",
    fee: "$0 intro first year, then $95",
    lane: "Category cash back",
    bestFor: "Groceries, streaming, gas, and transit spending that can justify the annual fee.",
    avoidIf: "You want no annual fee, travel transfer partners, or airport lounge access.",
    rewards: "6% cash back at U.S. supermarkets on up to $6,000 per year in purchases, 6% on select streaming subscriptions, 3% on transit, 3% at U.S. gas stations, and 1% on other eligible purchases, with terms.",
    bonus: "As high as $300 cash back. Find out your offer; verify current Amex terms.",
    travel: "Not travel-focused.",
    lounge: "Not a lounge card.",
    foreign: "Foreign transaction fee applies; verify current terms.",
    complexity: "Medium",
    note: "A stronger grocery and streaming cash-back lane than Blue Cash Everyday, but only if the annual fee is worth it for your real spend.",
  },
  {
    name: "Capital One Savor",
    category: "Cash back",
    fee: "$0",
    lane: "Category cash back",
    bestFor: "Dining, groceries, entertainment, and streaming style spending.",
    avoidIf: "Rewards make you spend extra.",
    rewards: "3% cash back on dining, grocery stores, entertainment, and streaming, with terms.",
    bonus: "Welcome bonus snapshot varies; verify current Capital One offer.",
    travel: "Not a full travel card.",
    lounge: "Not a lounge card.",
    foreign: "No foreign transaction fee.",
    complexity: "Medium",
    note: "Good for people whose real budget already leans food and entertainment.",
  },
  {
    name: "Prime Visa",
    category: "Cash back",
    fee: "$0",
    lane: "Amazon cash back",
    bestFor: "Amazon Prime and Whole Foods shoppers.",
    avoidIf: "You do not use Amazon Prime enough to justify the membership.",
    rewards: "Strong Amazon and Whole Foods earning, plus everyday categories like restaurants, gas, transit, and commuting with current terms.",
    bonus: "Amazon gift-card or instant-bonus style offer may vary; verify current Prime Visa terms.",
    travel: "Not travel-focused.",
    lounge: "Not a lounge card.",
    foreign: "No foreign transaction fee; verify current terms.",
    complexity: "Low-medium",
    note: "Great only if Amazon or Whole Foods already owns a real part of your budget.",
  },
  {
    name: "Apple Card",
    category: "Cash back",
    fee: "$0",
    lane: "Apple Pay cash back",
    bestFor: "iPhone users who use Apple Pay often and want simple no-fee cash back.",
    avoidIf: "You want travel points, transfer partners, airport lounges, a strong welcome bonus, or high rewards when Apple Pay is not accepted.",
    rewards: "3% Daily Cash on Apple purchases and select merchants like Nike and Walgreens with Apple Pay. 2% with Apple Pay. 1% where Apple Pay is not accepted or when using the physical card.",
    bonus: "Welcome bonus area: Apple Card is not known as a big welcome-bonus card; verify current offer.",
    travel: "Not a travel card.",
    lounge: "Not a lounge card.",
    foreign: "No foreign transaction fee.",
    complexity: "Low",
    note: "Clean and simple if your life runs through iPhone and Apple Pay. Not the strongest everyday card if you frequently shop where Apple Pay is not accepted.",
  },
  {
    name: "Discover it Cash Back",
    category: "Cash back",
    fee: "$0",
    lane: "Rotating category cash back",
    bestFor: "Quarterly cash-back categories and Cashback Match.",
    avoidIf: "You do not want to activate categories or wait for first-year match value.",
    rewards: "5% rotating cash-back categories up to the quarterly maximum when activated, plus 1% on other purchases.",
    bonus: "Cashback Match snapshot; Discover matches first-year cash back for new cardmembers with current terms.",
    travel: "Not travel-focused.",
    lounge: "Not a lounge card.",
    foreign: "No foreign transaction fee.",
    complexity: "Medium",
    note: "Strong beginner-friendly category card if you treat categories like a plan, not a shopping excuse.",
  },
  {
    name: "Chase Freedom Rise",
    category: "Student and credit building",
    fee: "$0",
    lane: "Student starter",
    bestFor: "Students and beginners who want a simple Chase starter path.",
    avoidIf: "You want travel points, lounges, premium benefits, or complex bonus categories.",
    rewards: "Unlimited 1.5% cash back on all purchases.",
    bonus: "$25 statement credit after signing up for automatic payments within the first 3 months and staying enrolled for at least 90 days, based on your provided Chase details.",
    travel: "Not travel-focused, but can become a Chase ecosystem starter.",
    lounge: "Not a lounge card.",
    foreign: "Foreign transaction fee applies; verify current terms.",
    complexity: "Low",
    note: "Built for credit building: Chase checking relationship may improve approval odds, and Chase may review for an upgrade after the first year.",
  },
  {
    name: "Capital One Savor Student",
    category: "Student and credit building",
    fee: "$0",
    lane: "Student starter",
    bestFor: "Students spending on dining and entertainment.",
    avoidIf: "Food/fun rewards make you spend more.",
    rewards: "Student dining, grocery, entertainment, and streaming cash-back categories with terms.",
    bonus: "Welcome bonus snapshot varies; verify current Capital One student offer.",
    travel: "Not travel-focused.",
    lounge: "Not a lounge card.",
    foreign: "No foreign transaction fee.",
    complexity: "Low-medium",
    note: "Good student lane when it matches spending you already do.",
  },
  {
    name: "Capital One Platinum Secured",
    category: "Student and credit building",
    fee: "$0",
    lane: "Credit builder",
    bestFor: "Simple secured-card credit building.",
    avoidIf: "You want rewards as the main feature.",
    rewards: "Not reward-focused.",
    bonus: "No major rewards bonus focus; verify current secured-card terms.",
    travel: "Not travel-focused.",
    lounge: "Not a lounge card.",
    foreign: "No foreign transaction fee.",
    complexity: "Low",
    note: "A simple credit-building lane, not a rewards maximizer.",
  },
  {
    name: "Chase Sapphire Preferred",
    category: "Travel",
    fee: "$95",
    lane: "Starter travel",
    bestFor: "Flexible Chase points, transfer partners, and travel value without jumping to a premium annual fee.",
    avoidIf: "You want lounge access as the main benefit.",
    rewards: "5x on Chase Travel, 3x dining, select streaming and online groceries, 2x other travel, 1x other purchases.",
    bonus: "75,000 bonus points snapshot; verify current Chase offer.",
    travel: "Strong starter travel benefits.",
    lounge: "Not a lounge card.",
    foreign: "No foreign transaction fee.",
    complexity: "Medium",
    note: "Best starter flexible travel-card lane for many people learning points.",
  },
  {
    name: "Capital One Venture",
    category: "Travel",
    fee: "$95",
    lane: "Starter travel",
    bestFor: "Simple flexible miles.",
    avoidIf: "You want full premium lounge access.",
    rewards: "2x miles on every purchase; 5x miles on hotels, vacation rentals, and rental cars booked through Capital One Travel.",
    bonus: "75,000 miles after $4,000 in purchases in the first 3 months, based on your provided Credit Karma snapshot.",
    travel: "Good simple travel redemption lane.",
    lounge: "Not a full lounge card.",
    foreign: "No foreign transaction fee.",
    complexity: "Medium",
    note: "Good for people who want miles without learning a complicated points system.",
  },
  {
    name: "Capital One VentureOne",
    category: "Travel",
    fee: "$0",
    lane: "No-fee travel starter",
    bestFor: "Learning travel rewards without an annual fee.",
    avoidIf: "You need premium earning rates or lounge perks.",
    rewards: "1.25x miles on everyday purchases and 5x miles on hotels and rental cars booked through Capital One Travel.",
    bonus: "20,000-mile snapshot from Forbes-style list; NerdWallet also shows a 40,000-mile Miles Boost version. Verify the live offer.",
    travel: "Starter travel benefits.",
    lounge: "Not a lounge card.",
    foreign: "No foreign transaction fee.",
    complexity: "Low-medium",
    note: "No-fee travel starter lane for people testing travel rewards.",
  },
  {
    name: "Bank of America Travel Rewards",
    category: "Travel",
    fee: "$0",
    lane: "No-fee travel starter",
    bestFor: "Simple travel rewards with no annual fee.",
    avoidIf: "You want transfer partners, lounges, or premium trip protections.",
    rewards: "Unlimited travel-points structure with elevated Bank of America Travel Center earning in the provided snapshot.",
    bonus: "25,000-point snapshot; verify current Bank of America offer.",
    travel: "Simple travel redemption lane.",
    lounge: "Not a lounge card.",
    foreign: "No foreign transaction fee.",
    complexity: "Low",
    note: "A low-maintenance travel starter card, not a luxury travel setup.",
  },
  {
    name: "Citi Strata Premier",
    category: "Travel",
    fee: "$95",
    lane: "Everyday points",
    bestFor: "Travel rewards plus everyday category earning.",
    avoidIf: "You want premium lounges as the main value.",
    rewards: "10x on hotels, car rentals, and attractions booked through Citi Travel; 3x on restaurants, supermarkets, gas and EV stations, air travel, and other hotel purchases; 1x other purchases.",
    bonus: "60,000-point snapshot; verify current Citi offer.",
    travel: "Travel and category rewards.",
    lounge: "Not a lounge card.",
    foreign: "No foreign transaction fee.",
    complexity: "Medium",
    note: "Category travel-card lane for people who want earning beyond flights and hotels.",
  },
  {
    name: "Wells Fargo Autograph",
    category: "Travel",
    fee: "$0",
    lane: "No-fee travel starter",
    bestFor: "No-fee everyday travel categories.",
    avoidIf: "You want luxury airport perks.",
    rewards: "3x points on popular everyday categories like restaurants, travel, gas, transit, streaming, and phone plans.",
    bonus: "Welcome bonus snapshot varies; verify current Wells Fargo offer.",
    travel: "Starter travel value.",
    lounge: "Not a lounge card.",
    foreign: "No foreign transaction fee.",
    complexity: "Low-medium",
    note: "No-fee lane for people who want travel-adjacent rewards without premium complexity.",
  },
  {
    name: "Wells Fargo Autograph Journey",
    category: "Travel",
    fee: "$95",
    lane: "Everyday points",
    bestFor: "Direct airline and hotel bookings.",
    avoidIf: "You want lounge access as the core benefit.",
    rewards: "5x hotels, 4x airlines, 3x other travel and restaurants, 1x other purchases.",
    bonus: "Welcome bonus snapshot varies; verify current Wells Fargo offer.",
    travel: "Good direct airline/hotel booking lane.",
    lounge: "Not a lounge card.",
    foreign: "No foreign transaction fee.",
    complexity: "Medium",
    note: "Useful when you book directly with airlines and hotels.",
  },
  {
    name: "Amex Gold",
    category: "Food / Dining / Grocery",
    fee: "$325",
    lane: "Food / Dining / Grocery",
    bestFor: "Dining, groceries, and food-first Membership Rewards points.",
    avoidIf: "You want lounge access.",
    rewards: "Food-heavy Membership Rewards card: strong dining and U.S. supermarket earning, plus prepaid hotel earning through Amex Travel with current terms.",
    bonus: "As high as 100,000 points. Find out your offer; verify current Amex terms.",
    travel: "Strong points ecosystem, but food-first.",
    lounge: "Not a lounge card.",
    foreign: "No foreign transaction fee.",
    complexity: "Medium-high",
    note: "Great food-to-points lane if credits and spending habits match.",
  },
  {
    name: "Capital One Venture X",
    category: "Travel",
    fee: "$395",
    lane: "Premium lounge card",
    bestFor: "Premium but simple travel value.",
    avoidIf: "You rarely travel or do not use Capital One Travel.",
    rewards: "2x miles on everyday purchases, 10x hotels and rental cars through Capital One Travel, 5x flights and vacation rentals through Capital One Travel, with current terms.",
    bonus: "75,000-mile snapshot; verify current Capital One offer.",
    travel: "Capital One Travel credit and premium travel benefits.",
    lounge: "Capital One Lounges and Capital One Landings where available. Verify partner lounge access before relying on it.",
    foreign: "No foreign transaction fee.",
    complexity: "Medium",
    note: "Cleaner premium travel lane if you use the lounges, portal credit, and annual benefits.",
  },
  {
    name: "Chase Sapphire Reserve",
    category: "Travel",
    fee: "$795",
    lane: "Premium lounge card",
    bestFor: "Chase ecosystem travelers.",
    avoidIf: "You will not use Chase travel credits, transfer partners, or lounges.",
    rewards: "Premium Chase travel points, including elevated Chase Travel, direct airline/hotel, and dining earning with current terms.",
    bonus: "150,000 bonus points snapshot; verify current Chase offer.",
    travel: "Travel credits, transfer partners, and protections.",
    lounge: "Chase Sapphire Lounges and select partner access terms. Verify airport, guest, and enrollment rules before relying on it.",
    foreign: "No foreign transaction fee.",
    complexity: "High",
    note: "Premium Chase lane for users who understand transfer partners and credits.",
  },
  {
    name: "Amex Platinum",
    category: "Travel",
    fee: "$895",
    lane: "Luxury travel card",
    bestFor: "Luxury lounge access and high-end travel credits.",
    avoidIf: "You do not want to track credits and premium-card rules.",
    rewards: "5x on flights booked directly with airlines or through Amex Travel, up to the stated annual cap, and 5x on prepaid hotels through Amex Travel.",
    bonus: "As high as 175,000 points. Find out your offer; verify current Amex terms.",
    travel: "Premium travel credits, hotel perks, and airport perks.",
    lounge: "Amex Global Lounge Collection and Centurion Lounges.",
    foreign: "No foreign transaction fee.",
    complexity: "High",
    note: "Luxury maximalist lane; powerful only if you actually use the credits and lounges.",
  },
  {
    name: "Delta SkyMiles Platinum Amex",
    category: "Travel",
    fee: "$350",
    lane: "Airline card",
    bestFor: "Delta flyers who can use checked-bag, companion-certificate, and airline perks.",
    avoidIf: "You do not fly Delta enough to use the airline-specific value.",
    rewards: "Delta-focused miles on eligible Delta purchases and everyday categories with current Amex terms.",
    bonus: "As high as 90,000 miles. Find out your offer; verify current Amex terms.",
    travel: "Delta travel perks and airline-specific value.",
    lounge: "Not a general lounge card.",
    foreign: "No foreign transaction fee; verify current terms.",
    complexity: "Medium-high",
    note: "Airline cards are strongest when the airline is already part of your route.",
  },
  {
    name: "United Explorer Card",
    category: "Travel",
    fee: "$0 intro first year, then $150",
    lane: "Airline card",
    bestFor: "United flyers who value checked-bag and priority-boarding perks.",
    avoidIf: "You rarely fly United.",
    rewards: "United miles on United purchases plus dining and eligible hotel stays with current Chase terms.",
    bonus: "50,000-mile snapshot; verify current Chase offer.",
    travel: "United checked-bag, boarding, and airline perks.",
    lounge: "United Club one-time passes may apply; verify current terms.",
    foreign: "No foreign transaction fee.",
    complexity: "Medium",
    note: "Good when United is your real airline, not just a fantasy route.",
  },
  {
    name: "Atmos Rewards Ascent Visa Signature",
    category: "Travel",
    fee: "$95",
    lane: "Airline card",
    bestFor: "Alaska and Hawaiian route loyalists.",
    avoidIf: "You do not fly Alaska or Hawaiian enough to use companion-fare value.",
    rewards: "Airline points on eligible travel and everyday categories with current Bank of America terms.",
    bonus: "50,000 points plus Companion Fare snapshot; verify current offer.",
    travel: "Alaska/Hawaiian airline perks and companion-fare value.",
    lounge: "Not a general lounge card.",
    foreign: "No foreign transaction fee; verify current terms.",
    complexity: "Medium",
    note: "Airline-specific card. Useful only if the route is real.",
  },
  {
    name: "Hilton Honors Amex Surpass",
    category: "Travel",
    fee: "$0 intro first year, then $150",
    lane: "Hotel card",
    bestFor: "Hilton stays and hotel-status value.",
    avoidIf: "You do not stay with Hilton brands.",
    rewards: "Hilton points on Hilton purchases and everyday categories with current Amex terms.",
    bonus: "130,000-point snapshot; verify current Amex offer.",
    travel: "Hilton hotel status and hotel perks.",
    lounge: "Not a general lounge card.",
    foreign: "No foreign transaction fee; verify current terms.",
    complexity: "Medium",
    note: "Hotel cards work when your stays repeat at the same hotel family.",
  },
  {
    name: "IHG One Rewards Premier",
    category: "Travel",
    fee: "$99",
    lane: "Hotel card",
    bestFor: "IHG hotel stays and anniversary-night value.",
    avoidIf: "You do not stay at IHG properties.",
    rewards: "IHG points on IHG stays and everyday categories with current Chase terms.",
    bonus: "Up to 185,000-point snapshot; verify current Chase offer.",
    travel: "IHG hotel perks, status, and anniversary-night style value.",
    lounge: "Not a lounge card.",
    foreign: "No foreign transaction fee.",
    complexity: "Medium",
    note: "Strong only if IHG is actually where you sleep.",
  },
  {
    name: "World of Hyatt Credit Card",
    category: "Travel",
    fee: "$95",
    lane: "Hotel card",
    bestFor: "Hyatt loyalists who value free-night and status perks.",
    avoidIf: "Hyatt locations do not match your travel.",
    rewards: "Hyatt points on Hyatt stays and everyday categories with current Chase terms.",
    bonus: "Up to 60,000-point snapshot; verify current Chase offer.",
    travel: "Hyatt hotel perks and free-night style value.",
    lounge: "Not a lounge card.",
    foreign: "No foreign transaction fee.",
    complexity: "Medium",
    note: "Hyatt points can be powerful, but only if the footprint works for your trips.",
  },
  {
    name: "Southwest Rapid Rewards Priority",
    category: "Travel",
    fee: "$229",
    lane: "Airline card",
    bestFor: "Southwest flyers who use annual credits and airline perks.",
    avoidIf: "You do not fly Southwest often.",
    rewards: "Southwest points on Southwest purchases and everyday categories with current Chase terms.",
    bonus: "60,000-point snapshot; verify current Chase offer.",
    travel: "Southwest airline perks and annual travel value.",
    lounge: "Not a lounge card.",
    foreign: "No foreign transaction fee.",
    complexity: "Medium",
    note: "A route card. It belongs only if Southwest belongs in your life.",
  },
  {
    name: "Marriott Bonvoy Boundless",
    category: "Travel",
    fee: "$95",
    lane: "Hotel card",
    bestFor: "Marriott stays and annual free-night style value.",
    avoidIf: "You do not stay at Marriott properties.",
    rewards: "Marriott points on Marriott stays and everyday categories with current Chase terms.",
    bonus: "Up to 4 Free Night Awards snapshot; verify current Chase offer.",
    travel: "Marriott hotel perks and free-night style value.",
    lounge: "Not a lounge card.",
    foreign: "No foreign transaction fee.",
    complexity: "Medium",
    note: "Good only if Marriott is already part of your travel pattern.",
  },
  {
    name: "Ink Business Unlimited",
    category: "Business",
    fee: "$0",
    lane: "Business cash back",
    bestFor: "Small businesses that want simple earning without category tracking.",
    avoidIf: "You want premium travel perks or category maximization.",
    rewards: "1.5%-5% cash back snapshot from your provided NerdWallet research.",
    bonus: "$750 intro offer snapshot.",
    travel: "Business card with light travel focus compared with premium business cards.",
    lounge: "Not a lounge card.",
    foreign: "Verify current foreign transaction fee terms.",
    complexity: "Low",
    note: "Clean business base card lane for simple operating expenses.",
  },
  {
    name: "Amex Blue Business Cash",
    category: "Business",
    fee: "$0",
    lane: "Business cash back",
    bestFor: "Newer businesses that want no annual fee and simple cash back.",
    avoidIf: "You want travel points or airport perks.",
    rewards: "1%-2% cash back snapshot from your provided NerdWallet research.",
    bonus: "$250 intro offer snapshot.",
    travel: "Not travel-focused.",
    lounge: "Not a lounge card.",
    foreign: "Foreign transaction fee applies; verify current terms.",
    complexity: "Low",
    note: "Strong simple-business lane when cash back matters more than travel.",
  },
  {
    name: "Capital One Spark Cash",
    category: "Business",
    fee: "$0 intro first year, then $95",
    lane: "Business cash back",
    bestFor: "Businesses that want straightforward cash back with a lower first-year fee.",
    avoidIf: "You want no annual fee forever.",
    rewards: "2%-5% cash back snapshot from your provided NerdWallet research.",
    bonus: "$1,000 intro offer snapshot.",
    travel: "Cash-back business card with limited premium travel focus.",
    lounge: "Not a lounge card.",
    foreign: "No foreign transaction fee.",
    complexity: "Medium",
    note: "Simple business cash back, but watch the fee after year one.",
  },
  {
    name: "Amex Blue Business Plus",
    category: "Business",
    fee: "$0",
    lane: "Business points starter",
    bestFor: "New businesses that want Membership Rewards without an annual fee.",
    avoidIf: "You want cash back or premium airport perks.",
    rewards: "1x-2x Membership Rewards points snapshot from your provided NerdWallet research.",
    bonus: "15,000 points intro offer snapshot.",
    travel: "Can feed an Amex points setup, but not a lounge card.",
    lounge: "Not a lounge card.",
    foreign: "Foreign transaction fee applies; verify current terms.",
    complexity: "Low-medium",
    note: "Good first business points card if you understand Amex Membership Rewards.",
  },
  {
    name: "Amex Business Platinum",
    category: "Business",
    fee: "$895",
    lane: "Premium business travel",
    bestFor: "Business owners who can use premium travel perks and business credits.",
    avoidIf: "You do not want to track credits or pay a high annual fee.",
    rewards: "1x-5x Membership Rewards points snapshot from your provided NerdWallet research.",
    bonus: "As high as 300,000 points. Find out your offer, based on your provided Amex snapshot.",
    travel: "Premium business travel benefits and credits with terms.",
    lounge: "Amex Global Lounge Collection and Centurion Lounge style access with eligibility rules.",
    foreign: "No foreign transaction fee.",
    complexity: "High",
    note: "Powerful business travel lane, but only if the credits and lounge access are real for your business travel.",
  },
  {
    name: "Ink Business Cash",
    category: "Business",
    fee: "$0",
    lane: "Business category cash back",
    bestFor: "Businesses that spend in office, internet, phone, or select service categories.",
    avoidIf: "You want one simple flat-rate business card.",
    rewards: "1%-5% cash back snapshot from your provided NerdWallet research.",
    bonus: "$750 intro offer snapshot.",
    travel: "Not travel-focused.",
    lounge: "Not a lounge card.",
    foreign: "Verify current foreign transaction fee terms.",
    complexity: "Medium",
    note: "Business category lane; stronger when your expenses match the bonus categories.",
  },
  {
    name: "Ramp Card",
    category: "Business",
    fee: "$0",
    lane: "Business spend management",
    bestFor: "Businesses that want expense controls and simple rewards.",
    avoidIf: "You want a traditional consumer-style rewards card.",
    rewards: "1%-1.5% cash back snapshot from your provided NerdWallet research.",
    bonus: "$1,000 intro offer snapshot.",
    travel: "Business spend-management focus, not lounge-focused.",
    lounge: "Not a lounge card.",
    foreign: "Verify current terms.",
    complexity: "Medium",
    note: "More of an operations card lane: spending controls, team use, and cleaner business expense tracking.",
  },
];

const cardVisuals = {
  "Citi Double Cash": { type: "Flat cash back", earn: "Simple 2% structure", perks: ["No category tracking", "$0 annual fee", "Great base card"], pairs: ["Category cash back", "Travel"] },
  "Wells Fargo Active Cash": { type: "Flat cash back", earn: "Flat cash rewards", perks: ["Easy everyday card", "$0 annual fee", "Simple baseline"], pairs: ["Food rewards", "Travel"] },
  "Chase Freedom Unlimited": { type: "Flat cash back", earn: "1.5% catch-all + Chase categories", perks: ["Catch-all", "Dining/drugstores", "$0 annual fee"], pairs: ["Chase Sapphire Preferred", "Chase Sapphire Reserve"] },
  "Chase Freedom Flex": { type: "Category cash back", earn: "5% rotating categories + Chase categories", perks: ["Quarterly categories", "$0 annual fee", "$200 bonus"], pairs: ["Chase Sapphire Preferred", "Freedom Unlimited"] },
  "Capital One Quicksilver": { type: "Flat cash back", earn: "1.5% cash back style", perks: ["Low complexity", "$0 annual fee", "Good starter lane"], pairs: ["Capital One Savor", "Capital One Venture X"] },
  "Bank of America Customized Cash Rewards": { type: "Category cash back", earn: "Flexible chosen category cash back", perks: ["Custom category", "$0 annual fee", "$200 bonus"], pairs: ["Flat cash back", "Travel"] },
  "Amex Blue Cash Everyday": { type: "Category cash back", earn: "3% online shopping, gas, supermarkets", perks: ["3% online retail", "3% gas", "$0 annual fee"], pairs: ["Flat cash back", "Travel"] },
  "Amex Blue Cash Preferred": { type: "Category cash back", earn: "6% groceries/streaming, 3% gas/transit", perks: ["$95 annual fee", "6% supermarkets", "3% gas/transit"], pairs: ["Flat cash back", "Travel"] },
  "Capital One Savor": { type: "Category cash back", earn: "Dining, groceries, entertainment", perks: ["Food/fun spend", "$0 annual fee", "Simple categories"], pairs: ["Quicksilver", "Venture X"] },
  "Prime Visa": { type: "Category cash back", earn: "Amazon + Whole Foods cash back", perks: ["Amazon lane", "Whole Foods", "$0 annual fee"], pairs: ["Flat cash back", "Travel"] },
  "Apple Card": { type: "Apple Pay cash back", earn: "3% Apple/select, 2% Apple Pay, 1% physical", perks: ["Apple Pay optimized", "No annual fee", "No foreign transaction fee"], pairs: ["Flat cash back", "Travel"] },
  "Discover it Cash Back": { type: "Category cash back", earn: "5% rotating categories + Cashback Match", perks: ["Quarterly categories", "$0 annual fee", "Cashback Match"], pairs: ["Flat cash back", "Freedom Flex"] },
  "Chase Freedom Rise": { type: "Student / Beginner", earn: "1.5% back on all purchases", perks: ["$0 annual fee", "$25 autopay bonus", "Upgrade review path"], pairs: ["Chase Freedom Unlimited", "Chase Sapphire Preferred later"] },
  "Capital One Savor Student": { type: "Student / Beginner", earn: "Food/fun student categories", perks: ["Dining", "Entertainment", "$0 annual fee"], pairs: ["Flat cash back", "Travel later"] },
  "Capital One Platinum Secured": { type: "Credit builder", earn: "Not reward-focused", perks: ["Simple approval lane", "Credit building", "$0 annual fee"], pairs: ["Flat cash back later", "Student / Beginner"] },
  "Chase Sapphire Preferred": { type: "Travel", earn: "Chase travel + dining points", perks: ["Transfer partners", "Starter travel", "No lounge focus"], pairs: ["Chase Freedom Unlimited", "Flat cash back"] },
  "Capital One Venture": { type: "Travel", earn: "Simple miles", perks: ["Flexible miles", "Low complexity", "Travel starter"], pairs: ["Capital One Savor", "Venture X later"] },
  "Capital One VentureOne": { type: "Travel", earn: "No-fee miles starter", perks: ["No annual fee", "Travel learning lane", "Simple miles"], pairs: ["Savor", "Venture X later"] },
  "Bank of America Travel Rewards": { type: "Travel", earn: "No-fee travel points", perks: ["$0 annual fee", "Starter travel", "Simple rewards"], pairs: ["Customized Cash", "Flat cash back"] },
  "Citi Strata Premier": { type: "Travel", earn: "Travel + everyday categories", perks: ["Category points", "Travel rewards", "Everyday earning"], pairs: ["Flat cash back", "Food rewards"] },
  "Wells Fargo Autograph": { type: "Travel", earn: "No-fee travel categories", perks: ["No annual fee", "Travel-adjacent", "Everyday categories"], pairs: ["Flat cash back", "Premium travel later"] },
  "Wells Fargo Autograph Journey": { type: "Travel", earn: "Direct airline/hotel categories", perks: ["Airlines", "Hotels", "Direct booking"], pairs: ["Flat cash back", "No-fee card"] },
  "Amex Gold": { type: "Food / Dining / Grocery", earn: "Food-to-points", perks: ["Dining", "Groceries", "Membership Rewards"], pairs: ["Amex Platinum", "Flat cash back"] },
  "Capital One Venture X": { type: "Premium Travel", earn: "Miles + travel credits", perks: ["Capital One Lounges", "Annual travel credit", "Anniversary miles"], pairs: ["Savor", "Quicksilver"] },
  "Chase Sapphire Reserve": { type: "Premium Travel", earn: "Premium Chase travel", perks: ["Sapphire Lounges", "Travel credits", "Transfer partners"], pairs: ["Freedom Unlimited", "Flat cash back"] },
  "Amex Platinum": { type: "Premium Travel", earn: "Luxury travel perks", perks: ["Centurion Lounges", "Premium credits", "Hotel/airport perks"], pairs: ["Amex Gold", "Flat cash back"] },
  "Delta SkyMiles Platinum Amex": { type: "Travel", earn: "Delta airline miles", perks: ["Delta lane", "Companion value", "$350 fee"], pairs: ["Flat cash back", "Hotel card"] },
  "United Explorer Card": { type: "Travel", earn: "United airline miles", perks: ["United lane", "Bag perks", "Priority boarding"], pairs: ["Chase Sapphire Preferred", "Flat cash back"] },
  "Atmos Rewards Ascent Visa Signature": { type: "Travel", earn: "Alaska/Hawaiian airline points", perks: ["Companion fare", "$95 fee", "Airline lane"], pairs: ["Flat cash back", "Travel"] },
  "Hilton Honors Amex Surpass": { type: "Travel", earn: "Hilton hotel points", perks: ["Hilton lane", "Hotel status", "$150 fee"], pairs: ["Amex Gold", "Flat cash back"] },
  "IHG One Rewards Premier": { type: "Travel", earn: "IHG hotel points", perks: ["IHG lane", "Anniversary value", "$99 fee"], pairs: ["Chase Sapphire Preferred", "Flat cash back"] },
  "World of Hyatt Credit Card": { type: "Travel", earn: "Hyatt hotel points", perks: ["Hyatt lane", "Free-night value", "$95 fee"], pairs: ["Chase Sapphire Preferred", "Flat cash back"] },
  "Southwest Rapid Rewards Priority": { type: "Travel", earn: "Southwest airline points", perks: ["Southwest lane", "Annual credits", "$229 fee"], pairs: ["Chase Sapphire Preferred", "Flat cash back"] },
  "Marriott Bonvoy Boundless": { type: "Travel", earn: "Marriott hotel points", perks: ["Marriott lane", "Free-night value", "$95 fee"], pairs: ["Chase Sapphire Preferred", "Flat cash back"] },
  "Ink Business Unlimited": { type: "Business", earn: "1.5%-5% cash back", perks: ["$0 annual fee", "$750 intro offer", "Simple business base"], pairs: ["Ink Business Cash", "Business Platinum"] },
  "Amex Blue Business Cash": { type: "Business", earn: "1%-2% cash back", perks: ["$0 annual fee", "$250 intro offer", "No-fee business lane"], pairs: ["Blue Business Plus", "Business Platinum"] },
  "Capital One Spark Cash": { type: "Business", earn: "2%-5% cash back", perks: ["$0 intro then $95", "$1,000 intro offer", "Simple business cash"], pairs: ["Ramp Card", "Venture X"] },
  "Amex Blue Business Plus": { type: "Business", earn: "1x-2x points", perks: ["$0 annual fee", "15,000 point offer", "Business points starter"], pairs: ["Amex Gold", "Amex Business Platinum"] },
  "Amex Business Platinum": { type: "Business", earn: "1x-5x points", perks: ["Premium business travel", "Amex lounges", "$895 annual fee"], pairs: ["Blue Business Plus", "Amex Gold"] },
  "Ink Business Cash": { type: "Business", earn: "1%-5% cash back", perks: ["$0 annual fee", "$750 intro offer", "Business categories"], pairs: ["Ink Business Unlimited", "Chase Sapphire Preferred"] },
  "Ramp Card": { type: "Business", earn: "1%-1.5% cash back", perks: ["$0 annual fee", "$1,000 intro offer", "Expense controls"], pairs: ["Business cash back", "Business checking"] },
};

const cardImageMap = {
  "Apple Card": "assets/apple-card-real.jpg",
  "Amex Blue Cash Everyday": "assets/card-amex-blue-cash-everyday.jpg",
  "Amex Gold": "assets/card-amex-gold.png",
  "Amex Platinum": "assets/card-amex-platinum.png",
  "Chase Freedom Rise": "assets/card-chase-freedom-rise.png",
  "Amex Blue Business Cash": "assets/card-amex-blue-business-cash.png",
  "Ink Business Unlimited": "assets/card-ink-business-unlimited.png",
  "Citi Double Cash": "assets/card-citi-double-cash.png",
  "Amex Blue Cash Preferred": "assets/card-amex-blue-cash-preferred.png",
  "Capital One Savor": "assets/card-capital-one-savor.png",
  "Capital One Savor Student": "assets/card-capital-one-savor-student.png",
  "Capital One Quicksilver": "assets/card-capital-one-quicksilver.png",
  "Capital One Venture": "assets/card-capital-one-venture.png",
  "Capital One VentureOne": "assets/card-capital-one-ventureone.png",
  "Chase Freedom Unlimited": "assets/card-chase-freedom-unlimited.png",
  "Chase Freedom Flex": "assets/card-chase-freedom-flex.png",
  "Chase Sapphire Preferred": "assets/card-chase-sapphire-preferred.png",
  "Chase Sapphire Reserve": "assets/card-chase-sapphire-reserve.png",
  "Capital One Venture X": "assets/card-capital-one-venture-x.png",
  "Citi Strata Premier": "assets/card-citi-strata-premier.png",
  "Discover it Cash Back": "assets/card-discover-it.png",
  "Wells Fargo Active Cash": "assets/card-wells-fargo-active-cash.png",
  "Bank of America Customized Cash Rewards": "assets/card-bank-of-america-customized-cash-rewards.png",
  "Prime Visa": "assets/card-prime-visa.png",
  "Capital One Platinum Secured": "assets/card-capital-one-platinum-secured.png",
  "Bank of America Travel Rewards": "assets/card-bank-of-america-travel-rewards.png",
  "Delta SkyMiles Platinum Amex": "assets/card-delta-skymiles-platinum-amex.jpg",
  "Atmos Rewards Ascent Visa Signature": "assets/card-atmos-rewards-ascent-visa-signature.png",
  "Hilton Honors Amex Surpass": "assets/card-hilton-honors-amex-surpass.png",
  "IHG One Rewards Premier": "assets/card-ihg-one-rewards-premier.jpg",
  "Marriott Bonvoy Boundless": "assets/card-marriott-bonvoy-boundless.png",
  "Ramp Card": "assets/card-ramp.png",
  "Ink Business Cash": "assets/card-ink-business-cash.png",
  "Capital One Spark Cash": "assets/card-capital-one-spark-cash.png",
  "Amex Business Platinum": "assets/card-amex-business-platinum.png",
  "Amex Blue Business Plus": "assets/card-amex-blue-business-plus.png",
  "World of Hyatt Credit Card": "assets/card-world-of-hyatt.png",
  "Wells Fargo Autograph Journey": "assets/card-wells-fargo-autograph-journey.png",
  "Wells Fargo Autograph": "assets/card-wells-fargo-autograph.png",
  "United Explorer Card": "assets/card-united-explorer.png",
  "Southwest Rapid Rewards Priority": "assets/card-southwest-rapid-rewards-priority.png",
};

const cardTypes = ["All", "Student / Beginner", "Credit builder", "Flat cash back", "Category cash back", "Apple Pay cash back", "Food / Dining / Grocery", "Travel", "Premium Travel", "Business"];
let activeCardFilter = "All";
const cardCategoryOrder = ["Cash back", "Food / Dining / Grocery", "Student and credit building", "Travel", "Business"];
const lifeScoreCardPicks = new Set(["Amex Gold", "Chase Freedom Unlimited", "Chase Sapphire Preferred", "Amex Platinum", "Citi Strata Premier"]);

cardProfiles.forEach((card) => {
  const visual = cardVisuals[card.name] || {};
  card.type = visual.type || card.lane;
  card.earn = visual.earn || card.rewards;
  card.perks = visual.perks || [card.lane, card.fee, card.complexity];
  card.pairs = visual.pairs || [];
});

function cardBadgeClass(card) {
  return card.type.toLowerCase().replace(/[^a-z0-9]+/g, "-");
}

function cardArtMarkup(card) {
  const image = cardImageMap[card.name];
  const cardSlug = card.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  const baseClass = `card-art ${cardBadgeClass(card)} card-${cardSlug}${image ? " has-image" : ""}`;
  return image
    ? `<div class="${baseClass}"><img src="${image}" alt="${card.name} card image"></div>`
    : `<div class="${baseClass} no-photo" aria-label="${card.name} card image pending"></div>`;
}

function renderCardFilters() {
  if (!cardFilters) return;
  cardFilters.innerHTML = cardTypes
    .map((type) => `<button class="${type === activeCardFilter ? "is-active" : ""}" type="button" data-card-filter="${type}">${type}</button>`)
    .join("");
}

function filteredCards() {
  const cards = activeCardFilter === "All" ? cardProfiles : cardProfiles.filter((card) => card.type === activeCardFilter);
  return [...cards].sort((a, b) => {
    const categorySort = cardCategoryOrder.indexOf(a.category) - cardCategoryOrder.indexOf(b.category);
    if (categorySort) return categorySort;
    const typeSort = a.type.localeCompare(b.type);
    return typeSort || a.name.localeCompare(b.name);
  });
}

function renderCardComparison() {
  if (!cardComparison) return;
  let lastCategory = "";
  cardComparison.innerHTML = filteredCards()
    .map((card) => {
      const realIndex = cardProfiles.indexOf(card);
      const header = activeCardFilter === "All" && card.category !== lastCategory
        ? `<div class="card-category-header"><span>${card.category}</span></div>`
        : "";
      lastCategory = card.category;
      return `${header}
      <article class="database-card">
        ${cardArtMarkup(card)}
        <div class="database-card-meta">
          <span>${card.type}</span>
          ${lifeScoreCardPicks.has(card.name) ? `<span class="pick-chip">LifeScore pick</span>` : ""}
        </div>
        <h3>${card.name}</h3>
        <p>${card.earn}</p>
        <button type="button" data-card-index="${realIndex}">View perks</button>
      </article>`;
    })
    .join("");
}

function renderCardDetail(card) {
  if (!cardDetail) return;
  cardDetail.innerHTML = `
    <h3>${card.name}</h3>
    <div class="detail-grid detail-grid-tight">
      <div><span>Annual fee</span><strong>${card.fee}</strong></div>
      <div><span>Lane</span><strong>${card.type}</strong></div>
      <div><span>Complexity</span><strong>${card.complexity}</strong></div>
      <div><span>Rewards</span><p>${card.rewards}</p></div>
      <div><span>Welcome bonus</span><p>${card.bonus}</p></div>
      <div><span>Travel benefits</span><p>${card.travel}</p></div>
      <div><span>Lounge access</span><p>${card.lounge}</p></div>
      <div><span>Foreign fee</span><p>${card.foreign}</p></div>
      <div><span>Best for</span><p>${card.bestFor}</p></div>
      <div><span>Watch out</span><p>${card.avoidIf}</p></div>
      <div><span>LifeScore note</span><p>${card.note}</p></div>
    </div>
    <div class="perk-list">${card.perks.map((perk) => `<span>${perk}</span>`).join("")}</div>
  `;
}

function renderSideBySide() {
  if (!sideBySide || !compareLeft || !compareRight) return;
  const leftCard = cardProfiles[Number(compareLeft.value)] || cardProfiles[0];
  const rightCard = cardProfiles[Number(compareRight.value)] || cardProfiles[11];
  sideBySide.innerHTML = [leftCard, rightCard].map((card) => `
    <article class="compare-visual">
      ${cardArtMarkup(card)}
      <div class="compare-card-meta">
        <span>${card.type}</span>
        ${lifeScoreCardPicks.has(card.name) ? `<span class="pick-chip compare-pick-chip">LifeScore pick</span>` : ""}
      </div>
      <h3>${card.name}</h3>
      <div class="compare-metrics">
        <div><small>Fee</small><strong>${card.fee}</strong></div>
        <div><small>Earns</small><strong>${card.earn}</strong></div>
        <div><small>Bonus</small><strong>${card.bonus}</strong></div>
        <div><small>Perks</small><strong>${card.perks.slice(0, 3).join(" + ")}</strong></div>
        <div><small>Watchout</small><strong>${card.avoidIf}</strong></div>
      </div>
    </article>
  `).join("");
}

function renderCompareSelects() {
  if (!compareLeft || !compareRight) return;
  const options = cardProfiles.map((card, index) => `<option value="${index}">${card.name}</option>`).join("");
  compareLeft.innerHTML = options;
  compareRight.innerHTML = options;
  compareLeft.value = String(cardProfiles.findIndex((card) => card.name === "Chase Sapphire Preferred"));
  compareRight.value = String(cardProfiles.findIndex((card) => card.name === "Chase Sapphire Reserve"));
  renderSideBySide();
}

cardFilters?.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-card-filter]");
  if (!button) return;
  activeCardFilter = button.dataset.cardFilter;
  renderCardFilters();
  renderCardComparison();
});

cardComparison?.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-card-index]");
  if (!button) return;
  renderCardDetail(cardProfiles[Number(button.dataset.cardIndex)]);
  cardDetail?.scrollIntoView({ behavior: "smooth", block: "start" });
});

compareLeft?.addEventListener("change", renderSideBySide);
compareRight?.addEventListener("change", renderSideBySide);

renderCardFilters();
renderCardComparison();
renderCompareSelects();

const walletForm = document.querySelector("[data-wallet-form]");
const walletOptions = document.querySelector("[data-wallet-options]");
const walletResult = document.querySelector("[data-wallet-result]");
const walletFilters = document.querySelector("[data-wallet-filters]");
const walletCategories = ["All", "Student / Beginner", "Cash Back", "Travel", "Premium", "Business"];
let activeWalletFilter = "All";
let walletHasBuilt = false;
const walletSelected = new Set();

function walletLaneGroup(card) {
  if (card.type === "Student / Beginner" || card.type === "Credit builder") return "Student / Beginner";
  if (card.type === "Flat cash back" || card.type === "Category cash back" || card.type === "Apple Pay cash back" || card.type === "Food / Dining / Grocery") return "Cash Back";
  if (card.type === "Premium Travel") return "Premium";
  if (card.type === "Business") return "Business";
  return "Travel";
}

const foodCardNames = new Set(["Amex Gold", "Capital One Savor", "Capital One Savor Student", "Amex Blue Cash Everyday", "Amex Blue Cash Preferred"]);
const loungeCardNames = new Set(["Amex Platinum", "Capital One Venture X", "Chase Sapphire Reserve"]);
const transferUnlockNames = new Set(["Chase Sapphire Preferred", "Chase Sapphire Reserve"]);
const beginnerCardNames = new Set(["Chase Freedom Rise", "Capital One Savor Student", "Capital One Platinum Secured", "Discover it Cash Back"]);
const chaseFreedomNames = new Set(["Chase Freedom Unlimited", "Chase Freedom Flex", "Chase Freedom Rise"]);
const capitalOneFoundationNames = new Set(["Capital One Savor", "Capital One Savor Student", "Capital One Quicksilver", "Capital One Platinum Secured"]);

function hasCard(selectedNames, name) {
  return selectedNames.has(name);
}

function hasAnyCard(selectedNames, names) {
  return [...names].some((name) => selectedNames.has(name));
}

function isFoodCard(card) {
  return foodCardNames.has(card.name);
}

function isLoungeCard(card) {
  return loungeCardNames.has(card.name);
}

function cardEcosystem(cardOrName) {
  const name = typeof cardOrName === "string" ? cardOrName : cardOrName.name;
  if (name.startsWith("Chase") || name.startsWith("Ink ") || ["United Explorer Card", "Southwest Rapid Rewards Priority", "World of Hyatt Credit Card", "Marriott Bonvoy Boundless", "IHG One Rewards Premier", "Prime Visa"].includes(name)) return "Chase";
  if (name.startsWith("Amex") || name.includes(" Amex") || name.startsWith("Hilton Honors")) return "Amex";
  if (name.startsWith("Capital One")) return "Capital One";
  if (name.startsWith("Citi")) return "Citi";
  if (name.startsWith("Wells Fargo")) return "Wells Fargo";
  if (name.startsWith("Discover")) return "Discover";
  if (name.startsWith("Bank of America")) return "Bank of America";
  return "Other";
}

function activeEcosystems(selectedCards) {
  return selectedCards.reduce((ecosystems, card) => {
    ecosystems.add(cardEcosystem(card));
    return ecosystems;
  }, new Set());
}

function hasAnySelected(selectedNames, names) {
  return [...names].some((name) => selectedNames.has(name));
}

function cardAnnualFeeNumber(card) {
  const matches = card.fee.match(/\$(\d[\d,]*)/g);
  if (!matches) return 0;
  return Math.max(...matches.map((match) => Number(match.replace(/[$,]/g, ""))));
}

function feeFits(card, fee) {
  const annualFee = cardAnnualFeeNumber(card);
  if (fee === "avoid") return annualFee === 0;
  if (fee === "low") return annualFee <= 150;
  return true;
}

function isBeginnerWallet(selectedCards) {
  if (!selectedCards.length) return true;
  const selectedNames = new Set(selectedCards.map((card) => card.name));
  const hasPremiumOrTravel = selectedCards.some((card) => walletLaneGroup(card) === "Travel" || walletLaneGroup(card) === "Premium");
  const beginnerCount = selectedCards.filter((card) => beginnerCardNames.has(card.name) || walletLaneGroup(card) === "Student / Beginner").length;
  return selectedCards.length <= 3 && !hasPremiumOrTravel && (beginnerCount >= 1 || hasAnySelected(selectedNames, capitalOneFoundationNames));
}

function hasSimpleCashBack(selectedCards) {
  return selectedCards.some((card) => walletLaneGroup(card) === "Cash Back" || ["Flat cash back", "Apple Pay cash back", "Category cash back", "Food / Dining / Grocery"].includes(card.type));
}

function walletGoalCovered(selectedCards, goal) {
  const selectedNames = new Set(selectedCards.map((card) => card.name));
  const lanes = new Set(selectedCards.map(walletLaneGroup));

  if (!selectedCards.length) return false;
  if (goal === "build") return lanes.has("Student / Beginner");
  if (goal === "simple" || goal === "lowfee") return hasSimpleCashBack(selectedCards);
  if (goal === "food") return selectedCards.some(isFoodCard);
  if (goal === "travel") return lanes.has("Travel") || hasAnyCard(selectedNames, transferUnlockNames);
  if (goal === "premium") return hasAnyCard(selectedNames, loungeCardNames);
  if (goal === "business") return lanes.has("Business");
  return false;
}

function businessCardsAllowed(goal, spend, walletScore) {
  return goal === "business" || spend === "business" || walletScore >= 85;
}

function shouldMentionBusinessLane(goal, spend, walletScore) {
  return goal === "business" || spend === "business" || walletScore >= 70;
}

function renderWalletFilters() {
  if (!walletFilters) return;
  walletFilters.innerHTML = walletCategories
    .map((category) => `<button class="${category === activeWalletFilter ? "is-active" : ""}" type="button" data-wallet-filter="${category}">${category}</button>`)
    .join("");
}

function renderWalletOptions() {
  if (!walletOptions) return;
  const visibleCards = cardProfiles
    .map((card, index) => ({ card, index, group: walletLaneGroup(card) }))
    .filter(({ group }) => activeWalletFilter === "All" || group === activeWalletFilter);

  walletOptions.innerHTML = `
    <div class="wallet-options-head">
      <span class="wallet-options-title">Cards you already have</span>
      <button class="clear-wallet-button" type="button" data-wallet-clear ${walletSelected.size ? "" : "disabled"}>Clear selections</button>
    </div>
    <div class="wallet-check-grid">
      ${visibleCards.map(({ card, index, group }) => `
        <label class="wallet-check-card">
          <input type="checkbox" value="${index}" data-wallet-card ${walletSelected.has(index) ? "checked" : ""}>
          <span class="wallet-chip-body">
            <span class="wallet-card-copy">
              <strong>${card.name}</strong>
              <small>${group} | ${card.fee}</small>
            </span>
          </span>
        </label>
      `).join("")}
    </div>
  `;
}

function recommendWalletCards(selectedCards, goal, spend, fee, walletScore = 0) {
  const selectedNames = new Set(selectedCards.map((card) => card.name));
  const selectedGroups = new Set(selectedCards.map(walletLaneGroup));
  const goalCovered = walletGoalCovered(selectedCards, goal);
  const businessAllowed = businessCardsAllowed(goal, spend, walletScore);
  const ecosystems = activeEcosystems(selectedCards);
  const hasAmexGold = hasCard(selectedNames, "Amex Gold");
  const hasPremiumLounge = hasAnyCard(selectedNames, loungeCardNames);
  const hasSapphireReserve = hasCard(selectedNames, "Chase Sapphire Reserve");
  const hasChaseFreedom = hasAnySelected(selectedNames, chaseFreedomNames);
  const hasCapitalOneFoundation = hasAnySelected(selectedNames, capitalOneFoundationNames);
  const beginnerWallet = isBeginnerWallet(selectedCards);
  const recs = [];

  function removeRec(name) {
    const index = recs.findIndex((item) => item.card.name === name);
    if (index !== -1) recs.splice(index, 1);
  }

  function conflictsWithStrongerLane(name) {
    if (name === "Amex Blue Cash Preferred") removeRec("Amex Blue Cash Everyday");
    if (name === "Wells Fargo Active Cash") removeRec("Citi Double Cash");
    if (name === "Amex Blue Cash Everyday" && fee !== "avoid" && recs.some((item) => item.card.name === "Amex Blue Cash Preferred")) return true;
    if (name === "Amex Blue Cash Everyday" && fee !== "avoid" && selectedNames.has("Amex Blue Cash Preferred")) return true;
    if (name === "Chase Sapphire Preferred" && (selectedNames.has("Chase Sapphire Reserve") || recs.some((item) => item.card.name === "Chase Sapphire Reserve"))) return true;
    if (name === "Capital One Venture" && recs.some((item) => item.card.name === "Capital One Venture X")) return true;
    return false;
  }

  function add(name, reason) {
    const card = cardProfiles.find((item) => item.name === name);
    if (!card) return;
    if (!feeFits(card, fee)) return;
    if (!businessAllowed && walletLaneGroup(card) === "Business") return;
    if (hasSapphireReserve && name === "Chase Sapphire Preferred") return;
    if (hasAmexGold && isFoodCard(card)) return;
    if (hasPremiumLounge && isLoungeCard(card)) return;
    if (conflictsWithStrongerLane(name)) return;
    if (card && !selectedNames.has(card.name) && !recs.some((item) => item.card.name === card.name)) {
      recs.push({ card, reason });
    }
  }

  function addBusinessLevelUpCards() {
    if (ecosystems.has("Chase")) {
      add("Ink Business Cash", "Chase business lane: office, internet, phone, and select business categories.");
      add("Ink Business Unlimited", "Chase business lane: simple catch-all business spend.");
    }
    if (ecosystems.has("Amex")) {
      add("Amex Blue Business Plus", "Amex business points lane for real business spend.");
      add("Amex Blue Business Cash", "Amex business cash-back lane for separated expenses.");
    }
    if (ecosystems.has("Capital One")) add("Capital One Spark Cash", "Capital One business cash-back lane when business spend is real.");
    add("Ink Business Unlimited", "Business level-up lane: simple cash back for real business or side-hustle expenses.");
    add("Amex Blue Business Cash", "Business level-up lane: no-fee cash back for separated expenses.");
    if (fee === "premium") add("Amex Business Platinum", "Premium business lane: only if credits and travel perks are real.");
  }

  function addFlatCashBackCards() {
    add("Wells Fargo Active Cash", "Flat 2% lane: simple catch-all cash rewards without category work.");
    add("Citi Double Cash", "Flat cash-back lane: strong for random purchases if you pay in full.");
    add("Capital One Quicksilver", "Low-complexity cash-back lane with no annual fee.");
  }

  if (!selectedCards.length) {
    if (goal === "build") {
      add("Chase Freedom Rise", "Starter lane: build payment history before chasing premium cards.");
      add("Capital One Platinum Secured", "Credit-builder lane when approval odds matter more than rewards.");
      add("Capital One Savor Student", "Student lane with useful food and entertainment categories.");
    } else if (goal === "travel" || spend === "travel") {
      add(fee === "avoid" ? "Wells Fargo Autograph" : "Chase Sapphire Preferred", fee === "avoid" ? "No-fee travel-adjacent lane for gas, transit, dining, and travel categories." : "Starter travel lane: transfer partners without jumping to premium lounge fees.");
      add("Capital One VentureOne", "No-fee travel learning lane before bigger annual fees.");
    } else if (goal === "premium") {
      add("Capital One VentureOne", "Beginner travel pathway before premium lounge cards.");
      if (fee === "premium") add("Capital One Venture X", "Premium lane only if travel is real and credits are useful.");
    } else if (goal === "food" || spend === "dining" || spend === "groceries") {
      add("Capital One Savor", "Food lane: dining, groceries, entertainment, and streaming.");
      if (fee !== "avoid") add("Amex Blue Cash Preferred", "Stronger grocery, streaming, gas, and transit cash-back lane if the fee works.");
      if (fee === "premium") add("Amex Gold", "Premium food-points lane for restaurants and U.S. supermarkets.");
    } else {
      addFlatCashBackCards();
      add("Chase Freedom Unlimited", "Starter Chase lane that can pair with Sapphire later.");
    }
    return recs.slice(0, 4);
  }

  if (goal === "business" || spend === "business") {
    addBusinessLevelUpCards();
    return recs.slice(0, 4);
  }

  if (goal === "premium") {
    if (beginnerWallet && hasCapitalOneFoundation) {
      add("Capital One VentureOne", "Capital One pathway: no-fee travel learning before premium lounges.");
      add("Capital One Venture", "Capital One pathway: simple miles once travel spend is real.");
      if (fee === "premium") add("Capital One Venture X", "Capital One premium lane: lounge access after the foundation is ready.");
      return recs.slice(0, 4);
    } else {
      if (hasAmexGold || ecosystems.has("Amex")) {
        add("Amex Platinum", "Amex ecosystem fit: Gold earns on food, Platinum adds lounges and premium travel.");
        return recs.slice(0, 4);
      }
      if (hasChaseFreedom || ecosystems.has("Chase")) {
        add("Chase Sapphire Reserve", "Chase ecosystem fit: premium travel and lounge access for an existing Chase setup.");
        return recs.slice(0, 4);
      }
      if (hasCapitalOneFoundation || ecosystems.has("Capital One")) {
        add("Capital One Venture X", "Capital One ecosystem fit: simple premium travel and lounge value.");
        return recs.slice(0, 4);
      }
      add("Capital One Venture X", "Premium lane: simple lounge value if you travel enough.");
      add("Chase Sapphire Reserve", "Premium Chase lane: lounge access plus transfer partners.");
      add("Amex Platinum", "Luxury lounge lane if credits, airports, and travel habits line up.");
    }
    return recs.slice(0, 4);
  }

  if (goal === "travel" || spend === "travel") {
    if (beginnerWallet && hasCapitalOneFoundation) {
      add("Capital One VentureOne", "Capital One pathway: no-fee travel learning before bigger annual fees.");
      add("Capital One Venture", "Capital One pathway: simple miles once travel spend is real.");
      return recs.slice(0, 4);
    }
    if (hasChaseFreedom || ecosystems.has("Chase")) {
      add("Chase Sapphire Preferred", "Chase ecosystem unlock: Freedom points become more useful with transfer partners.");
      if (fee === "premium") add("Chase Sapphire Reserve", "Premium Chase travel lane if lounge access and credits are real.");
      return recs.slice(0, 4);
    }
    if (hasCapitalOneFoundation || ecosystems.has("Capital One")) {
      add(fee === "avoid" ? "Capital One VentureOne" : "Capital One Venture", fee === "avoid" ? "Capital One travel starter with no annual fee." : "Capital One miles lane that keeps the setup simple.");
      if (fee === "premium") add("Capital One Venture X", "Capital One premium travel lane when lounge value is real.");
      return recs.slice(0, 4);
    }
    if (!recs.length) {
      add(fee === "avoid" ? "Wells Fargo Autograph" : "Chase Sapphire Preferred", fee === "avoid" ? "No-fee travel-adjacent lane for gas, transit, dining, and travel categories." : "Starter travel lane: transfer-partner unlock without lounge focus.");
      add("Capital One VentureOne", "No-fee travel starter lane if you want to learn miles first.");
      add("Capital One Venture", "Simple miles lane with a moderate annual fee.");
    }
    return recs.slice(0, 4);
  }

  if (goal === "food" || spend === "dining" || spend === "groceries") {
    if (!hasAmexGold && fee === "premium") add("Amex Gold", "Premium food lane: restaurants and U.S. supermarkets when Membership Rewards fit.");
    if (spend === "groceries" || spend === "gas" || fee !== "avoid") add("Amex Blue Cash Preferred", "Stronger grocery, streaming, gas, and transit cash-back lane if the fee works.");
    if (!hasAmexGold) add("Capital One Savor", "Food lane: dining, groceries, entertainment, and streaming.");
    if (fee === "avoid") add("Amex Blue Cash Everyday", "No-fee groceries, gas, and online retail lane.");
    if (hasAmexGold) addFlatCashBackCards();
  }

  if (goal === "build") {
    if (ecosystems.has("Capital One")) add("Capital One Platinum Secured", "Credit-builder lane inside Capital One if approval odds matter.");
    add("Chase Freedom Rise", "Chase starter lane: 1.5% back, autopay bonus, and upgrade review path.");
    add("Chase Freedom Unlimited", "Beginner-to-Chase lane: simple rewards that can pair with Sapphire later.");
    add("Capital One Savor Student", "Student lane with food and entertainment rewards.");
  }

  if (goal === "simple" || goal === "lowfee" || spend === "mixed") {
    addFlatCashBackCards();
  }

  if (spend === "online") {
    add("Apple Card", "Apple Pay lane: clean if you already pay with iPhone often.");
    if (fee === "avoid") add("Amex Blue Cash Everyday", "Online retail lane with simple no-fee category value.");
    else add("Amex Blue Cash Preferred", "Cash-back category lane if the fee makes sense with groceries, gas, transit, and streaming.");
  }

  if (spend === "gas") {
    add("Wells Fargo Autograph", "No-fee gas, transit, travel-adjacent category lane.");
    if (fee !== "avoid") add("Amex Blue Cash Preferred", "Gas, transit, grocery, and streaming cash-back lane with an annual fee.");
    if (fee === "avoid") add("Amex Blue Cash Everyday", "Gas and grocery cash-back lane with a no-fee structure.");
  }

  if (businessAllowed && (goal === "business" || spend === "business" || (walletScore >= 85 && !selectedGroups.has("Business")))) {
    addBusinessLevelUpCards();
  }

  if (goalCovered && !recs.length && walletScore >= 85 && !selectedGroups.has("Business")) {
    addBusinessLevelUpCards();
  }

  return recs.slice(0, 4);
}

function walletScoreLabel(score) {
  if (score <= 30) return "Starter Wallet";
  if (score <= 50) return "Basic Wallet";
  if (score <= 70) return "Clean Foundation";
  if (score <= 85) return "Optimized Setup";
  return "Elite Wallet";
}

function walletTargetLane(goal) {
  if (goal === "build") return "Student / Beginner";
  if (goal === "travel") return "Travel";
  if (goal === "premium") return "Premium";
  if (goal === "business") return "Business";
  if (goal === "food") return "Food / Dining / Grocery";
  return "Cash Back";
}

function scoreWallet(selectedCards, lanes, goal, fee) {
  const targetLane = walletTargetLane(goal);
  if (!selectedCards.length) return { score: 0, label: walletScoreLabel(0), targetLane };

  const laneSet = new Set(lanes);
  const selectedNames = new Set(selectedCards.map((card) => card.name));
  const ecosystems = activeEcosystems(selectedCards);
  const foodCount = selectedCards.filter(isFoodCard).length;
  const loungeCount = selectedCards.filter(isLoungeCard).length;
  const covered = walletGoalCovered(selectedCards, goal);
  const duplicatePenalty = Math.max(0, foodCount - 1) * 8 + Math.max(0, loungeCount - 1) * 6;
  let score = 0;

  score += Math.min(30, laneSet.size * 6);
  if (hasSimpleCashBack(selectedCards)) score += 4;
  if (laneSet.has("Student / Beginner")) score += 4;

  if (covered) score += 25;
  else if (selectedCards.length) score += 8;

  if ((hasAnySelected(selectedNames, chaseFreedomNames) && hasAnyCard(selectedNames, transferUnlockNames)) ||
      (hasCard(selectedNames, "Amex Gold") && hasCard(selectedNames, "Amex Platinum")) ||
      (hasAnySelected(selectedNames, capitalOneFoundationNames) && hasAnyCard(selectedNames, new Set(["Capital One VentureOne", "Capital One Venture", "Capital One Venture X"]))) ||
      (ecosystems.has("Chase") && laneSet.has("Business") && goal === "business")) {
    score += 20;
  } else if (ecosystems.size < selectedCards.length) {
    score += 12;
  } else if (ecosystems.size === 1) {
    score += 8;
  } else {
    score += 4;
  }

  if (fee === "avoid") score += selectedCards.every((card) => cardAnnualFeeNumber(card) === 0) ? 15 : 7;
  else if (fee === "low") score += selectedCards.every((card) => cardAnnualFeeNumber(card) <= 150) ? 15 : 8;
  else score += 12;

  score += selectedCards.length <= 5 ? 10 : 5;

  if (hasCard(selectedNames, "Chase Sapphire Reserve") && hasCard(selectedNames, "Chase Sapphire Preferred")) score -= 10;
  if (hasCard(selectedNames, "Amex Gold") && foodCount > 1) score -= duplicatePenalty;
  if (loungeCount > 1) score -= duplicatePenalty;
  if (selectedCards.length > 6) score -= 8;
  if (goal === "premium" && fee === "avoid") score -= 8;

  score = Math.min(100, Math.max(0, Math.round(score)));
  return { score, label: walletScoreLabel(score), targetLane };
}

function nextWalletMove(selectedCards, lanes, missing, targetLane, goal) {
  const selectedNames = new Set(selectedCards.map((card) => card.name));
  const ecosystems = activeEcosystems(selectedCards);
  const hasChaseFreedom = hasAnySelected(selectedNames, chaseFreedomNames);
  const hasCapitalOneFoundation = hasAnySelected(selectedNames, capitalOneFoundationNames);
  if (!selectedCards.length) return "Start with one beginner or flat cash-back card before chasing premium perks.";
  if ((goal === "travel" || goal === "premium") && isBeginnerWallet(selectedCards) && hasCapitalOneFoundation) return "Build the Capital One travel path first. VentureOne or Venture comes before jumping to premium lounges.";
  if (goal === "travel" && hasChaseFreedom && !hasAnyCard(selectedNames, transferUnlockNames)) return "Your Chase base is ready. The clean next move is a Sapphire card if travel points are real.";
  if (goal === "premium" && hasCard(selectedNames, "Amex Gold") && !hasCard(selectedNames, "Amex Platinum")) return "Amex Gold already covers food. Platinum is the clean lounge add if the fee and credits make sense.";
  if (goal === "business" && ecosystems.has("Chase")) return "Extend the Chase setup into business only when business spend is real.";
  if (walletGoalCovered(selectedCards, goal) && missing.includes("Travel")) return "Your current goal is covered. If you want the next useful lane, research a travel starter only if trips are real.";
  if (walletGoalCovered(selectedCards, goal)) return "Pause before adding more. Your current wallet already covers this goal.";
  if (goal === "food") return "Add one food-first card only if dining or groceries are a real spend lane.";
  if (!lanes.includes(targetLane)) return `Add a ${targetLane} lane before adding extra cards.`;
  if (missing.includes("Cash Back")) return "Add a simple flat cash-back card for everyday purchases.";
  if (missing.includes("Travel")) return "Add a starter travel card only if trips are part of your real life.";
  if (missing.includes("Business")) return "Separate business spend only if you actually have business expenses.";
  return "Pause before adding more. A clean wallet has purpose.";
}

function walletWarning(selectedCards, lanes, goal, fee, targetLane, score) {
  const selectedNames = new Set(selectedCards.map((card) => card.name));
  const foodCount = selectedCards.filter(isFoodCard).length;
  const loungeCount = selectedCards.filter(isLoungeCard).length;
  if (!selectedCards.length && score <= 30) return "No score-chasing. Start simple and build payment habits first.";
  if (hasCard(selectedNames, "Chase Sapphire Reserve") && hasCard(selectedNames, "Chase Sapphire Preferred")) return "Sapphire Reserve usually makes Sapphire Preferred redundant. Compare the annual fees before keeping both.";
  if (hasCard(selectedNames, "Amex Gold") && foodCount > 1) return "Amex Gold already covers the food lane. Do not add another food card unless it has a specific job.";
  if (loungeCount > 1) return "You already have lounge access. Duplicate premium lounge cards can create fee overlap.";
  if (walletGoalCovered(selectedCards, goal)) return "";
  if (selectedCards.length > 6) return "More cards is not always better. Close the gap only if the card has a job.";
  if (goal === "premium" && fee === "avoid") return "Lounge access usually means annual fees, credits, and rules to track.";
  if (score <= 30 && !lanes.includes(targetLane) && goal !== "food") return "Your goal and current lanes do not fully match yet.";
  return "";
}

function renderWalletResult() {
  if (!walletResult || !walletForm) return;
  if (!walletHasBuilt) {
    walletResult.textContent = "Choose your cards to see missing lanes and next-card ideas.";
    return;
  }

  const selectedCards = [...walletSelected].map((index) => cardProfiles[index]).filter(Boolean);
  const goal = walletForm.querySelector("[data-wallet-goal]").value;
  const spend = walletForm.querySelector("[data-wallet-spend]").value;
  const fee = walletForm.querySelector("[data-wallet-fee]").value;
  const lanes = [...new Set(selectedCards.map(walletLaneGroup))];
  const missing = walletCategories.filter((category) => category !== "All" && !lanes.includes(category));
  const rating = scoreWallet(selectedCards, lanes, goal, fee);
  const businessAllowed = businessCardsAllowed(goal, spend, rating.score);
  const mentionBusinessLane = shouldMentionBusinessLane(goal, spend, rating.score);
  const recs = recommendWalletCards(selectedCards, goal, spend, fee, rating.score);
  const nextMove = nextWalletMove(selectedCards, lanes, missing, rating.targetLane, goal);
  const warning = walletWarning(selectedCards, lanes, goal, fee, rating.targetLane, rating.score);
  const businessLevelUpNote = "Business cards are a level-up lane. Build your personal wallet first, then separate business or side-hustle expenses when they are real.";

  walletResult.innerHTML = `
    <div class="wallet-rating wallet-rating-polished">
      <div class="wallet-score-card" style="--wallet-score:${rating.score}">
        <strong>${rating.score}</strong>
        <span>${rating.label}</span>
      </div>
      <div>
        <span>Your wallet fit</span>
        <h3>${rating.label}. ${nextMove}</h3>
        <div class="wallet-score-line"><i style="width:${rating.score}%"></i></div>
      </div>
    </div>
    <div class="wallet-readout-grid">
      <div class="wallet-setup-tile">
        <span>Covered setup</span>
        <h3>${lanes.length ? lanes.join(" + ") : "No cards selected yet"}</h3>
        <p>${selectedCards.length ? "Your setup has a foundation. These next cards could fill missing jobs." : "Start with a beginner or flat cash-back lane before premium travel cards."}</p>
      </div>
      <div class="wallet-lane-tile">
        <span>Covered Lanes</span>
        <div class="wallet-mini-pills">${lanes.length ? lanes.map((lane) => `<strong>${lane}</strong>`).join("") : "<strong>None yet</strong>"}</div>
      </div>
      <div class="wallet-lane-tile missing">
        <span>Missing Lanes</span>
        <div class="wallet-mini-pills missing">${missing.length ? missing.map((lane) => `<strong>${lane}</strong>`).join("") : "<strong>Core lanes covered</strong>"}</div>
      </div>
      <div class="wallet-next-move">
        <span>Next Best Move</span>
        <strong>${nextMove}</strong>
      </div>
    </div>
    <div class="wallet-suggested-title"><span>Suggested Cards</span></div>
    <div class="wallet-recs">
      ${recs.length ? recs.map(({ card, reason }) => `
        <article class="database-card">
          ${cardArtMarkup(card)}
          <span>${walletLaneGroup(card)}</span>
          <h3>${card.name}</h3>
          <div class="wallet-card-fee"><span>Annual fee</span><strong>${card.fee}</strong></div>
          <p>${reason}</p>
          <div class="perk-list">${card.perks.slice(0, 3).map((perk) => `<span>${perk}</span>`).join("")}</div>
        </article>
      `).join("") : `<article class="database-card"><span>Wallet read</span><h3>No obvious gap</h3><p>Your selected cards already cover the main lane for this goal. Compare fees and real usage before adding more.</p></article>`}
    </div>
    ${!businessAllowed && mentionBusinessLane ? `<div class="wallet-warning"><span>Business lane</span><p>${businessLevelUpNote}</p></div>` : ""}
    ${warning ? `<div class="wallet-warning"><span>Quick warning</span><p>${warning}</p></div>` : ""}
    <p class="small-note">Educational only. No score-chasing. More cards is not always better. A clean wallet has purpose.</p>
  `;
}

walletFilters?.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-wallet-filter]");
  if (!button) return;
  activeWalletFilter = button.dataset.walletFilter;
  renderWalletFilters();
  renderWalletOptions();
});

walletOptions?.addEventListener("click", (event) => {
  const clearButton = event.target.closest("[data-wallet-clear]");
  if (!clearButton) return;
  walletSelected.clear();
  walletHasBuilt = false;
  renderWalletOptions();
  renderWalletResult();
});

walletOptions?.addEventListener("change", (event) => {
  const input = event.target.closest("[data-wallet-card]");
  if (!input) return;
  const index = Number(input.value);
  if (input.checked) walletSelected.add(index);
  else walletSelected.delete(index);
  const clearButton = walletOptions.querySelector("[data-wallet-clear]");
  if (clearButton) clearButton.disabled = walletSelected.size === 0;
  if (walletHasBuilt) renderWalletResult();
});

walletForm?.addEventListener("change", (event) => {
  if (event.target.matches("[data-wallet-goal], [data-wallet-spend], [data-wallet-fee]")) {
    if (walletHasBuilt) renderWalletResult();
  }
});

walletForm?.addEventListener("submit", (event) => {
  event.preventDefault();
  walletHasBuilt = true;
  renderWalletResult();
  walletResult.scrollIntoView({ behavior: "smooth", block: "start" });
});

renderWalletFilters();
renderWalletOptions();
renderWalletResult();

const tabCopy = {
  stocks: ["Stocks: what to look for", "Commission-free trading, research tools, order types, news, screeners, and a platform you can understand."],
  etfs: ["ETFs: what to look for", "Low expense ratios, broad diversification, fractional shares, and automatic dividend reinvestment can help long-term investors."],
  bonds: ["Bonds: what to look for", "Check Treasury, municipal, and corporate bond access, ratings, laddering tools, and yield transparency."],
  funds: ["Mutual funds: what to look for", "Look for no-transaction-fee funds, low minimums, strong fund selection, and clear expense ratios."],
  retirement: ["Retirement accounts: what to look for", "Confirm Roth IRA, traditional IRA, SEP IRA, beneficiaries, automatic investing, and support for transfers."],
};

document.querySelector("[data-tabs]")?.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-tab]");
  if (!button) return;
  const tabs = button.closest("[data-tabs]");
  tabs.querySelectorAll("[data-tab]").forEach((tab) => tab.classList.remove("is-active"));
  button.classList.add("is-active");
  const [title, body] = tabCopy[button.dataset.tab];
  tabs.querySelector("[data-panel]").innerHTML = `<h2>${title}</h2><p>${body}</p>`;
});

const stepCopy = [
  ["Check eligibility first", "Review earned income, annual contribution limits, income phaseouts, filing status, and whether a direct Roth IRA contribution is available."],
  ["Choose the account home", "Compare brokerage fees, fund menus, automation, beneficiary tools, research, and customer support."],
  ["Build an investment framework", "Teach diversification, time horizon, low costs, and risk instead of making hot stock calls."],
  ["Map the backdoor path", "Understand nondeductible traditional IRA contributions, Roth conversions, the pro-rata rule, and Form 8606."],
];

document.querySelector("[data-stepper]")?.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-step]");
  if (!button) return;
  const stepper = button.closest("[data-stepper]");
  stepper.querySelectorAll("button[data-step]").forEach((step) => step.classList.remove("is-active"));
  button.classList.add("is-active");
  const [title, body] = stepCopy[Number(button.dataset.step)];
  stepper.querySelector("[data-step-content]").innerHTML = `<h2>${title}</h2><p>${body}</p>`;
});

const checkingForm = document.querySelector("[data-checking-form]");
const checkingResult = document.querySelector("[data-checking-result]");

checkingForm?.addEventListener("submit", (event) => {
  event.preventDefault();
  const form = new FormData(checkingForm);
  const branch = form.get("branch");
  const cash = form.get("cash");
  const priority = form.get("priority");
  const student = form.get("student");
  let fit = {
    title: "Online-First Banker",
    explanation: "You likely care most about a clean app, low fees, and direct deposit tools.",
    examples: ["SoFi Checking and Savings", "Capital One 360 Checking", "American Express Rewards Checking"],
    warning: "Online-first accounts may not work well if you need branch help or cash deposits.",
    rule: "Checking should make daily money easy to move."
  };

  if (student === "yes") {
    fit = {
      title: "Student / Simple Setup",
      explanation: "You need low friction, low fees, and a setup that is easy to manage.",
      examples: ["Chase College Checking", "Bank of America Advantage SafeBalance", "Capital One 360 Checking"],
      warning: "Research fee rules and avoid overdraft habits early.",
      rule: "Start simple before chasing bonuses."
    };
  } else if (cash === "yes") {
    fit = {
      title: "Cash-Heavy User",
      explanation: "Cash deposits and branch access matter more than app-only convenience.",
      examples: ["Chase Total Checking", "Wells Fargo Everyday Checking", "Bank of America Advantage Banking"],
      warning: "Online banks may be frustrating if you deposit cash often.",
      rule: "Access beats APY when cash is part of your routine."
    };
  } else if (branch === "often" || branch === "sometimes") {
    fit = {
      title: "Branch Banker",
      explanation: "You probably want a bank with real locations, ATMs, Zelle, and support.",
      examples: ["Chase Total Checking", "Capital One 360 Checking", "Wells Fargo Everyday Checking"],
      warning: "Monthly fees can erase the benefit if you miss waiver rules.",
      rule: "Research the fee waiver before the bonus."
    };
  } else if (priority === "rewards") {
    fit = {
      title: "Rewards Checking User",
      explanation: "You want checking that gives a little value back without becoming complicated.",
      examples: ["American Express Rewards Checking", "SoFi Checking and Savings"],
      warning: "Debit rewards are usually smaller than credit-card rewards.",
      rule: "Rewards are extra. Reliability comes first."
    };
  } else if (priority === "bonus") {
    fit = {
      title: "Bonus Hunter",
      explanation: "You care about welcome bonuses, direct deposit rules, and timing.",
      examples: ["Chase Total Checking", "American Express Rewards Checking", "Wells Fargo Everyday Checking"],
      warning: "Do not switch banks for a bonus you cannot qualify for naturally.",
      rule: "A bonus is only good if the requirements fit your real paycheck."
    };
  }

  checkingResult.innerHTML = `
    <div class="checking-result-head">
      <span>Your fit</span>
      <h3>${fit.title}</h3>
      <p>${fit.explanation}</p>
    </div>
    <div class="checking-result-block">
      <span>Get one of these</span>
      <div class="result-examples">${fit.examples.map((item) => `<strong>${item}</strong>`).join("")}</div>
    </div>
    <div class="checking-result-two">
      <p><strong>Warning</strong>${fit.warning}</p>
      <p><strong>LifeScore rule</strong>${fit.rule}</p>
    </div>
  `;
});

const brokerageForm = document.querySelector("[data-brokerage-form]");
const brokerageResult = document.querySelector("[data-brokerage-result]");

brokerageForm?.addEventListener("submit", (event) => {
  event.preventDefault();
  const goal = brokerageForm.querySelector("[data-brokerage-goal]").value;
  const complexity = brokerageForm.querySelector("[data-brokerage-complexity]").value;
  const retirement = brokerageForm.querySelector("[data-brokerage-retirement]").value;
  let result = "";

  if (goal === "active" || complexity === "high") {
    result = "Your fit: advanced tools. Start by comparing Fidelity, Schwab, and platform education before touching margin, options, or active trading.";
  } else if (goal === "bank") {
    result = "Your fit: bank ecosystem user. J.P. Morgan Self-Directed or SoFi-style bundled finance can make sense if keeping accounts together matters.";
  } else if (goal === "beginner" && complexity === "low") {
    result = "Your fit: beginner app user. Robinhood or SoFi-style apps are simple, but set guardrails so easy trading does not become overtrading.";
  } else if (retirement === "yes") {
    result = "Your fit: retirement-focused investor. Fidelity, Schwab, and Vanguard-style platforms are strong lanes for Roth IRA and long-term investing.";
  } else {
    result = "Your fit: long-term index investor. Compare Fidelity, Schwab, and Vanguard for ETFs, index funds, low costs, and automation.";
  }

  brokerageResult.textContent = result;
});

const rothForm = document.querySelector("[data-roth-form]");
const rothResult = document.querySelector("[data-roth-result]");

rothForm?.addEventListener("submit", (event) => {
  event.preventDefault();
  const income = rothForm.querySelector("[data-roth-income]").value;
  const level = rothForm.querySelector("[data-roth-level]").value;
  const invested = rothForm.querySelector("[data-roth-invested]").value;
  let result = "";

  if (income === "no") {
    result = "Result: not ready because there is no earned income. Learn the rules before contributing.";
  } else if (level === "high") {
    result = "Result: income may be too high for a direct Roth IRA contribution. Learn the advanced backdoor Roth rules and talk with a tax professional.";
  } else if (level === "maybe") {
    result = "Result: maybe eligible. Check filing status, modified AGI, phaseout ranges, and contribution limits before funding.";
  } else if (invested === "no") {
    result = "Result: eligible framework, but not finished. Opening the Roth IRA is just the container; choose investments inside it.";
  } else {
    result = "Result: eligible framework. Confirm the current-year limit, fund the account, choose investments, and keep records.";
  }

  rothResult.textContent = result;
});

document.querySelector(".guidance-form")?.addEventListener("submit", (event) => {
  event.preventDefault();
  const button = event.currentTarget.querySelector("button[type='submit']");
  button.textContent = "Review request noted";
});

const noteForm = document.querySelector("[data-note-form]");
const noteText = document.querySelector("[data-note-text]");
const noteTags = document.querySelector("[data-note-tags]");
const noteSearch = document.querySelector("[data-note-search]");
const noteList = document.querySelector("[data-notes-list]");
const tagFilter = document.querySelector("[data-tag-filter]");
const noteSubmit = document.querySelector("[data-note-submit]");
const noteCancel = document.querySelector("[data-note-cancel]");
const noteStorageKey = "lifescore-notes";
let activeTag = "all";
let editingNoteId = null;

const starterNotes = [
  {
    id: 1,
    content: "Compare CIT's higher APY tier against accounts with no minimum deposit. Check whether the balance requirement fits the emergency fund amount.",
    tags: ["hysa", "rates"],
    createdAt: "Starter",
  },
  {
    id: 2,
    content: "Card type framework: cash back for simple everyday rewards, travel for points strategy, balance transfer for payoff windows, secured/student for credit building.",
    tags: ["cards", "basics"],
    createdAt: "Starter",
  },
  {
    id: 3,
    content: "Backdoor Roth article needs a clear warning about the pro-rata rule and Form 8606. Keep it educational, not tax advice.",
    tags: ["roth", "tax"],
    createdAt: "Starter",
  },
];

function loadNotes() {
  if (!noteList) return [];
  const stored = localStorage.getItem(noteStorageKey);
  if (stored) {
    try {
      return JSON.parse(stored);
    } catch {
      localStorage.removeItem(noteStorageKey);
    }
  }
  localStorage.setItem(noteStorageKey, JSON.stringify(starterNotes));
  return starterNotes;
}

let notes = loadNotes();

function saveNotes() {
  localStorage.setItem(noteStorageKey, JSON.stringify(notes));
}

function normalizeTags(value) {
  return value
    .split(",")
    .map((tag) => tag.trim().toLowerCase())
    .filter(Boolean)
    .slice(0, 5);
}

function getFilteredNotes() {
  const query = noteSearch?.value.trim().toLowerCase() || "";
  return notes.filter((note) => {
    const matchesQuery =
      !query ||
      note.content.toLowerCase().includes(query) ||
      note.tags.some((tag) => tag.includes(query));
    const matchesTag = activeTag === "all" || note.tags.includes(activeTag);
    return matchesQuery && matchesTag;
  });
}

function renderTagFilters() {
  if (!tagFilter) return;
  const tags = Array.from(new Set(notes.flatMap((note) => note.tags))).sort();
  tagFilter.replaceChildren();
  ["all", ...tags].forEach((tag) => {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = tag === "all" ? "All notes" : `#${tag}`;
    button.dataset.tag = tag;
    button.classList.toggle("is-active", tag === activeTag);
    tagFilter.append(button);
  });
}

function renderNotes() {
  if (!noteList) return;
  renderTagFilters();
  const filtered = getFilteredNotes();
  noteList.replaceChildren();

  if (!filtered.length) {
    const empty = document.createElement("p");
    empty.className = "note-empty";
    empty.textContent = "No notes match this search yet.";
    noteList.append(empty);
    return;
  }

  filtered.forEach((note) => {
    const card = document.createElement("article");
    card.className = "note-card";

    const content = document.createElement("p");
    content.className = "note-content";
    content.textContent = note.content;
    card.append(content);

    const tags = document.createElement("div");
    tags.className = "note-tags";
    note.tags.forEach((tag) => {
      const tagButton = document.createElement("button");
      tagButton.type = "button";
      tagButton.textContent = `#${tag}`;
      tagButton.dataset.tag = tag;
      tags.append(tagButton);
    });
    card.append(tags);

    const actions = document.createElement("div");
    actions.className = "note-actions";
    const edit = document.createElement("button");
    edit.type = "button";
    edit.className = "note-action";
    edit.textContent = "Edit";
    edit.dataset.editNote = String(note.id);
    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "note-action";
    remove.textContent = "Delete";
    remove.dataset.deleteNote = String(note.id);
    actions.append(edit, remove);
    card.append(actions);
    noteList.append(card);
  });
}

noteForm?.addEventListener("submit", (event) => {
  event.preventDefault();
  const content = noteText.value.trim();
  const tags = normalizeTags(noteTags.value || "general");
  if (!content) {
    noteText.focus();
    return;
  }

  if (editingNoteId) {
    notes = notes.map((note) =>
      note.id === editingNoteId ? { ...note, content, tags } : note
    );
  } else {
    notes.unshift({
      id: Date.now(),
      content,
      tags,
      createdAt: new Date().toISOString(),
    });
  }

  editingNoteId = null;
  noteSubmit.textContent = "Add note";
  noteCancel.hidden = true;
  noteForm.reset();
  saveNotes();
  renderNotes();
});

noteCancel?.addEventListener("click", () => {
  editingNoteId = null;
  noteSubmit.textContent = "Add note";
  noteCancel.hidden = true;
  noteForm.reset();
});

noteSearch?.addEventListener("input", renderNotes);

tagFilter?.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-tag]");
  if (!button) return;
  activeTag = button.dataset.tag;
  renderNotes();
});

noteList?.addEventListener("click", (event) => {
  const tagButton = event.target.closest("button[data-tag]");
  if (tagButton) {
    activeTag = tagButton.dataset.tag;
    renderNotes();
    return;
  }

  const editButton = event.target.closest("button[data-edit-note]");
  if (editButton) {
    const note = notes.find((item) => item.id === Number(editButton.dataset.editNote));
    if (!note) return;
    editingNoteId = note.id;
    noteText.value = note.content;
    noteTags.value = note.tags.join(", ");
    noteSubmit.textContent = "Save note";
    noteCancel.hidden = false;
    noteText.focus();
    return;
  }

  const deleteButton = event.target.closest("button[data-delete-note]");
  if (deleteButton) {
    notes = notes.filter((note) => note.id !== Number(deleteButton.dataset.deleteNote));
    if (!notes.some((note) => note.tags.includes(activeTag))) activeTag = "all";
    saveNotes();
    renderNotes();
  }
});

renderNotes();

const loungeMap = document.querySelector("[data-lounge-map]");
if (loungeMap) {
  const loungeNotes = {
    JFK: {
      title: "New York JFK",
      body: "Capital One, Chase Sapphire, and Amex Centurion can all matter here. Strong route if you value dining, seating, work areas, and a calmer pre-flight hour.",
      footer: "Best when JFK is actually your route.",
    },
    LAS: {
      title: "Las Vegas Harry Reid",
      body: "Capital One, Chase Sapphire, and Amex examples make this a strong lounge airport. Check food quality, waitlists, and capacity before assuming value.",
      footer: "Good for leisure travel and long waits.",
    },
    DFW: {
      title: "Dallas-Fort Worth",
      body: "Capital One and Amex are the main examples, with Chase Sapphire coming soon. Useful for food, showers in some lounges, and work breaks.",
      footer: "Strong if DFW is home base or a common layover.",
    },
    ORD: {
      title: "Chicago O'Hare",
      body: "ORD is a hub-heavy airport with 14+ lounges. T1/T2 are mainly United, including Polaris near C18 and United Clubs near B6, B18, C10, E7, and F9. T3 is American territory with Flagship and Admirals Club options. T5 carries Delta, Air France, LOT, and Swissport near the M gates.",
      footer: "Best for United, American, and international terminal routes.",
    },
    LGA: {
      title: "New York LaGuardia",
      body: "Capital One Landing and Chase Sapphire Lounge make LGA feel more premium than most domestic airports when your terminal lines up.",
      footer: "Best for premium food and calm seating.",
    },
    IAD: {
      title: "Washington Dulles",
      body: "Capital One Lounge plus Etihad Lounge access for eligible Sapphire Reserve cardmembers. Timing and boarding-pass rules matter here.",
      footer: "Check hours before relying on it.",
    },
    BOS: {
      title: "Boston Logan",
      body: "Chase Sapphire Lounge and Amex examples can help with seasonal dining, drinks, work seating, showers, and nursing-room access.",
      footer: "Solid route-based value.",
    },
    ATL: {
      title: "Atlanta",
      body: "Amex-style value depends heavily on terminal, timing, and crowding. Treat the lounge as a route perk, not the reason to get a card.",
      footer: "Good only when it fits your real airport flow.",
    },
    MIA: {
      title: "Miami",
      body: "Useful for longer international or warm-weather routes. Check guest access, food, shower availability, and walk time before counting it.",
      footer: "Strong when the terminal lines up.",
    },
    LAX: {
      title: "Los Angeles",
      body: "High potential, high friction. Terminal distance and capacity matter more here than the logo on the card.",
      footer: "Verify terminal and waitlist first.",
    },
    DEN: {
      title: "Denver",
      body: "Capital One-style value can be practical for layovers: grab-and-go food, work breaks, drinks, and a calmer reset.",
      footer: "Useful for frequent Denver connections.",
    },
  };

  const note = loungeMap.querySelector("[data-lounge-map-note]");
  const pins = Array.from(loungeMap.querySelectorAll(".map-pin"));

  const setActiveAirport = (code) => {
    const detail = loungeNotes[code];
    if (!detail || !note) return;
    pins.forEach((pin) => pin.classList.toggle("is-active", pin.dataset.airport === code));
    note.innerHTML = `<span>${code}</span><h3>${detail.title}</h3><p>${detail.body}</p><strong>${detail.footer}</strong>`;
  };

  pins.forEach((pin) => {
    const code = pin.dataset.airport;
    pin.addEventListener("mouseenter", () => setActiveAirport(code));
    pin.addEventListener("focus", () => setActiveAirport(code));
    pin.addEventListener("click", () => setActiveAirport(code));
  });
}

const scoreChatStorageKey = "lifescore-score-chat";
const scoreChatVersionKey = `${scoreChatStorageKey}:version`;
const scoreChatVersion = "score-panel-booking-v1";
const scoreBookingStorageKey = `${scoreChatStorageKey}:booking`;
const scoreStarterPrompts = [
  { label: "What tax situations apply to me?", message: "What tax situations might apply to me?" },
  { label: "Build my tax form checklist", message: "Build my tax form checklist for W-2, 1099, 1098-T, and investing activity." },
  { label: "Roth vs brokerage taxes", message: "Explain Roth IRA taxes versus brokerage taxes." },
  { label: "Review my credit setup", message: "Review my credit card setup." },
  { label: "Book a free tax-readiness consultation", message: "I want to book a free LifeScore tax-readiness consultation." },
  { label: "Build my wallet", message: "Build my wallet" },
];

const consultationTopicOptions = [
  "Portfolio review",
  "Investing starter plan",
  "Roth IRA / brokerage setup",
  "Credit card wallet audit",
  "Credit score setup",
  "Tax filing after investing",
  "Budget / money plan",
  "Other",
];

const consultationMethodOptions = ["Discord", "Zoom", "No preference"];

const consultationTriggerPattern = /\b(book a consultation|book a free|book free|book me|reserve a consultation|free consultation|tax-readiness consultation|tax readiness consultation|tax consultation|investing-tax readiness|talk to an advisor|portfolio audit|review my portfolio|review my roth ira|review my brokerage|audit my wallet|audit my credit card setup|audit my card setup|help me pick investments|tax help|help filing taxes|credit card setup review|roth ira help|brokerage account help|can i talk to someone|can someone review|schedule a call|zoom call|discord call)\b/i;

function escapeHtml(value) {
  const div = document.createElement("div");
  div.textContent = value;
  return div.innerHTML;
}

function formatScoreAnswer(value) {
  const safe = escapeHtml(value || "");
  return safe
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, (match, label, href) => {
      const cleanHref = href.trim();
      if (!cleanHref.startsWith("/") && !cleanHref.startsWith("https://")) return label;
      return `<a href="${cleanHref}">${label}</a>`;
    })
    .replace(/\n\n/g, "</p><p>")
    .replace(/\n- /g, "<br><span class=\"score-chat-bullet\">-</span> ")
    .replace(/\n/g, "<br>");
}

function cleanScoreLink(link) {
  if (!link || typeof link !== "object") return null;
  const href = String(link.href || "").trim();
  const label = String(link.label || "Open next page").trim();
  const isInternalPath = href.startsWith("/") || /^[a-z0-9-]+\.html(?:#[a-z0-9_-]+)?$/i.test(href);
  if (!isInternalPath || !label) return null;
  return { href, label };
}

function isConsultationRequest(value) {
  return consultationTriggerPattern.test(String(value || ""));
}

function isValidScoreEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || "").trim());
}

function inferConsultationTopic(value) {
  const text = String(value || "").toLowerCase();
  if (/\b(portfolio|review my portfolio|audit portfolio)\b/.test(text)) return "Portfolio review";
  if (/\b(roth|ira|brokerage)\b/.test(text)) return "Roth IRA / brokerage setup";
  if (/\b(card|wallet|credit card)\b/.test(text)) return "Credit card wallet audit";
  if (/\b(score|fico|credit setup)\b/.test(text)) return "Credit score setup";
  if (/\b(tax|1099|filing)\b/.test(text)) return "Tax filing after investing";
  if (/\b(budget|money plan)\b/.test(text)) return "Budget / money plan";
  if (/\b(invest|starter plan)\b/.test(text)) return "Investing starter plan";
  return "";
}

function readScoreBookingState() {
  try {
    return JSON.parse(sessionStorage.getItem(scoreBookingStorageKey) || "null");
  } catch {
    sessionStorage.removeItem(scoreBookingStorageKey);
    return null;
  }
}

function saveScoreBookingState(state) {
  if (!state) {
    sessionStorage.removeItem(scoreBookingStorageKey);
    return;
  }
  sessionStorage.setItem(scoreBookingStorageKey, JSON.stringify(state));
}

function enhanceLifeScoreNav() {
  document.querySelectorAll(".nav-group").forEach((group) => {
    const parent = group.querySelector(".nav-parent");
    const menu = group.querySelector(".nav-menu");
    if (!parent || !menu || parent.textContent.trim() !== "Finance") return;
    if (!menu.querySelector('a[href="taxes.html"]')) {
      const taxes = document.createElement("a");
      taxes.href = "taxes.html";
      taxes.textContent = "Taxes";
      if (location.pathname.endsWith("/taxes.html")) taxes.setAttribute("aria-current", "page");
      menu.append(taxes);
    }
  });
}

function readScoreHistory() {
  try {
    if (sessionStorage.getItem(scoreChatVersionKey) !== scoreChatVersion) {
      sessionStorage.removeItem(scoreChatStorageKey);
      sessionStorage.setItem(scoreChatVersionKey, scoreChatVersion);
      return [];
    }
    return JSON.parse(sessionStorage.getItem(scoreChatStorageKey) || "[]");
  } catch {
    sessionStorage.removeItem(scoreChatStorageKey);
    sessionStorage.setItem(scoreChatVersionKey, scoreChatVersion);
    return [];
  }
}

function saveScoreHistory(history) {
  sessionStorage.setItem(scoreChatStorageKey, JSON.stringify(history.slice(-12)));
}

function buildScoreChat() {
  if (document.querySelector("[data-score-chat]")) return;

  const launcher = document.createElement("button");
  launcher.type = "button";
  launcher.className = "score-chat-launcher";
  launcher.setAttribute("aria-label", "Ask Score");
  launcher.innerHTML = `<span aria-hidden="true">✦</span><strong>Ask Score</strong>`;

  const backdrop = document.createElement("button");
  backdrop.type = "button";
  backdrop.className = "score-chat-backdrop";
  backdrop.hidden = true;
  backdrop.setAttribute("aria-label", "Close Score");

  const panel = document.createElement("section");
  panel.className = "score-chat-panel";
  panel.dataset.scoreChat = "true";
  panel.hidden = true;
  panel.setAttribute("aria-label", "Score chat");
  panel.innerHTML = `
    <header class="score-chat-header">
      <div>
        <span>Score</span>
        <strong>Your LifeScore finance coach</strong>
      </div>
      <button type="button" class="score-chat-close" aria-label="Close Score">×</button>
    </header>
    <section class="score-chat-welcome" data-score-welcome>
      <p>What can I help with today?</p>
      <div class="score-chat-prompts" data-score-prompts></div>
    </section>
    <div class="score-chat-body" data-score-messages></div>
    <footer class="score-chat-footer">
      <form class="score-chat-form" data-score-form>
        <label class="sr-only" for="score-chat-input">Ask Score</label>
        <textarea id="score-chat-input" name="message" rows="1" placeholder="Ask about credit, saving, investing, or cards..." data-score-input></textarea>
        <button type="submit">Send</button>
      </form>
      <p class="score-chat-guardrail">Educational only. Verify terms before making financial decisions.</p>
    </footer>
  `;

  document.body.append(backdrop, panel, launcher);

  const messagesEl = panel.querySelector("[data-score-messages]");
  const welcomeEl = panel.querySelector("[data-score-welcome]");
  const promptsEl = panel.querySelector("[data-score-prompts]");
  const form = panel.querySelector("[data-score-form]");
  const input = panel.querySelector("[data-score-input]");
  const closeButton = panel.querySelector(".score-chat-close");

  let history = readScoreHistory();
  let bookingState = readScoreBookingState();
  if (!history.some((message) => message.role === "user")) {
    history = [];
    saveScoreHistory(history);
    bookingState = null;
    saveScoreBookingState(null);
  }

  function scrollScoreToBottom() {
    requestAnimationFrame(() => {
      messagesEl.scrollTo({ top: messagesEl.scrollHeight, behavior: "smooth" });
    });
  }

  function renderMessages() {
    messagesEl.replaceChildren();
    const hasMessages = history.length > 0;
    messagesEl.hidden = !hasMessages;
    welcomeEl.hidden = hasMessages;
    if (!hasMessages) {
      messagesEl.scrollTop = 0;
      return;
    }
    history.forEach((message) => {
      const link = cleanScoreLink(message.link);
      const actions = Array.isArray(message.actions) ? message.actions : [];
      const bubble = document.createElement("article");
      bubble.className = `score-chat-message is-${message.role}`;
      bubble.innerHTML = `
        <p>${formatScoreAnswer(message.content)}</p>
        ${message.role === "assistant" && link ? `<a class="score-chat-next-link" href="${escapeHtml(link.href)}">Next: ${escapeHtml(link.label)}</a>` : ""}
        ${message.role === "assistant" && actions.length ? `<div class="score-chat-actions">${actions.map((action) => `<button type="button" data-score-action="${escapeHtml(action.type || "reply")}" data-score-value="${escapeHtml(action.value || action.label || "")}" data-score-label="${escapeHtml(action.label || action.value || "")}">${escapeHtml(action.label || action.value || "")}</button>`).join("")}</div>` : ""}
      `;
      messagesEl.append(bubble);
    });
    scrollScoreToBottom();
  }

  function resetScoreChatState() {
    history = [];
    bookingState = null;
    sessionStorage.removeItem(scoreChatStorageKey);
    sessionStorage.removeItem(scoreBookingStorageKey);
    sessionStorage.setItem(scoreChatVersionKey, scoreChatVersion);
    input.value = "";
    input.style.height = "auto";
    renderMessages();
  }

  async function openScoreChatWithMessage(message = "", options = {}) {
    const cleanMessage = String(message || "").trim();
    if (options.fresh) resetScoreChatState();
    setOpen(true);
    if (cleanMessage) await sendScoreMessage(cleanMessage);
  }

  function renderPrompts() {
    promptsEl.replaceChildren();
    scoreStarterPrompts.forEach((prompt) => {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = prompt.label;
      button.addEventListener("click", () => openScoreChatWithMessage(prompt.message, { fresh: true }));
      promptsEl.append(button);
    });
  }

  function setOpen(isOpen) {
    panel.hidden = !isOpen;
    backdrop.hidden = !isOpen;
    document.body.classList.toggle("score-chat-open", isOpen);
    launcher.setAttribute("aria-expanded", String(isOpen));
    if (isOpen) {
      renderMessages();
      requestAnimationFrame(() => input.focus());
    }
  }

  function addMessage(role, content, link = null, actions = []) {
    const nextMessage = { role, content };
    const cleanLink = cleanScoreLink(link);
    if (cleanLink) nextMessage.link = cleanLink;
    if (Array.isArray(actions) && actions.length) nextMessage.actions = actions.slice(0, 8);
    history.push(nextMessage);
    history = history.slice(-12);
    saveScoreHistory(history);
    renderMessages();
  }

  function setBookingState(nextState) {
    bookingState = nextState;
    saveScoreBookingState(bookingState);
  }

  function actionList(options, type = "reply") {
    return options.map((option) => ({ label: option.label || option, value: option.value || option, type }));
  }

  function askConsultationTopic() {
    setBookingState({ ...bookingState, step: "topic" });
    addMessage("assistant", "What should the session focus on?", null, actionList(consultationTopicOptions));
  }

  function askConsultationMethod() {
    setBookingState({ ...bookingState, step: "method" });
    addMessage("assistant", "How would you prefer to talk: Discord, Zoom, or no preference?", null, actionList(consultationMethodOptions));
  }

  async function askConsultationSlot() {
    setBookingState({ ...bookingState, step: "slot" });
    const loading = { role: "assistant", content: "Checking open consultation times..." };
    history.push(loading);
    renderMessages();
    try {
      const response = await fetch("/api/consultation-slots", { method: "GET" });
      const data = await response.json();
      history = history.filter((item) => item !== loading);
      if (!response.ok || !data.available) {
        addMessage("assistant", "Booking is almost ready, but scheduling is not enabled yet. You can still ask Score questions here. Once LifeScore scheduling is enabled, this flow will reserve your slot and send confirmation.");
        setBookingState(null);
        return;
      }
      addMessage(
        "assistant",
        "Perfect. Pick one of these open times. Times are Eastern. You can also type a clear time like Saturday at 11am.",
        null,
        actionList((data.slots || []).map((slot) => ({ label: slot.label, value: slot.iso })), "slot")
      );
    } catch {
      history = history.filter((item) => item !== loading);
      addMessage("assistant", "Booking is almost ready, but scheduling is not enabled yet. You can still ask Score questions here. Once LifeScore scheduling is enabled, this flow will reserve your slot and send confirmation.");
      setBookingState(null);
    }
  }

  function startConsultationBooking(seedMessage = "") {
    const topic = inferConsultationTopic(seedMessage);
    setBookingState({ step: "name", data: topic ? { topic } : {} });
    addMessage(
      "assistant",
      "Got it. I can help book a free educational LifeScore consultation. What's your full name?\n\nDo not share SSNs, passwords, full account numbers, tax IDs, or login credentials."
    );
  }

  function consultationSummary(data) {
    const topic = data.topic || "Other";
    const method = data.callMethod || "No preference";
    const time = data.slotLabel || data.slotText || data.slotIso || "Selected time";
    const notes = data.notes ? data.notes : "No notes";
    return [
      "Before I reserve it, here's what I have:",
      "",
      `Name: ${data.fullName}`,
      `Email: ${data.email}`,
      `Focus: ${topic}`,
      `Method: ${method}`,
      `Time: ${time}`,
      `Notes: ${notes}`,
      "",
      "Confirm if this looks right."
    ].join("\n");
  }

  async function submitConsultationBooking() {
    const data = bookingState?.data || {};
    const loading = { role: "assistant", content: "Reserving the slot and sending confirmation..." };
    history.push(loading);
    renderMessages();
    try {
      const response = await fetch("/api/book-consultation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const result = await response.json();
      history = history.filter((item) => item !== loading);
      if (!response.ok || !result.booked) {
        const slotActions = Array.isArray(result.openSlots) ? actionList(result.openSlots.map((slot) => ({ label: slot.label, value: slot.iso })), "slot") : [];
        if (slotActions.length) setBookingState({ ...bookingState, step: "slot" });
        addMessage("assistant", result.error || "Score could not reserve that consultation right now.", null, slotActions);
        if (!slotActions.length) setBookingState(null);
        return;
      }
      addMessage("assistant", result.message || "Booked. You'll get a confirmation email now, and Amir will reply with next steps/the final Discord or Zoom link. Educational only - don't send SSNs, passwords, or full account numbers.");
      setBookingState(null);
    } catch {
      history = history.filter((item) => item !== loading);
      addMessage("assistant", "Booking is temporarily unavailable, but you can still ask Score tax questions here. Try again once scheduling is enabled.");
      setBookingState(null);
    }
  }

  async function processConsultationReply(value, displayValue = value) {
    const reply = String(value || "").trim();
    const state = bookingState || { step: "name", data: {} };
    const data = { ...(state.data || {}) };

    if (state.step === "name") {
      if (reply.length < 2) {
        addMessage("assistant", "Can you send your full name first?");
        return;
      }
      data.fullName = reply;
      setBookingState({ step: "email", data });
      addMessage("assistant", "Thanks. What email should I use for the confirmation?");
      return;
    }

    if (state.step === "email") {
      if (!isValidScoreEmail(reply)) {
        addMessage("assistant", "That email does not look right. Can you try typing it again?");
        return;
      }
      data.email = reply.toLowerCase();
      setBookingState({ step: "topic", data });
      if (data.topic) {
        addMessage("assistant", `Topic set: ${data.topic}.`);
        askConsultationMethod();
      } else {
        askConsultationTopic();
      }
      return;
    }

    if (state.step === "topic") {
      data.topic = consultationTopicOptions.includes(reply) ? reply : "Other";
      setBookingState({ step: "method", data });
      askConsultationMethod();
      return;
    }

    if (state.step === "method") {
      data.callMethod = consultationMethodOptions.includes(reply) ? reply : "No preference";
      if (data.callMethod === "Discord") {
        setBookingState({ step: "discord", data });
        addMessage("assistant", "No problem. Send your Discord handle.");
      } else {
        setBookingState({ step: "slot", data });
        await askConsultationSlot();
      }
      return;
    }

    if (state.step === "discord") {
      data.discordHandle = reply;
      setBookingState({ step: "slot", data });
      await askConsultationSlot();
      return;
    }

    if (state.step === "slot") {
      if (/^\d{4}-\d{2}-\d{2}T/.test(reply)) {
        data.slotIso = reply;
        data.slotLabel = String(displayValue || reply).trim();
        delete data.slotText;
      } else {
        data.slotText = reply;
        delete data.slotLabel;
        delete data.slotIso;
      }
      setBookingState({ step: "notes", data });
      addMessage("assistant", "Any notes for Amir? Type skip if not. Do not include SSNs, passwords, full account numbers, or sensitive tax IDs.");
      return;
    }

    if (state.step === "notes") {
      data.notes = /^skip$/i.test(reply) ? "" : reply;
      setBookingState({ step: "confirm", data });
      addMessage("assistant", consultationSummary(data), null, [
        { label: "Confirm booking", value: "__confirm_booking", type: "reply" },
        { label: "Pick a different time", value: "__change_slot", type: "reply" },
      ]);
      return;
    }

    if (state.step === "confirm") {
      if (reply === "__change_slot" || /\b(change|different|time|slot)\b/i.test(reply)) {
        setBookingState({ step: "slot", data });
        await askConsultationSlot();
        return;
      }
      if (reply !== "__confirm_booking" && !/\b(confirm|book|yes|looks good|right)\b/i.test(reply)) {
        addMessage("assistant", "Confirm the booking if it looks right, or pick a different time.");
        return;
      }
      setBookingState({ step: "submitting", data });
      await submitConsultationBooking();
    }
  }

  async function sendScoreMessage(content) {
    if (bookingState) {
      addMessage("user", content);
      await processConsultationReply(content);
      return;
    }

    if (isConsultationRequest(content)) {
      addMessage("user", content);
      startConsultationBooking(content);
      return;
    }

    addMessage("user", content);
    const loading = { role: "assistant", content: "Thinking through the LifeScore rules..." };
    history.push(loading);
    renderMessages();

    try {
      const response = await fetch("/api/score-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: content,
          history: history.filter((item) => item !== loading).slice(-8),
        }),
      });
      const data = await response.json();
      history = history.filter((item) => item !== loading);
      addMessage("assistant", data.answer || data.error || "Score could not answer that yet. Try again.", data.link);
    } catch {
      history = history.filter((item) => item !== loading);
      addMessage("assistant", "Score is in demo mode.\n\n- Avoid carrying balances\n- Verify card terms\n- Educational only");
    }
  }

  launcher.addEventListener("click", () => setOpen(true));
  closeButton.addEventListener("click", () => setOpen(false));
  backdrop.addEventListener("click", () => setOpen(false));
  messagesEl.addEventListener("click", async (event) => {
    const action = event.target.closest("[data-score-action]");
    if (!action) return;
    const value = action.dataset.scoreValue || action.textContent.trim();
    const label = action.dataset.scoreLabel || action.textContent.trim();
    if (!bookingState && isConsultationRequest(value)) {
      await openScoreChatWithMessage(value, { fresh: true });
      return;
    }
    if (!bookingState) return;
    addMessage("user", label);
    await processConsultationReply(value, label);
  });
  document.addEventListener("click", (event) => {
    const trigger = event.target.closest("[data-score-open]");
    if (!trigger) return;
    event.preventDefault();
    const message = trigger.dataset.scoreMessage || "I want to book a free LifeScore consultation";
    openScoreChatWithMessage(message, { fresh: true });
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !panel.hidden) setOpen(false);
  });

  input.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      form.requestSubmit();
    }
  });

  input.addEventListener("input", () => {
    input.style.height = "auto";
    input.style.height = `${Math.min(input.scrollHeight, 110)}px`;
  });

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const content = input.value.trim();
    if (!content) return;
    input.value = "";
    input.style.height = "auto";
    sendScoreMessage(content);
  });

  renderMessages();
  renderPrompts();

  window.openScoreChatWithMessage = (message = "") => {
    openScoreChatWithMessage(message, { fresh: true });
  };
  window.resetScoreChatState = resetScoreChatState;
}

function registerLifeScorePwa() {
  if (!("serviceWorker" in navigator)) return;
  if (window.location.protocol === "file:") return;

  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => undefined);
  });
}

function buildLifeScoreInstallPrompt() {
  const isStandalone =
    window.matchMedia?.("(display-mode: standalone)")?.matches ||
    window.navigator.standalone === true;
  if (isStandalone || localStorage.getItem("lifescore-install-dismissed") === "true") return;

  let deferredInstallPrompt = null;
  const isIos = /iphone|ipad|ipod/i.test(window.navigator.userAgent);
  const isChrome = /chrome|crios/i.test(window.navigator.userAgent) && !/edg|opr|samsung/i.test(window.navigator.userAgent);

  const card = document.createElement("div");
  card.className = "pwa-install-card";
  card.hidden = true;
  card.innerHTML = `
    <button class="pwa-install-action" type="button" aria-label="Install LifeScore app">
      <span>LifeScore app</span>
      <strong>Install</strong>
    </button>
    <button class="pwa-install-close" type="button" aria-label="Dismiss install prompt">×</button>
    <p class="pwa-install-help" hidden></p>
  `;
  document.body.append(card);

  const action = card.querySelector(".pwa-install-action");
  const actionLabel = action.querySelector("strong");
  const close = card.querySelector(".pwa-install-close");
  const help = card.querySelector(".pwa-install-help");

  function showInstallCard(label = "Install") {
    actionLabel.textContent = label;
    card.hidden = false;
  }

  function showInstallHelp() {
    help.hidden = false;
    if (isIos) {
      help.textContent = "On iPhone, open LifeScore in Safari, then Add to Home Screen. Chrome on iPhone does not allow a direct install button yet.";
      return;
    }
    if (isChrome) {
      help.textContent = "In Chrome, use the install icon in the address bar or the three-dot menu, then choose Install app or Add to Home screen.";
      return;
    }
    help.textContent = "Use your browser menu and choose Install app or Add to Home screen.";
  }

  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferredInstallPrompt = event;
    showInstallCard("Install");
  });

  window.addEventListener("appinstalled", () => {
    localStorage.setItem("lifescore-install-dismissed", "true");
    card.hidden = true;
  });

  window.addEventListener("load", () => {
    window.setTimeout(() => {
      if (!deferredInstallPrompt && !card.hidden) return;
      if (!deferredInstallPrompt) showInstallCard(isIos ? "Add" : "Install");
    }, 1800);
  });

  action.addEventListener("click", async () => {
    if (!deferredInstallPrompt) {
      showInstallHelp();
      return;
    }

    deferredInstallPrompt.prompt();
    const choice = await deferredInstallPrompt.userChoice.catch(() => null);
    deferredInstallPrompt = null;
    if (choice?.outcome === "accepted") {
      localStorage.setItem("lifescore-install-dismissed", "true");
      card.hidden = true;
      return;
    }
    showInstallHelp();
  });

  close.addEventListener("click", () => {
    localStorage.setItem("lifescore-install-dismissed", "true");
    card.hidden = true;
  });
}

enhanceLifeScoreNav();
hydrateWeeklyTip();
buildScoreChat();
registerLifeScorePwa();
buildLifeScoreInstallPrompt();

window.LifeScoreWeeklyTips = {
  getNewYorkDateKey,
  getCurrentFridayKey,
  selectWeeklyTip,
  hydrateWeeklyTip,
};
