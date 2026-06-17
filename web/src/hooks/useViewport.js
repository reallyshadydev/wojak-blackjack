import { useEffect, useState } from "react";

/** Responsive card sizes so the felt table fits common laptop/phone heights. */
export function useCardSizes() {
  const [sizes, setSizes] = useState({ dealer: 58, player: 62 });

  useEffect(() => {
    const update = () => {
      const h = window.innerHeight;
      if (h < 680) setSizes({ dealer: 44, player: 48 });
      else if (h < 780) setSizes({ dealer: 52, player: 56 });
      else if (h < 900) setSizes({ dealer: 58, player: 62 });
      else setSizes({ dealer: 64, player: 68 });
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  return sizes;
}
