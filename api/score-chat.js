const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-4.1-mini";

const pageLinks = {
  student_credit: { label: "Student Credit Guide", href: "/student-credit-guide.html" },
  credit_score: { label: "Credit Score Maxing", href: "/credit-score.html" },
  cards: { label: "Compare Cards", href: "/cards.html" },
  wallet: { label: "Wallet Builder", href: "/wallet.html" },
  travel_cards: { label: "Travel Cards", href: "/travel-cards.html" },
  saving: { label: "HYSA Guide", href: "/hysa.html" },
  investing: { label: "Investing Guide", href: "/investing.html" },
  roth: { label: "Roth IRA Guide", href: "/investing.html#ira" },
  checking: { label: "Checking Guide", href: "/checking.html" },
  taxes: { label: "Tax Filing Guide", href: "/taxes.html" },
};

const walletLanes = ["Student / Beginner", "Cash Back", "Travel", "Premium", "Business"];

const cardSignals = [
  { name: "Chase Freedom Rise", aliases: ["chase freedom rise", "freedom rise"], lane: "Student / Beginner", ecosystem: "Chase", beginner: true },
  { name: "Capital One Savor Student", aliases: ["capital one savor student", "savor student"], lane: "Student / Beginner", ecosystem: "Capital One", beginner: true, food: true },
  { name: "Capital One Platinum Secured", aliases: ["capital one platinum secured", "platinum secured"], lane: "Student / Beginner", ecosystem: "Capital One", beginner: true },
  { name: "Chase Freedom Unlimited", aliases: ["chase freedom unlimited", "freedom unlimited", "cfu"], lane: "Cash Back", ecosystem: "Chase", chaseFreedom: true },
  { name: "Chase Freedom Flex", aliases: ["chase freedom flex", "freedom flex", "cff"], lane: "Cash Back", ecosystem: "Chase", chaseFreedom: true },
  { name: "Capital One Savor", aliases: ["capital one savor", "savor card", "savor"], lane: "Cash Back", ecosystem: "Capital One", food: true, capitalOneFoundation: true },
  { name: "Capital One Quicksilver", aliases: ["capital one quicksilver", "quicksilver"], lane: "Cash Back", ecosystem: "Capital One", capitalOneFoundation: true },
  { name: "Amex Gold", aliases: ["amex gold", "american express gold", "gold card"], lane: "Cash Back", ecosystem: "Amex", food: true },
  { name: "Amex Blue Cash Preferred", aliases: ["amex blue cash preferred", "blue cash preferred", "bcp"], lane: "Cash Back", ecosystem: "Amex", food: true },
  { name: "Amex Blue Cash Everyday", aliases: ["amex blue cash everyday", "blue cash everyday", "bce"], lane: "Cash Back", ecosystem: "Amex", food: true },
  { name: "Wells Fargo Active Cash", aliases: ["wells fargo active cash", "active cash"], lane: "Cash Back", ecosystem: "Wells Fargo" },
  { name: "Citi Double Cash", aliases: ["citi double cash", "double cash"], lane: "Cash Back", ecosystem: "Citi" },
  { name: "Apple Card", aliases: ["apple card"], lane: "Cash Back", ecosystem: "Apple" },
  { name: "Chase Sapphire Preferred", aliases: ["chase sapphire preferred", "sapphire preferred", "csp"], lane: "Travel", ecosystem: "Chase", transfer: true },
  { name: "Chase Sapphire Reserve", aliases: ["chase sapphire reserve", "sapphire reserve", "csr"], lane: "Premium", ecosystem: "Chase", transfer: true, lounge: true },
  { name: "Capital One VentureOne", aliases: ["capital one ventureone", "ventureone"], lane: "Travel", ecosystem: "Capital One" },
  { name: "Capital One Venture", aliases: ["capital one venture", "venture card"], lane: "Travel", ecosystem: "Capital One" },
  { name: "Capital One Venture X", aliases: ["capital one venture x", "venture x"], lane: "Premium", ecosystem: "Capital One", lounge: true },
  { name: "Amex Platinum", aliases: ["amex platinum", "american express platinum", "platinum card"], lane: "Premium", ecosystem: "Amex", lounge: true },
  { name: "Wells Fargo Autograph", aliases: ["wells fargo autograph", "autograph"], lane: "Travel", ecosystem: "Wells Fargo" },
  { name: "Ink Business Cash", aliases: ["ink business cash"], lane: "Business", ecosystem: "Chase" },
  { name: "Ink Business Unlimited", aliases: ["ink business unlimited"], lane: "Business", ecosystem: "Chase" },
  { name: "Amex Blue Business Plus", aliases: ["amex blue business plus", "blue business plus", "bbp"], lane: "Business", ecosystem: "Amex" },
  { name: "Amex Blue Business Cash", aliases: ["amex blue business cash", "blue business cash"], lane: "Business", ecosystem: "Amex" },
  { name: "Amex Business Platinum", aliases: ["amex business platinum", "business platinum"], lane: "Business", ecosystem: "Amex", lounge: true },
  { name: "Ramp Card", aliases: ["ramp card", "ramp"], lane: "Business", ecosystem: "Ramp" },
];

function sendJson(response, status, body) {
  response.setHeader("Cache-Control", "no-store");
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  return response.status(status).json(body);
}

function normalizeText(value, maxLength = 1800) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, maxLength);
}

