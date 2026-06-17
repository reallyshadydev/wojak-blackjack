// WJK/USDT spot from NonKYC (cached server-side so the browser stays same-origin).

const TICKER_URL =
  process.env.WJK_PRICE_URL ?? "https://api.nonkyc.io/api/v2/ticker/wjk%2Fusdt";
const TTL_MS = Number(process.env.WJK_PRICE_TTL_MS ?? 60_000);

let cache = { usdtPerWjk: null, fetchedAt: 0 };

export async function getWjkUsdtPrice() {
  if (cache.usdtPerWjk && Date.now() - cache.fetchedAt < TTL_MS) {
    return cache.usdtPerWjk;
  }
  const res = await fetch(TICKER_URL, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`price feed ${res.status}`);
  const data = await res.json();
  const price = Number(data.last_price);
  if (!Number.isFinite(price) || price <= 0) throw new Error("invalid price");
  cache = { usdtPerWjk: price, fetchedAt: Date.now() };
  return price;
}
