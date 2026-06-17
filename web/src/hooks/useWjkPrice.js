import { useEffect, useState } from "react";
import { api } from "../lib/api.js";

/** Live WJK/USDT from the house server's NonKYC proxy (`/api/price/wjk`). */
export function useWjkPrice(refreshMs = 60_000) {
  const [usdtPerWjk, setUsdtPerWjk] = useState(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const data = await api.wjkPrice();
        if (!cancelled && data?.usdtPerWjk > 0) setUsdtPerWjk(data.usdtPerWjk);
      } catch {
        /* keep last good price */
      }
    };

    load();
    const id = setInterval(load, refreshMs);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [refreshMs]);

  return usdtPerWjk;
}