function classifyQuestion(message) {
  const text = message.toLowerCase();
  const checks = [
    ["consulting", /\b(book a consultation|book a free|book free|book me|reserve a consultation|free consultation|tax-readiness consultation|tax readiness consultation|tax consultation|investing-tax readiness|talk to an advisor|portfolio audit|review my portfolio|review my roth ira|review my brokerage|audit my wallet|audit my credit card setup|audit my card setup|schedule a call|zoom call|discord call|can i talk to someone|can someone review|credit card setup review)\b/],
    ["taxes", /\b(tax|taxes|file taxes|filing taxes|1099|1098-t|1098-e|w-2|w2|aotc|american opportunity credit|lifetime learning credit|llc tax credit|student loan interest|dividend|capital gains|sold stocks|hysa interest|roth ira taxes|brokerage taxes|side hustle taxes|self employment tax|business deduction|home office|mileage deduction|estimated taxes|irs|refund|standard deduction|itemize|free file)\b/],
    ["unsafe", /\b(carry a balance|minimum payment only|cash advance|borrow to invest|payday|gamble|options trading|meme coin|leverage)\b/],
    ["credit_score", /\b(fico|credit score|utilization|statement date|reported balance|credit report|hard inquiry|inquiries)\b/],
    ["wallet", /\b(wallet|next card|add next|card setup|covered lanes|missing lanes|which card|what card)\b/],
    ["cards", /\b(credit card|best card|card for|annual fee|welcome bonus|cash back|travel card|sapphire|amex|capital one|chase|approval)\b/],
    ["investing", /\b(roth|ira|invest|investing|etf|vti|vxus|brokerage|stocks|market)\b/],
    ["saving", /\b(hysa|savings|emergency fund|save|apy|interest rate|short term money)\b/],
    ["checking", /\b(checking|bank account|debit|atm|direct deposit|cash management)\b/],
    ["budgeting", /\b(budget|paycheck|income|expenses|rent|monthly|spend)\b/],
    ["affordability", /\b(afford|buy this|purchase|worth it|should i buy)\b/],
  ];
  return checks.find(([, pattern]) => pattern.test(text))?.[0] || "general";
}

function detectSubIntent(message) {
  const text = message.toLowerCase();
  if (/\b(book a consultation|book a free|book free|book me|reserve a consultation|free consultation|tax-readiness consultation|tax readiness consultation|tax consultation|investing-tax readiness|talk to an advisor|schedule a call|zoom call|discord call|can i talk to someone)\b/.test(text)) return "consultation_booking";
  if (/\b(portfolio audit|review my portfolio|review my roth ira|review my brokerage|help me pick investments|can someone review)\b/.test(text)) return "portfolio_audit";
  if (/\b(audit my wallet|audit my credit card setup|audit my card setup|credit card setup review|review my cards|review my setup)\b/.test(text)) return "credit_wallet_audit";
  if (/\b(aotc|american opportunity credit|lifetime learning credit|llc tax credit|1098-t|student tax angle|student credits?)\b/.test(text)) return "tax_student_credits";
  if (/\b(student loan interest|1098-e|loan interest deduction)\b/.test(text)) return "tax_student_loan_interest";
  if (/\b(1099 checklist|tax-form checklist|tax form checklist|which forms|forms should i wait|build my tax form)\b/.test(text)) return "tax_form_checklist";
  if (/\b(tax after investing|taxes after investing|sold stocks|sold etfs|1099-b|capital gains|dividends|1099-div|1099-int|hysa interest|brokerage taxes|roth ira taxes|roth vs brokerage)\b/.test(text)) return "tax_after_investing";
  if (/\b(side hustle taxes|self employment tax|1099 contractor|app income|cash payments|business revenue)\b/.test(text)) return "tax_side_hustle";
  if (/\b(business tax basics|business deduction|home office|mileage deduction|estimated taxes|small business tax)\b/.test(text)) return "tax_business_basics";
  if (/\b(tax|taxes|file taxes|filing taxes|1099|w-2|w2|irs|refund|free file|standard deduction|itemize)\b/.test(text)) return "tax_filing";
  if (/\b(first card|first credit card|student card|student credit card|beginner card|new to credit|starter card)\b/.test(text)) return "student_first_card";
  if (/\b(fico|credit score|utilization|statement date|reported balance|credit report|hard inquiry|inquiries|raise my credit)\b/.test(text)) return "credit_score";
  if (/\b(wallet|build my setup|build my wallet|current cards|what next|next card|card setup|covered lanes|missing lanes)\b/.test(text)) return "wallet_build";
  if (/\b(lounge|airport lounge|amex platinum|centurion|priority pass|premium travel)\b/.test(text)) return "premium_lounge";
  if (/\b(travel points|miles|flights|hotel|transfer partners|sapphire|venture x|travel card)\b/.test(text)) return "travel_points";
  if (/\b(food|eating|dining|restaurant|restaurants|takeout|uber eats|doordash)\b/.test(text)) return "food_dining";
  if (/\b(grocery|groceries|supermarket|walmart|target)\b/.test(text)) return "groceries";
  if (/\b(flat cash back|simple cash back|catch all|everything card|2% card)\b/.test(text)) return "flat_cashback";
  if (/\b(apple pay|mobile wallet|tap to pay)\b/.test(text)) return "apple_pay";
  if (/\b(business card|business spending|llc|side hustle|separate business)\b/.test(text)) return "business";
  if (/\b(build credit|credit builder|secured card)\b/.test(text)) return "build_credit";
  if (/\b(roth|ira|retirement)\b/.test(text)) return "roth_ira";
  if (/\b(etf|vti|vxus|brokerage|stocks|investing)\b/.test(text)) return "investing";
  if (/\b(hysa|savings|emergency fund|apy)\b/.test(text)) return "hysa";
  if (/\b(checking|debit|atm|direct deposit|cash management)\b/.test(text)) return "checking";
  return null;
}

