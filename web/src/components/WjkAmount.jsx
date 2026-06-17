import { fmtUsd, fmtWJK } from "../lib/format.js";

/**
 * WJK amount with optional USD equivalent (NonKYC spot).
 * @param {"inline"|"stack"} layout — inline: "1.5 WJK ($0.00)"; stack: WJK over $
 */
export default function WjkAmount({
  sats,
  usdtPerWjk,
  layout = "inline",
  className = "",
  wjkClass = "",
  usdClass = "text-white/40",
}) {
  const usd = fmtUsd(sats, usdtPerWjk);
  const wjk = fmtWJK(sats);

  if (layout === "stack") {
    return (
      <span className={`inline-flex flex-col items-end leading-tight ${className}`}>
        <span className={wjkClass}>
          {wjk} <span className="text-white/45">WJK</span>
        </span>
        {usd != null && <span className={`text-[10px] tabular ${usdClass}`}>${usd}</span>}
      </span>
    );
  }

  return (
    <span className={`tabular ${className}`}>
      <span className={wjkClass}>{wjk} WJK</span>
      {usd != null && <span className={`ml-1 text-[0.85em] ${usdClass}`}>(${usd})</span>}
    </span>
  );
}
