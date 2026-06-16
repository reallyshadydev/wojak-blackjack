// Thin access layer for the Wojak Wallet provider injected at `window.wojak`.
//
// This mirrors the public `wojak-sdk` (getWojakProvider / IWojakProvider). The
// SDK isn't published to npm yet, so we vendor its tiny detection logic here —
// the provider object and method names are exactly the SDK's contract:
//   connect(), getAccount(), getBalance(), getNetwork(), createTx(),
//   signMessage(), on(event, handler)  — see github.com/reallyshadydev/wojak-sdk

/** Resolve the injected provider, waiting for async injection on fresh loads. */
export function getWojakProvider(timeoutMs = 3000) {
  if (typeof window === "undefined") return Promise.resolve(undefined);
  if (window.wojak) return Promise.resolve(window.wojak);
  return new Promise((resolve) => {
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      window.removeEventListener("wojak#initialized", onReady);
      resolve(window.wojak);
    };
    const onReady = () => finish();
    window.addEventListener("wojak#initialized", onReady, { once: true });
    setTimeout(finish, timeoutMs);
  });
}

export const isInstalled = () => typeof window !== "undefined" && !!window.wojak;

/** hex-encode a UTF-8 string (for inscription payloads, if ever needed). */
export const textToHex = (s) =>
  Array.from(new TextEncoder().encode(s))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