function wantsPersonalCardPick(message) {
  return /\b(which card|what card|best card|best .* card|best card for me|should i get|what next|next card|build|setup|wallet|i have|my cards?)\b/i.test(message);
}

function detectCurrentCards(message) {
  const text = message.toLowerCase();
  return cardSignals.filter((card) => card.aliases.some((alias) => text.includes(alias)));
}

function inferWalletGoal(text) {
  if (/\b(lounge|premium|amex platinum|venture x|sapphire reserve)\b/.test(text)) return "premium";
  if (/\b(travel|points|miles|flights|hotel|sapphire|venture)\b/.test(text)) return "travel";
  if (/\b(food|dining|restaurant|restaurants|groceries|grocery)\b/.test(text)) return "food";
  if (/\b(build credit|first card|student|starter|secured)\b/.test(text)) return "build";
  if (/\b(business|side hustle|llc)\b/.test(text)) return "business";
  if (/\b(low fee|no annual fee|avoid fee|free card)\b/.test(text)) return "lowfee";
  return "simple";
}

function inferWalletSpend(text) {
  if (/\b(dining|restaurant|takeout|food|eating|uber eats|doordash)\b/.test(text)) return "dining";
  if (/\b(grocery|groceries|supermarket)\b/.test(text)) return "groceries";
  if (/\b(gas|transit|commute)\b/.test(text)) return "gas";
  if (/\b(travel|flight|hotel)\b/.test(text)) return "travel";
  if (/\b(online|amazon|shopping|apple pay|mobile wallet)\b/.test(text)) return "online";
  if (/\b(business|side hustle|llc)\b/.test(text)) return "business";
  return "mixed";
}

function inferFeeTolerance(text) {
  if (/\b(no annual fee|avoid fee|free card|no fee|0 annual fee|\$0 annual fee)\b/.test(text)) return "avoid";
  if (/\b(low fee|small fee|95 fee|\$95|under \$150)\b/.test(text)) return "low";
  if (/\b(premium|lounge|amex platinum|venture x|sapphire reserve|fee is okay|annual fee is okay|if value is real)\b/.test(text)) return "premium";
  return "unknown";
}

function walletTargetLane(goal) {
  if (goal === "build") return "Student / Beginner";
  if (goal === "travel") return "Travel";
  if (goal === "premium") return "Premium";
  if (goal === "business") return "Business";
  if (goal === "food") return "Food / Dining / Grocery";
  return "Cash Back";
}

function walletGoalCovered(cards, goal) {
  const lanes = new Set(cards.map((card) => card.lane));
  if (!cards.length) return false;
  if (goal === "build") return lanes.has("Student / Beginner");
  if (goal === "simple" || goal === "lowfee") return lanes.has("Cash Back");
  if (goal === "food") return cards.some((card) => card.food);
  if (goal === "travel") return lanes.has("Travel") || lanes.has("Premium") || cards.some((card) => card.transfer);
  if (goal === "premium") return cards.some((card) => card.lounge);
  if (goal === "business") return lanes.has("Business");
  return false;
}

function dedupeCards(cards) {
  const seen = new Set();
  return cards.filter((card) => {
    if (seen.has(card.name)) return false;
    seen.add(card.name);
    return true;
  });
}

function buildWalletStyleContext(message) {
  const text = message.toLowerCase();
  const goal = inferWalletGoal(text);
  const spend = inferWalletSpend(text);
  const fee = inferFeeTolerance(text);
  const currentCards = detectCurrentCards(message);
  const coveredLanes = [...new Set(currentCards.map((card) => card.lane))];
  const missingLanes = walletLanes.filter((lane) => !coveredLanes.includes(lane));
  const targetLane = walletTargetLane(goal);
  const goalCovered = walletGoalCovered(currentCards, goal);
  const ecosystems = [...new Set(currentCards.map((card) => card.ecosystem))];
  const suggestions = suggestWalletCards({ goal, spend, fee, currentCards, goalCovered, ecosystems });
  const nextMove = nextWalletMove({ goal, spend, fee, currentCards, coveredLanes, missingLanes, targetLane, goalCovered, ecosystems });

  return {
    goal,
    spend,
    fee,
    currentCards: currentCards.map((card) => card.name),
    coveredLanes,
    missingLanes,
    targetLane,
    goalCovered,
    ecosystems,
    suggestions,
    nextMove,
  };
}

