import { fmtWJK, fmtUsd, truncate } from "../lib/format.js";

function Badge({ children, tone = "gold" }) {
  const tones = {
    gold: "border-gold/40 text-gold",
    green: "border-emerald-400/40 text-emerald-300",
    amber: "border-amber-400/40 text-amber-300",
  };
  return (
    <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${tones[tone]}`}>
      {children}
    </span>
  );
}

export default function WalletBar({
  installed,
  address,
  walletBalanceSats,
  balanceSats,
  usdtPerWjk,
  network,
  demoMode,
  connecting,
  onConnect,
  onDisconnect,
  onDeposit,
  onWithdraw,
  onDemo,
  onRules,
  soundOn,
  onToggleSound,
}) {
  return (
    <header className="z-40 shrink-0 border-b border-gold/10 bg-black/40 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-3 py-2 sm:gap-3 sm:px-4 sm:py-2.5">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-gold to-gold-dark text-2xl shadow-glow">
            🃏
          </div>
          <div className="leading-tight">
            <div className="font-display text-xl tracking-wide sm:text-2xl">
              <span className="gold-text">WOJAK</span>
              <span className="text-white/90"> BLACKJACK</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Badge tone="amber">{network === "testnet" ? "Testnet" : "Mainnet"}</Badge>
              <Badge tone={demoMode ? "amber" : "green"}>{demoMode ? "Demo" : "On-chain"}</Badge>
              <span className="text-[10px] uppercase tracking-wider text-white/35">Provably Fair</span>
              <button
                onClick={onRules}
                className="rounded-full border border-white/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white/60 hover:border-gold/50 hover:text-gold"
              >
                Rules
              </button>
              <button
                onClick={onToggleSound}
                title={soundOn ? "Mute sound" : "Unmute sound"}
                aria-label={soundOn ? "Mute sound" : "Unmute sound"}
                className="grid h-5 w-5 place-items-center rounded-full border border-white/15 text-[10px] text-white/60 hover:border-gold/50 hover:text-gold"
              >
                {soundOn ? "🔊" : "🔇"}
              </button>
            </div>
          </div>
        </div>

        {address ? (
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="hidden text-right sm:block">
              {!demoMode && walletBalanceSats != null ? (
                <div className="tabular font-display text-base leading-tight sm:text-lg">
                  <span className="text-white/55">{fmtWJK(walletBalanceSats)}</span>
                  <span className="mx-1.5 text-white/25">·</span>
                  <span className="text-gold">{fmtWJK(balanceSats)}</span>
                  <span className="ml-1 text-[10px] font-normal uppercase tracking-wider text-white/35">WJK</span>
                  {usdtPerWjk != null && (
                    <div className="text-[9px] font-sans normal-case tracking-normal text-white/35">
                      ${fmtUsd(walletBalanceSats, usdtPerWjk)} · ${fmtUsd(balanceSats, usdtPerWjk)}
                    </div>
                  )}
                  <div className="text-[9px] uppercase tracking-wider text-white/35">Wallet · Table</div>
                </div>
              ) : (
                <>
                  <div className="text-[10px] uppercase tracking-wider text-white/40">Balance</div>
                  <div className="tabular font-display text-xl text-gold">
                    {fmtWJK(balanceSats)} <span className="text-sm text-white/50">WJK</span>
                  </div>
                  {usdtPerWjk != null && (
                    <div className="text-[10px] text-white/40">${fmtUsd(balanceSats, usdtPerWjk)}</div>
                  )}
                </>
              )}
            </div>
            <button
              onClick={onDeposit}
              className="btn-action bg-emerald-500/90 text-emerald-950 hover:bg-emerald-400"
            >
              Deposit
            </button>
            <button
              onClick={onWithdraw}
              className="btn-action bg-white/10 text-white hover:bg-white/15"
            >
              Cash out
            </button>
            <button
              onClick={onDisconnect}
              title={address}
              className="rounded-full border border-gold/30 bg-black/30 px-3 py-2 font-mono text-xs text-white/80 hover:border-gold/60"
            >
              {truncate(address)}
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-end gap-1">
            <button
              onClick={onConnect}
              disabled={connecting}
              className="btn-action bg-gradient-to-br from-gold to-gold-dark text-ink shadow-glow hover:brightness-105"
            >
              {connecting ? "Connecting…" : installed ? "Connect Wallet" : "Install Wojak Wallet"}
            </button>
            {demoMode && onDemo && (
              <button onClick={onDemo} className="text-[11px] text-white/45 underline decoration-dotted hover:text-gold">
                or try demo without a wallet
              </button>
            )}
          </div>
        )}
      </div>
    </header>
  );
}
