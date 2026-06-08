const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-4.1-mini";

const pageLinks = {
  credit: { label: "Student Credit Guide", href: "/student-credit-guide.html" },
  credit_score: { label: "Credit Score Maxing", href: "/credit-score.html" },
  cards: { label: "Compare Cards", href: "/cards.html" },
  wallet: { label: "Wallet Builder", href: "/wallet.html" },
  saving: { label: "HYSA Guide", href: "/hysa.html" },
  investing: { label: "Investing Guide", href: "/investing.html" },
  checking: { label: "Checking Guide", href: "/checking.html" },
};

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
    ["unsafe", /\b(carry a balance|minimum payment only|cash advance|borrow to invest|payday|gamble|options trading|meme coin|leverage)\b/],
    ["credit_score", /\b(fico|credit score|utilization|statement date|reported balance|credit report|hard inquiry|inquiries)\b/],
    ["wallet", /\b(wallet|next card|add next|card setup|covered lanes|missing lanes|which card|what card)\b/],
    ["cards", /\b(credit card|annual fee|welcome bonus|cash back|travel card|sapphire|amex|capital one|chase|approval)\b/],
    ["investing", /\b(roth|ira|invest|investing|etf|vti|vxus|brokerage|stocks|market)\b/],
    ["saving", /\b(hysa|savings|emergency fund|save|apy|interest rate|short term money)\b/],
    ["checking", /\b(checking|bank account|debit|atm|direct deposit|cash management)\b/],
    ["budgeting", /\b(budget|paycheck|income|expenses|rent|monthly|spend)\b/],
    ["affordability", /\b(afford|buy this|purchase|worth it|should i buy)\b/],
  ];
  return checks.find(([, pattern]) => pattern.test(text))?.[0] || "general";
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

function buildRuleContext(category, message) {
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

  if (category === "credit_score" || category === "credit" || /\butilization\b/.test(text)) {
    rules.push("For credit score optimization, a small reported balance can be cleaner than a maxed-out card.");
    rules.push("A common educational target is letting 1-10% report on statement day, then paying to $0 before the due date to avoid interest.");
    rules.push("For beginners, paying the statement balance in full by the due date matters more than score hacks.");
  }

  if (category === "wallet" || category === "cards") {
    rules.push("Recommend card lanes logically. Avoid suggesting two cards that fill the same job unless there is a clear reason.");
    rules.push("If the user accepts annual fees and the higher-fee card is clearly stronger for their actual spending, do not also push the weaker no-fee duplicate.");
    rules.push("Do not promise approval, exact scores, or guaranteed welcome bonuses.");
  }

  if (category === "investing") {
    rules.push("Roth IRA is the account; ETFs, mutual funds, stocks, and bonds are investments inside the account.");
    rules.push("Emergency fund and high-interest debt usually come before long-term investing.");
    rules.push("Avoid claiming guaranteed returns or perfect allocations.");
  }

  if (category === "saving") {
    rules.push("HYSA is usually for emergency funds and money needed within roughly 0-3 years.");
    rules.push("APYs change, and FDIC/NCUA insurance details should be verified.");
  }

  if (numbers.dollars.length) flags.push(`Numbers mentioned: ${numbers.dollars.join(", ")}.`);
  if (numbers.percents.length) flags.push(`Percents mentioned: ${numbers.percents.join(", ")}%.`);

  const link =
    category === "credit_score"
      ? pageLinks.credit_score
      : category === "wallet"
        ? pageLinks.wallet
        : category === "cards"
          ? pageLinks.cards
          : category === "investing"
            ? pageLinks.investing
            : category === "saving"
              ? pageLinks.saving
              : category === "checking"
                ? pageLinks.checking
                : category === "credit"
                  ? pageLinks.credit
                  : null;

  return { category, rules, flags, link };
}

function fallbackAnswer(message, context) {
  const linkLine = context.link ? `\n\nNext page to use: [${context.link.label}](${context.link.href})` : "";
  const flagLine = context.flags.length ? `\n\nWhat I noticed: ${context.flags.join(" ")}` : "";

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
    general:
      "Direct answer: Keep the next move simple and useful.\n\n- Credit\n- Saving\n- Investing\n- Wallet setup\n- Spending decisions\n\nNext step: Ask one specific question.",
  };

  return `${categoryAnswers[context.category] || categoryAnswers.general}${flagLine}${linkLine}\n\nEducational only. Verify terms and do not carry credit-card debt for rewards.`;
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

async function callOpenAI(message, history, context) {
  const system = [
    "You are Score, the LifeScore finance coach for students and young adults.",
    "Tone: calm, direct, student-friendly, slightly motivational, not corny.",
    "Always be educational only. Do not provide guaranteed advice, guaranteed approval, guaranteed returns, tax/legal certainty, or risky debt/rewards advice.",
    "Never encourage carrying credit-card debt for rewards. If the user suggests it, warn clearly.",
    "Format answers with short sections: Direct answer, Why, Next step, Caution. Keep it concise.",
    "Use LifeScore logic: simple systems, low drama, clear next move.",
  ].join("\n");

  const input = [
    { role: "system", content: system },
    ...history,
    {
      role: "user",
      content: JSON.stringify({
        user_question: message,
        classification: context.category,
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
      input,
      temperature: 0.35,
      max_output_tokens: 650,
    }),
  });

  const data = await openAiResponse.json();
  if (!openAiResponse.ok) {
    throw new Error(data?.error?.message || `OpenAI returned ${openAiResponse.status}`);
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
    const context = buildRuleContext(category, message);

    if (!OPENAI_API_KEY) {
      return sendJson(response, 200, {
        answer: `Score is in demo mode.\n\n${fallbackAnswer(message, context)}`,
        category,
        link: context.link,
        source: "rules_fallback",
        mode: "demo",
      });
    }

    try {
      const answer = await callOpenAI(message, history, context);
      return sendJson(response, 200, {
        answer,
        category,
        link: context.link,
        source: "openai",
      });
    } catch (error) {
      return sendJson(response, 200, {
        answer: fallbackAnswer(message, context),
        category,
        link: context.link,
        source: "rules_fallback",
        note: "AI response unavailable, so Score used the LifeScore rules engine.",
      });
    }
  } catch {
    return sendJson(response, 500, { error: "Score could not answer that yet. Try again in a second." });
  }
};