function suggestWalletCards({ goal, spend, fee, currentCards, ecosystems }) {
  const current = new Set(currentCards.map((card) => card.name));
  const recs = [];

  function add(name, reason) {
    if (current.has(name) || recs.some((item) => item.name === name)) return;
    recs.push({ name, reason });
  }

  if (goal === "build") {
    add("Chase Freedom Rise", "Starter lane before chasing premium cards.");
    add("Capital One Platinum Secured", "Credit-builder lane if approval odds matter more than rewards.");
    add("Capital One Savor Student", "Student food/fun lane if that spend is already real.");
    return recs.slice(0, 3);
  }

  if (goal === "premium") {
    if (ecosystems.includes("Amex")) add("Amex Platinum", "Amex lounge lane after food is already covered.");
    else if (ecosystems.includes("Chase")) add("Chase Sapphire Reserve", "Premium Chase lane if transfer partners and lounges are real.");
    else add("Capital One Venture X", "Cleaner premium lane if travel credits and lounge access fit your routes.");
    return recs.slice(0, 3);
  }

  if (goal === "travel" || spend === "travel") {
    if (ecosystems.includes("Chase")) add("Chase Sapphire Preferred", "Chase transfer-partner unlock if trips are real.");
    else add(fee === "avoid" ? "Wells Fargo Autograph" : "Chase Sapphire Preferred", fee === "avoid" ? "No-fee travel-adjacent lane." : "Starter travel lane without jumping to premium lounge fees.");
    add("Capital One VentureOne", "No-fee travel learning lane before bigger fees.");
    return recs.slice(0, 3);
  }

  if (goal === "food" || spend === "dining" || spend === "groceries") {
    if (fee === "premium") add("Amex Gold", "Premium food-points lane if credits and Membership Rewards fit.");
    if (fee !== "avoid") add("Amex Blue Cash Preferred", "Stronger grocery, streaming, gas, and transit cash-back lane if the fee works.");
    add("Capital One Savor", "Food lane for dining, groceries, entertainment, and streaming.");
    if (fee === "avoid") add("Amex Blue Cash Everyday", "No-fee groceries, gas, and online retail lane.");
    return recs.slice(0, 3);
  }

  if (goal === "business" || spend === "business") {
    add("Ink Business Cash", "Business category lane when business spend is real.");
    add("Ink Business Unlimited", "Simple business catch-all lane.");
    add("Amex Blue Business Plus", "Business points lane without a premium fee.");
    return recs.slice(0, 3);
  }

  if (spend === "online") {
    add("Apple Card", "Apple Pay lane if mobile wallet is already your default.");
    add(fee === "avoid" ? "Amex Blue Cash Everyday" : "Amex Blue Cash Preferred", fee === "avoid" ? "No-fee online retail lane." : "Category cash-back lane if the fee fits real spend.");
    return recs.slice(0, 3);
  }

  add("Wells Fargo Active Cash", "Simple catch-all cash-back lane.");
  add("Citi Double Cash", "Flat cash-back lane if you pay in full.");
  add("Chase Freedom Unlimited", "Starter Chase lane that can pair with Sapphire later.");
  return recs.slice(0, 3);
}

function nextWalletMove({ goal, spend, currentCards, coveredLanes, missingLanes, targetLane, goalCovered, ecosystems }) {
  const names = new Set(currentCards.map((card) => card.name));
  if (!currentCards.length) return "Start with one card that matches the goal before adding extra lanes.";
  if ((goal === "travel" || goal === "premium") && ecosystems.includes("Capital One") && !names.has("Capital One VentureOne") && !names.has("Capital One Venture")) {
    return "Build the Capital One travel path before jumping to premium lounge fees.";
  }
  if (goal === "travel" && ecosystems.includes("Chase") && !names.has("Chase Sapphire Preferred") && !names.has("Chase Sapphire Reserve")) {
    return "Your Chase base may be ready. Research Sapphire only if travel points are real.";
  }
  if (goal === "premium" && names.has("Amex Gold") && !names.has("Amex Platinum")) {
    return "Amex Gold covers food. Platinum is only the clean add if lounge access and credits are real.";
  }
  if (goal === "food" && goalCovered) return "Pause before adding another food card. Avoid duplicate dining/grocery lanes.";
  if (goalCovered && missingLanes.includes("Travel")) return "Your current goal is covered. Add travel only if trips are real.";
  if (goalCovered) return "Pause before adding more. Your current wallet already covers this goal.";
  if (!coveredLanes.includes(targetLane) && targetLane !== "Food / Dining / Grocery") return `Add a ${targetLane} lane before adding extra cards.`;
  if (goal === "food" || spend === "dining" || spend === "groceries") return "Add one food-first card only if dining or groceries are a real spend lane.";
  if (missingLanes.includes("Cash Back")) return "Add a simple cash-back card before premium travel.";
  return "Keep the setup simple. A clean wallet has purpose.";
}

function pickBestLink(category, subIntent, walletContext, message) {
  if (subIntent === "consultation_booking" || subIntent === "portfolio_audit" || subIntent === "credit_wallet_audit") return null;
  if (subIntent === "tax_filing" || subIntent === "tax_after_investing" || subIntent === "tax_student_credits" || subIntent === "tax_student_loan_interest" || subIntent === "tax_form_checklist" || subIntent === "tax_side_hustle" || subIntent === "tax_business_basics") return pageLinks.taxes;
  if (subIntent === "student_first_card" || subIntent === "build_credit") return pageLinks.student_credit;
  if (subIntent === "credit_score") return pageLinks.credit_score;
  if (subIntent === "premium_lounge" || subIntent === "travel_points") return pageLinks.travel_cards;
  if (subIntent === "roth_ira") return pageLinks.roth;
  if (subIntent === "hysa") return pageLinks.saving;
  if (subIntent === "investing") return pageLinks.investing;
  if (subIntent === "checking") return pageLinks.checking;
  if (subIntent === "wallet_build" || category === "wallet") return pageLinks.wallet;
  if ((subIntent === "food_dining" || subIntent === "groceries") && wantsPersonalCardPick(message)) return pageLinks.wallet;

  if (category === "cards") {
    if (walletContext?.goal === "travel" || walletContext?.goal === "premium") return pageLinks.travel_cards;
    if (wantsPersonalCardPick(message)) return pageLinks.wallet;
    return pageLinks.cards;
  }

  if (category === "credit_score") return pageLinks.credit_score;
  if (category === "saving") return pageLinks.saving;
  if (category === "investing") return pageLinks.investing;
  if (category === "checking") return pageLinks.checking;
  if (category === "taxes") return pageLinks.taxes;
  if (category === "consulting") return null;
  return null;
}

