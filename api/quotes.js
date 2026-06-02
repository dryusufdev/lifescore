const STOCK_API_KEY = process.env.STOCK_API_KEY || process.env.FINNHUB_API_KEY;
const WATCHLIST = new Set(["PLTR", "NVDA", "AMZN", "AAPL", "GOOGL", "TSM", "AVGO", "META", "VYM", "ITA", "VTI", "VXUS"]);

const names = {
  PLTR: "Palantir Technologies Inc",
  NVDA: "NVIDIA Corp",
  AMZN: "Amazon.com Inc",
  AAPL: "Apple Inc",
  GOOGL: "Alphabet Inc Class A",
  TSM: "Taiwan Semiconductor Manufacturing Co Ltd",
  AVGO: "Broadcom Inc",
  META: "Meta Platforms Inc",
  VYM: "Vanguard High Dividend Yield ETF",
  ITA: "iShares U.S. Aerospace & Defense ETF",
  VTI: "Vanguard Total Stock Market ETF",
  VXUS: "Vanguard Total International Stock ETF",
};

function cleanSymbols(rawSymbols) {
  return String(rawSymbols || "")
    .split(",")
    .map((symbol) => symbol.trim().toUpperCase())
    .filter((symbol) => WATCHLIST.has(symbol));
}

async function fetchFinnhubQuote(symbol) {
  const url = new URL("https://finnhub.io/api/v1/quote");
  url.searchParams.set("symbol", symbol);
  url.searchParams.set("token", STOCK_API_KEY);
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Quote provider returned ${response.status}`);

  const data = await response.json();
  if (!data || typeof data.c !== "number" || data.c === 0) throw new Error(`No price for ${symbol}`);

  return {
    ticker: symbol,
    name: names[symbol],
    price: data.c,
    change: Number(data.d || 0),
    percentChange: Number(data.dp || 0),
    lastUpdated: data.t ? new Date(data.t * 1000).toISOString() : new Date().toISOString(),
  };
}

module.exports = async function handler(request, response) {
  response.setHeader("Cache-Control", "no-store");

  if (!STOCK_API_KEY) {
    return response.status(503).json({ error: "Missing STOCK_API_KEY environment variable.", quotes: [] });
  }

  const symbols = cleanSymbols(request.query.symbols);
  if (!symbols.length) {
    return response.status(400).json({ error: "No supported symbols requested.", quotes: [] });
  }

  try {
    const settled = await Promise.allSettled(symbols.map(fetchFinnhubQuote));
    const quotes = settled
      .filter((result) => result.status === "fulfilled")
      .map((result) => result.value);

    if (!quotes.length) {
      return response.status(502).json({ error: "Price unavailable. Try again later.", quotes: [] });
    }

    return response.status(200).json({ quotes, lastUpdated: new Date().toISOString() });
  } catch {
    return response.status(502).json({ error: "Price unavailable. Try again later.", quotes: [] });
  }
};