function extractNumbers(message) {
  const dollars = [...message.matchAll(/\$?\b(\d{2,7})(?:\.\d{1,2})?\b/g)]
    .map((match) => Number(match[1]))
    .filter((value) => Number.isFinite(value));
  const percents = [...message.matchAll(/\b(\d{1,3})\s*%/g)]
    .map((match) => Number(match[1]))
    .filter((value) => Number.isFinite(value));
  return { dollars: dollars.slice(0, 8), percents: percents.slice(0, 5) };
}

function buildRuleContext(category, subIntent, walletContext, message) {
  const text = message.toLowerCase();
  const numbers = extractNumbers(message);
  const flags = [];
  const rules = [
    "Educational only. This is not personalized financial, tax, or legal advice.",
    "Verify card terms, APRs, fees, rewards, tax rules, and eligibility with the issuer or provider before acting.",
    "Do not carry credit-card debt for rewards, bonuses, or a credit score.",
    "Short-term money usually belongs in cash or cash-like accounts, not risky investments.",
  ];

  if (category === "unsafe") {
    flags.push("The question may involve debt, risky investing, or reward-chasing behavior. Warn clearly and redirect to safer basics.");
  }

  if (category === "credit_score" || subIntent === "credit_score" || subIntent === "build_credit" || /\butilization\b/.test(text)) {
    rules.push("For credit score optimization, a small reported balance can be cleaner than a maxed-out card.");
    rules.push("A common educational target is letting 1-10% report on statement day, then paying to $0 before the due date to avoid interest.");
    rules.push("For beginners, paying the statement balance in full by the due date matters more than score hacks.");
  }

  if (category === "wallet" || category === "cards" || subIntent === "wallet_build") {
    rules.push("Recommend card lanes logically. Avoid suggesting two cards that fill the same job unless there is a clear reason.");
    rules.push("If the user accepts annual fees and the higher-fee card is clearly stronger for their actual spending, do not also push the weaker no-fee duplicate.");
    rules.push("Do not promise approval, exact scores, or guaranteed welcome bonuses.");
    rules.push("Think like the Wallet Builder: goal, biggest spend, annual fee tolerance, current cards, covered lanes, missing lanes, next best move.");
  }

  if (category === "investing" || subIntent === "roth_ira" || subIntent === "investing") {
    rules.push("Roth IRA is the account; ETFs, mutual funds, stocks, and bonds are investments inside the account.");
    rules.push("Emergency fund and high-interest debt usually come before long-term investing.");
    rules.push("Avoid claiming guaranteed returns or perfect allocations.");
  }

  if (category === "taxes" || (subIntent && subIntent.startsWith("tax_"))) {
    rules.push("Give general tax education only. Do not calculate liability, promise refunds, or act like a tax preparer.");
    rules.push("Route form-specific confusion to the Taxes guide and offer an educational consultation when personal context is needed.");
    rules.push("Never ask for SSNs, tax IDs, full account numbers, passwords, or login credentials.");
  }

  if (category === "consulting" || subIntent === "consultation_booking" || subIntent === "portfolio_audit" || subIntent === "credit_wallet_audit") {
    rules.push("Consultations are educational audits only, not financial planning, investment management, tax preparation, legal advice, or guaranteed outcomes.");
    rules.push("Book through Score only; do not ask for sensitive numbers or account login credentials.");
  }

  if (category === "saving") {
    rules.push("HYSA is usually for emergency funds and money needed within roughly 0-3 years.");
    rules.push("APYs change, and FDIC/NCUA insurance details should be verified.");
  }

  if (numbers.dollars.length) flags.push(`Numbers mentioned: ${numbers.dollars.join(", ")}.`);
  if (numbers.percents.length) flags.push(`Percents mentioned: ${numbers.percents.join(", ")}%.`);
  if (walletContext.currentCards.length) flags.push(`Current cards mentioned: ${walletContext.currentCards.join(", ")}.`);
  if (walletContext.goal !== "simple" || walletContext.spend !== "mixed" || walletContext.fee !== "unknown") {
    flags.push(`Wallet read: goal=${walletContext.goal}, spend=${walletContext.spend}, fee=${walletContext.fee}.`);
  }

  const link = pickBestLink(category, subIntent, walletContext, message);

  return { category, subIntent, walletContext, rules, flags, link };
}

function fallbackAnswer(message, context) {
  const flagLine = context.flags.length ? `\n\nWhat I noticed: ${context.flags.join(" ")}` : "";
  const wallet = context.walletContext;
  const suggestions = wallet?.suggestions?.length
    ? `\n\nCards to research by lane:\n${wallet.suggestions.map((card) => `- ${card.name}: ${card.reason}`).join("\n")}`
    : "";
  const walletRead = wallet
    ? `\n\nWallet read:\n- Goal: ${wallet.goal}\n- Biggest spend: ${wallet.spend}\n- Fee tolerance: ${wallet.fee}\n- Covered lanes: ${wallet.coveredLanes.length ? wallet.coveredLanes.join(", ") : "none mentioned"}\n- Missing lanes: ${wallet.missingLanes.join(", ")}\n- Next move: ${wallet.nextMove}`
    : "";

  const subIntentAnswers = {
    consultation_booking:
      "Happy to help. You can book a free LifeScore educational consultation through Score.\n\n- Pick a topic\n- Choose Discord, Zoom, or no preference\n- Select an open time\n- Do not share SSNs, passwords, tax IDs, or full account numbers\n\nNext step: Use the booking flow in Score.",
    portfolio_audit:
      "Happy to help. A portfolio audit should stay educational and high level.\n\n- Bring tickers, rough percentages, goals, and timeline\n- Do not send account logins or sensitive documents\n- The goal is to understand structure, not promise returns\n\nNext step: Book a free educational consultation through Score.",
    credit_wallet_audit:
      "Got it. A wallet audit should check lanes, fees, duplicate cards, and whether the setup matches real spending.\n\n- Bring card names and your goal\n- Do not share full card numbers\n- Avoid adding cards just to add cards\n\nNext step: Book through Score or use Wallet Builder.",
    tax_filing:
      "Direct answer: Tax season is easier when you know which forms to expect.\n\n- W-2 for job wages\n- 1099-INT for bank interest\n- 1099-DIV or 1099-B for investing activity\n- 1098-T for tuition if applicable\n\nNext step: Use the Taxes guide. For personal form confusion, book a free educational session through Score.",
    tax_after_investing:
      "Direct answer: Investing can create tax forms even when you are young.\n\n- Unrealized gains usually are not taxed just because prices rose\n- Selling can create realized gains or losses\n- Dividends and HYSA interest can be taxable\n- Brokerage forms matter more than screenshots\n\nNext step: Use the Taxes guide, then book through Score if your forms are confusing.",
    tax_student_credits:
      "Direct answer: I can help you sort the difference between AOTC and Lifetime Learning Credit.\n\n- AOTC is often tied to undergraduate education and can be stronger when eligible\n- Lifetime Learning Credit can apply more broadly to school or job-skill courses\n- 1098-T helps start the question, but it is not the whole answer\n\nNext step: Are you asking for yourself, a dependent, or general planning?",
    tax_student_loan_interest:
      "Direct answer: Student loan interest can be worth checking before you file.\n\n- Look for Form 1098-E or lender interest records\n- Income and filing status can affect whether the deduction applies\n- Do not assume every payment is deductible\n\nNext step: Use the Taxes guide, then verify with IRS rules or qualified tax help.",
    tax_form_checklist:
      "Direct answer: Let's build the tax-form checklist before you file.\n\n- Job income: W-2\n- HYSA or bank interest: 1099-INT\n- Dividends: 1099-DIV\n- Sold investments: 1099-B\n- Contract or side income: 1099-NEC or 1099-MISC\n- Tuition or loan interest: 1098-T or 1098-E\n\nNext step: Did you have job income, bank interest, dividends, sold investments, tuition, student loan interest, or side-hustle income?",
    tax_side_hustle:
      "Direct answer: I can help you identify the category before you guess.\n\n- Track income source and payment type\n- Separate business expenses from personal spending\n- Self-employment tax and estimated taxes may matter\n\nNext step: Did you receive W-2 wages, 1099 contractor income, app income, cash payments, or business revenue?",
    tax_business_basics:
      "Direct answer: Business tax basics start with tracking, not tricks.\n\n- Expenses need a business reason and records\n- Mileage and home office rules are detail-heavy\n- Estimated taxes can matter when income is recurring\n- Retirement plan options are a later-stage question\n\nNext step: Book a tax-readiness session if you need help organizing the questions.",
    food_dining:
      `Direct answer: For food, separate dining from groceries before picking a card.\n\n- Dining/takeout is one lane\n- Groceries can be a separate lane\n- One strong card is better than duplicate rewards cards\n- Annual fees only make sense when real spend supports them\n\nNext step: Use Wallet Builder with goal = Better food/dining rewards and biggest spend = Dining or Groceries.${suggestions}`,
    groceries:
      `Direct answer: Grocery rewards are only useful if groceries are a real monthly spend lane.\n\n- If annual fees are okay, compare the stronger grocery lane first\n- If fees are not okay, use a no-fee grocery lane\n- Do not stack multiple grocery cards unless each has a clear job\n\nNext step: Use Wallet Builder so fee tolerance decides the right lane.${suggestions}`,
    student_first_card:
      "Direct answer: Start with one clean card, not a stack.\n\n- Use it for small planned purchases\n- Keep the reported balance low\n- Pay the statement balance in full\n- Avoid random applications\n\nNext step: Start with the Student Credit Guide.",
    build_credit:
      "Direct answer: Build credit with boring repetition.\n\n- One beginner or secured card\n- Autopay on\n- Statement balance paid in full\n- Low reported balance\n\nNext step: Start with the Student Credit Guide before optimizing.",
    credit_score:
      "Direct answer: Optimize after the basics are automatic.\n\n- Pay on time\n- Let a small balance report if score-optimizing\n- Pay to $0 before the due date to avoid interest\n- Avoid random applications\n\nNext step: Use Credit Score Maxing.",
    premium_lounge:
      "Direct answer: Premium lounge cards only work if the perks are real for your route.\n\n- Check your home airport\n- Check lounge access and guest rules\n- Count credits only if you would naturally use them\n- Do not pay a premium fee for imaginary value\n\nNext step: Use Travel Cards.",
    travel_points:
      "Direct answer: Travel points should match real trips, not fantasy trips.\n\n- Starter travel comes before premium lounge cards\n- Transfer partners matter only if you will use them\n- Annual fees have to earn their place\n\nNext step: Use Travel Cards.",
    flat_cashback:
      `Direct answer: Flat cash back is the clean base lane.\n\n- Good for mixed spending\n- Easy to keep long term\n- Useful before travel complexity\n\nNext step: Use Wallet Builder if you want the next card after your base.${suggestions}`,
    apple_pay:
      "Direct answer: Apple Pay is a lane only if you actually tap to pay often.\n\n- Mobile wallet rewards are simple\n- Physical-card rewards may be weaker\n- Pair it with a true catch-all if needed\n\nNext step: Compare Cards or use Wallet Builder for your full setup.",
    business:
      "Direct answer: Business cards are a level-up lane, not a flex.\n\n- Separate business spend only when it is real\n- Keep personal credit habits clean first\n- Match the card to actual business expenses\n\nNext step: Use Wallet Builder with goal = Business spending.",
    wallet_build:
      `Direct answer: Build by lanes, not card count.${walletRead}${suggestions}\n\nNext step: Use Wallet Builder and enter your current cards so the site can score the setup.`,
    roth_ira:
      "Direct answer: A Roth IRA is the account, not the investment.\n\n- The account holds investments like ETFs\n- Handle emergency cash first\n- Keep the core simple and repeatable\n\nNext step: Use the Roth IRA section in Investing.",
    hysa:
      "Direct answer: Emergency money usually belongs somewhere stable and accessible.\n\n- HYSA is for cash you may need soon\n- APYs change\n- Verify fees and FDIC/NCUA coverage\n\nNext step: Use the HYSA Guide.",
    investing:
      "Direct answer: Account first, investments second.\n\n- Decide the account type\n- Pick simple investments inside it\n- Avoid treating long-term investing like quick trading\n\nNext step: Use the Investing Guide.",
    checking:
      "Direct answer: Checking is for access, direct deposit, bills, debit, and ATM needs.\n\n- Watch fees\n- Check ATM access\n- Keep savings separate from daily spending\n\nNext step: Use the Checking Guide.",
  };

  const categoryAnswers = {
    credit_score:
      "Direct answer: Keep the card boring and controlled.\n\n- Pay on time\n- Keep the reported balance low\n- Do not apply randomly\n\nNext step: If optimizing, let about 1-10% report, then pay to $0 before the due date.",
    wallet:
      "Direct answer: Build by lanes, not card count.\n\n- Keep cards that do real jobs\n- Avoid duplicate lanes\n- Add only what your spending supports\n\nNext step: Tell me your cards and goal.",
    cards:
      "Direct answer: Match the card to real spending.\n\n- Annual fee has to earn its place\n- Bonuses only count if spend is natural\n- Approval is never guaranteed\n\nNext step: Compare fee, categories, and bonus requirement.",
    investing:
      "Direct answer: Account first, investments second.\n\n- Roth IRA is the container\n- ETFs are examples of what goes inside\n- Short-term money should stay safer\n\nNext step: Handle emergency cash before investing.",
    saving:
      "Direct answer: If you need it soon, HYSA usually beats market risk.\n\n- Stable\n- Accessible\n- APY can change\n\nNext step: Verify APY, fees, and insurance details.",
    budgeting:
      "Direct answer: Build the month in order.\n\n- Essentials\n- Emergency fund\n- Debt cleanup\n- Investing\n- Fun money\n\nNext step: Send income, fixed expenses, savings, and debt.",
    affordability:
      "Direct answer: If it creates card debt, wait.\n\n- Do not wipe emergency cash\n- Do not delay an important goal for a want\n- Planned fun money is different\n\nNext step: Send price, income, and savings.",
    unsafe:
      "Direct answer: Do not use debt to chase rewards or quick wins.\n\n- Interest can erase rewards\n- Risk can snowball fast\n- Stability comes first\n\nNext step: Pay down high-interest debt before optimizing.",
    taxes:
      "Direct answer: Start with the form, then the action.\n\n- Know whether you have W-2, 1099, 1098-T, or brokerage forms\n- Use official filing options when eligible\n- Do not enter tax info through random links\n\nNext step: Use the Taxes guide.",
    consulting:
      "Happy to help. Score can book a free educational LifeScore consultation.\n\n- Credit card wallet audit\n- Roth IRA or brokerage setup\n- Tax-readiness questions after investing\n- Budget and money plan basics\n\nNext step: Start the booking flow in Score.",
    general:
      "Direct answer: Keep the next move simple and useful.\n\n- Credit\n- Saving\n- Investing\n- Wallet setup\n- Spending decisions\n\nNext step: Ask one specific question.",
  };

  const openerByCategory = {
    consulting: "Happy to help.",
    taxes: "Happy to help.",
    credit_score: "Got it.",
    wallet: "Got it.",
    cards: "Let's figure this out.",
    investing: "Happy to help.",
    saving: "No problem.",
    checking: "No problem.",
    budgeting: "Let's figure this out.",
    affordability: "Got it.",
    unsafe: "Important caution.",
    general: "Happy to help.",
  };
  const opener = openerByCategory[context.category] || "Happy to help.";
  const base = subIntentAnswers[context.subIntent] || categoryAnswers[context.category] || categoryAnswers.general;
  const polished = base.replace(/^Direct answer:/, opener);
  return `${polished}${flagLine}\n\nEducational only. Verify terms and do not carry credit-card debt for rewards.`;
}

function compactHistory(rawHistory) {
  if (!Array.isArray(rawHistory)) return [];
  return rawHistory
    .slice(-8)
    .map((item) => ({
      role: item?.role === "assistant" ? "assistant" : "user",
      content: normalizeText(item?.content, 900),
    }))
    .filter((item) => item.content);
}

function extractOpenAIText(data) {
  if (typeof data?.output_text === "string") return data.output_text.trim();
  const chunks = [];
  for (const item of data?.output || []) {
    for (const content of item?.content || []) {
      if (typeof content?.text === "string") chunks.push(content.text);
    }
  }
  return chunks.join("\n").trim();
}

async function readOpenAIJson(openAiResponse) {
  const text = await openAiResponse.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text.slice(0, 500) };
  }
}

function summarizeOpenAIError(error) {
  return {
    message: error?.message || "Unknown OpenAI error",
    status: error?.status || null,
    type: error?.type || null,
    code: error?.code || null,
    model: OPENAI_MODEL,
  };
}

async function callOpenAI(message, history, context) {
  const system = [
    "You are Score, the LifeScore finance coach for students and young adults.",
    "Tone: polished, friendly, customer-facing, clear, student-friendly, and calm.",
    "Use everyday English. Sound helpful, not robotic, formal, or scripted.",
    "Use short guided responses and avoid long paragraphs. Ask one question at a time when you need information.",
    "Natural phrases are welcome when they fit: Happy to help. No problem. Got it. Let's figure this out.",
    "If the user's request is unclear, ask politely: Can you clarify one thing? Do you mean taxes, credit, investing, or banking? Can you say that another way?",
    "Never shame the user. Correct risky behavior clearly and guide the next safer step.",
    "Always be educational only. Do not provide guaranteed advice, guaranteed approval, guaranteed returns, tax/legal certainty, or risky debt/rewards advice.",
    "Never encourage carrying credit-card debt for rewards. If the user suggests it, warn clearly.",
    "Use short sections or bullets when helpful: Direct answer, Why, Next step, Caution. Do not force every label if a simpler answer is better.",
    "Use LifeScore logic: simple systems, low drama, clear next move.",
    "For card and wallet questions, think like the LifeScore Wallet Builder: identify the goal, biggest spend, fee tolerance, current cards, covered lanes, missing lanes, and next best lane.",
    "Avoid duplicate card lanes. Do not recommend two cards that solve the same job unless there is a clear reason.",
    "If one card is clearly stronger for the user's stated fee tolerance and spending, do not also push the weaker duplicate.",
    "Route the user to the useful_page when it helps. Ask for current cards, goal, biggest spend, or fee tolerance only when that information is truly missing.",
  ].join("\n");

  const input = [
    ...history,
    {
      role: "user",
      content: JSON.stringify({
        user_question: message,
        classification: context.category,
        sub_intent: context.subIntent,
        wallet_context: context.walletContext,
        rules_to_follow: context.rules,
        rule_flags: context.flags,
        useful_page: context.link,
      }),
    },
  ];

  const openAiResponse = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      instructions: system,
      input,
      temperature: 0.35,
      max_output_tokens: 650,
    }),
  });

  const data = await readOpenAIJson(openAiResponse);
  if (!openAiResponse.ok) {
    const error = new Error(data?.error?.message || data?.raw || `OpenAI returned ${openAiResponse.status}`);
    error.status = openAiResponse.status;
    error.type = data?.error?.type || null;
    error.code = data?.error?.code || null;
    throw error;
  }

  const answer = extractOpenAIText(data);
  if (!answer) throw new Error("OpenAI returned an empty answer.");
  return answer;
}

module.exports = async function handler(request, response) {
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    return sendJson(response, 405, { error: "Use POST for Score chat." });
  }

  try {
    const message = normalizeText(request.body?.message);
    if (!message) return sendJson(response, 400, { error: "Ask Score a question first." });

    const history = compactHistory(request.body?.history);
    const category = classifyQuestion(message);
    const subIntent = detectSubIntent(message);
    const walletContext = buildWalletStyleContext(message);
    const context = buildRuleContext(category, subIntent, walletContext, message);

    if (!OPENAI_API_KEY) {
      console.warn("[Score chat] OPENAI_API_KEY is missing. Returning rules fallback.", {
        category,
        subIntent,
        model: OPENAI_MODEL,
      });
      return sendJson(response, 200, {
        answer: fallbackAnswer(message, context),
        category,
        subIntent,
        walletContext,
        link: context.link,
        source: "rules_fallback",
        mode: "demo",
      });
    }

    try {
      const answer = await callOpenAI(message, history, context);
      console.info("[Score chat] OpenAI response succeeded.", {
        category,
        subIntent,
        model: OPENAI_MODEL,
      });
      return sendJson(response, 200, {
        answer,
        category,
        subIntent,
        walletContext,
        link: context.link,
        source: "openai",
      });
    } catch (error) {
      console.error("[Score chat] OpenAI request failed. Returning rules fallback.", summarizeOpenAIError(error));
      return sendJson(response, 200, {
        answer: fallbackAnswer(message, context),
        category,
        subIntent,
        walletContext,
        link: context.link,
        source: "rules_fallback",
        note: "AI response unavailable, so Score used the LifeScore rules engine.",
      });
    }
  } catch (error) {
    console.error("[Score chat] Handler failed before it could answer.", {
      message: error?.message || "Unknown handler error",
    });
    return sendJson(response, 500, { error: "Score could not answer that yet. Try again in a second." });
  }
};
