import { useCallback, useEffect, useRef, useState } from "react";
import { getWojakProvider, isInstalled } from "./lib/wojak.js";
import { api } from "./lib/api.js";
import { fmtWJK, formatInsuranceBreakdown } from "./lib/format.js";
import WalletBar from "./components/WalletBar.jsx";
import Table from "./components/Table.jsx";
import Controls from "./components/Controls.jsx";
import FairnessPanel from "./components/FairnessPanel.jsx";
import Modal from "./components/Modal.jsx";
import Toasts from "./components/Toasts.jsx";

const EXTENSION_URL =
  "https://chromewebstore.google.com/detail/wojak-wallet/jgepofplloabbpjnidnmkpmjdikockkb";

export default function App() {
  const [provider, setProvider] = useState(null);
  const [installed, setInstalled] = useState(isInstalled());
  const [connecting, setConnecting] = useState(false);
  const [address, setAddress] = useState(null);

  const [config, setConfig] = useState(null);
  const [house, setHouse] = useState(null);
  const [player, setPlayer] = useState(null);
  const [walletBalanceSats, setWalletBalanceSats] = useState(null);

  const [betSats, setBetSats] = useState(1e8);
  const [busy, setBusy] = useState(false);
  const [toasts, setToasts] = useState([]);
  const [modal, setModal] = useState(null); // 'deposit' | 'withdraw'
  const [lastSettled, setLastSettled] = useState(null);

  const prevFinishedId = useRef(null);

  const toast = useCallback((t) => {
    const id = Math.random().toString(36).slice(2);
    setToasts((ts) => [...ts, { id, ...t }]);
    setTimeout(() => setToasts((ts) => ts.filter((x) => x.id !== id)), 5500);
  }, []);

  // Load static config + detect the wallet provider on mount.
  useEffect(() => {
    api.config().then(setConfig).catch(() => {});
    api.house().then(setHouse).catch(() => {});
    getWojakProvider().then((p) => {
      setProvider(p);
      setInstalled(!!p);
    });
  }, []);

  const refreshWalletBalance = useCallback(
    async (p = provider) => {
      if (!p || config?.demoMode) {
        setWalletBalanceSats(null);
        return;
      }
      try {
        const bal = await p.getBalance();
        setWalletBalanceSats(Number(bal) || 0);
      } catch {
        setWalletBalanceSats(null);
      }
    },
    [provider, config?.demoMode]
  );

  const refresh = useCallback(
    async (addr = address, p = provider) => {
      if (!addr) return;
      const [s, h] = await Promise.all([api.state(addr), api.house().catch(() => house)]);
      setPlayer(s);
      if (h) setHouse(h);
      await refreshWalletBalance(p);
      return s;
    },
    [address, house, provider, refreshWalletBalance]
  );

  const connect = useCallback(async () => {
    const p = provider || (await getWojakProvider());
    if (!p) {
      window.open(EXTENSION_URL, "_blank", "noopener,noreferrer");
      toast({
        tone: "error",
        title: "Wojak Wallet not found",
        body: "Install the extension from the Chrome Web Store and reload.",
        link: EXTENSION_URL,
      });
      return;
    }
    setConnecting(true);
    try {
      const addr = await p.connect();
      setProvider(p);
      setAddress(addr);
      await refresh(addr);
      toast({ tone: "info", title: "Wallet connected", body: addr });
      p.on?.("accountsChanged", (a) => {
        const next = Array.isArray(a) ? a[0] : a?.address ?? a;
        setAddress(next || null);
        if (next) refresh(next);
      });
      p.on?.("disconnect", () => setAddress(null));
    } catch (e) {
      toast({ tone: "error", title: "Connection rejected", body: e.message });
    } finally {
      setConnecting(false);
    }
  }, [provider, refresh, toast]);

  useEffect(() => {
    if (address && provider && config && !config.demoMode) {
      refreshWalletBalance(provider);
    }
  }, [address, provider, config, refreshWalletBalance]);

  // Detect a freshly-settled round
  useEffect(() => {
    const r = player?.activeRound;
    if (r?.finished && r.roundId !== prevFinishedId.current) {
      prevFinishedId.current = r.roundId;
      setLastSettled(r.fair);
      const net = r.net;
      const bj = r.hands.some((h) => h.result === "blackjack");
      const breakdown = formatInsuranceBreakdown(r);
      toast({
        tone: net > 0 ? "win" : net < 0 ? "lose" : "info",
        title: bj && net > 0 ? "Blackjack! 🃏" : net > 0 ? "You win!" : net < 0 ? "Dealer wins" : "Push",
        body: breakdown
          ? `${breakdown} · Net ${net > 0 ? "+" : ""}${fmtWJK(net)} WJK`
          : net > 0
          ? `+${fmtWJK(net)} WJK`
          : net < 0
          ? `${fmtWJK(net)} WJK`
          : "Bet returned",
      });
      api.house().then(setHouse).catch(() => {});
    }
  }, [player, toast]);

  const playDemo = useCallback(async () => {
    const guest = "Wdemo" + Math.random().toString(36).slice(2, 12);
    setAddress(guest);
    await refresh(guest);
    toast({ tone: "info", title: "Demo session started", body: "Free play balance credited" });
  }, [refresh, toast]);

  const guard = async (fn) => {
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      toast({ tone: "error", title: "Error", body: e.message });
    } finally {
      setBusy(false);
    }
  };

  const deal = () =>
    guard(async () => {
      const s = await api.startRound(address, betSats);
      setPlayer(s);
    });

  const act = (action) =>
    guard(async () => {
      const s = await api.action(address, action);
      setPlayer(s);
    });

  const saveClientSeed = (seed) =>
    guard(async () => {
      const s = await api.setClientSeed(address, seed);
      setPlayer(s);
      toast({ tone: "info", title: "Client seed updated" });
    });

  const round = player?.activeRound;
  const finished = !!round?.finished;
  const phase = !round
    ? "betting"
    : finished
    ? "settled"
    : round?.awaiting?.phase === "insurance"
    ? "insurance"
    : "playing";
  const legalActions = round?.awaiting?.legalActions ?? [];
  const balanceSats = player?.balanceSats ?? 0;

  // Keep the bet within balance once connected.
  useEffect(() => {
    if (player && betSats > balanceSats) setBetSats(Math.max(0, balanceSats));
  }, [balanceSats]); // eslint-disable-line

  return (
    <div className="flex h-[100dvh] flex-col overflow-hidden">
      <WalletBar
        installed={installed}
        address={address}
        walletBalanceSats={walletBalanceSats}
        balanceSats={balanceSats}
        network={config?.network}
        demoMode={config?.demoMode}
        connecting={connecting}
        onConnect={connect}
        onDisconnect={() => {
          setAddress(null);
          setWalletBalanceSats(null);
        }}
        onDeposit={() => setModal("deposit")}
        onWithdraw={() => setModal("withdraw")}
        onDemo={playDemo}
      />

      <main className="mx-auto grid min-h-0 w-full max-w-6xl flex-1 grid-cols-1 gap-3 px-3 pb-3 pt-2 lg:grid-cols-[minmax(0,1fr)_300px] lg:gap-4 lg:px-4">
        <section className="flex min-h-0 flex-col gap-2">
          <div className="flex min-h-0 flex-1 items-stretch">
            <Table round={round} phase={phase} lastNet={finished ? round.net : 0} rules={config?.rules} />
          </div>

          <div className="glass shrink-0 rounded-2xl p-3 sm:p-4">
            <Controls
              phase={phase}
              betSats={betSats}
              setBetSats={setBetSats}
              minBetSats={config?.minBetSats ?? 5e6}
              maxBetSats={config?.maxBetSats ?? 25e8}
              balanceSats={balanceSats}
              legalActions={legalActions}
              onDeal={deal}
              onAction={act}
              busy={busy}
              connected={!!address}
              insurance={round?.insurance}
            />
          </div>
        </section>

        <aside className="hidden min-h-0 flex-col gap-3 overflow-y-auto pb-1 lg:flex">
          <HouseCard
            house={house}
            walletBalanceSats={walletBalanceSats}
            balanceSats={balanceSats}
            demoMode={config?.demoMode}
          />
          <FairnessPanel
            commitment={round?.fair?.commitment}
            clientSeed={player?.clientSeed}
            nonce={round?.fair?.nonce ?? player?.epoch?.used ?? 0}
            epoch={player?.epoch}
            chain={config}
            demoMode={config?.demoMode}
            revealed={lastSettled}
            editable={phase !== "playing" && !!address}
            onSaveClientSeed={saveClientSeed}
          />
          <HistoryCard history={player?.history} explorer={config?.explorerUrl} />
        </aside>
      </main>

      <footer className="hidden shrink-0 border-t border-white/5 px-4 py-1.5 text-center text-[10px] text-white/25 xl:block">
        Provably-fair on-chain blackjack for WojakCoin (WJK).{" "}
        {config?.demoMode
          ? "Running in demo mode — no real funds move."
          : "Live mode — settled on-chain by the house wallet."}{" "}
        House: <span className="font-mono">{config?.houseAddress}</span>
      </footer>

      <DepositWithdrawModals
        modal={modal}
        onClose={() => setModal(null)}
        config={config}
        provider={provider}
        address={address}
        balanceSats={balanceSats}
        toast={toast}
        afterTx={() => refresh()}
      />

      <Toasts toasts={toasts} />
    </div>
  );
}

function HouseCard({ house, walletBalanceSats, balanceSats, demoMode }) {
  return (
    <div className="glass rounded-2xl p-4">
      <div className={`grid gap-3 ${demoMode ? "grid-cols-2" : "grid-cols-2 sm:grid-cols-3"}`}>
        {!demoMode && walletBalanceSats != null && (
          <Stat label="Wallet balance" value={`${fmtWJK(walletBalanceSats)} WJK`} />
        )}
        <Stat label={demoMode ? "Your balance" : "Table balance"} value={`${fmtWJK(balanceSats)} WJK`} accent />
        <Stat label="House bankroll" value={house ? `${fmtWJK(house.bankrollSats)} WJK` : "…"} />
      </div>
      {!demoMode && (
        <div className="mt-3 rounded-lg bg-black/25 px-3 py-2 text-[11px] leading-relaxed text-white/45">
          <span className="text-white/65">Wallet</span> is on-chain WJK in your extension.{" "}
          <span className="text-white/65">Table</span> is your deposited playable balance on the house server — deposit to play, cash out to return funds.
        </div>
      )}
      {demoMode && (
        <div className="mt-3 rounded-lg bg-amber-400/10 px-3 py-2 text-[11px] leading-relaxed text-amber-200/80">
          Demo mode: you start with a free balance and no real WJK moves. Flip
          <span className="font-mono"> DEMO_MODE=false </span> and fund the house to go live.
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, accent }) {
  return (
    <div className="rounded-xl bg-black/25 px-3 py-2 ring-1 ring-white/5">
      <div className="text-[10px] uppercase tracking-wider text-white/40">{label}</div>
      <div className={`tabular font-display text-xl ${accent ? "text-gold" : "text-white/85"}`}>{value}</div>
    </div>
  );
}

function HistoryCard({ history, explorer }) {
  if (!history?.length) {
    return (
      <div className="glass rounded-2xl p-4 text-sm text-white/40">
        <h3 className="mb-1 font-display text-xl tracking-wide text-gold">History</h3>
        Your last hands will appear here.
      </div>
    );
  }
  return (
    <div className="glass rounded-2xl p-4">
      <h3 className="mb-2 font-display text-xl tracking-wide text-gold">Recent hands</h3>
      <div className="scrollbar-thin max-h-72 space-y-1.5 overflow-y-auto pr-1">
        {history.map((h) => (
          <div key={h.id} className="flex items-center justify-between rounded-lg bg-black/25 px-3 py-1.5 text-sm">
            <span className="text-white/40">#{h.nonce}</span>
            <span
              className={`font-semibold ${h.result === "win" ? "text-emerald-300" : h.result === "lose" ? "text-rose-400" : "text-white/60"}`}
            >
              {h.net > 0 ? "+" : ""}
              {fmtWJK(h.net)} WJK
            </span>
            <span className="font-mono text-[10px] text-white/30" title={`commit ${h.commitment}`}>
              {(h.commitment ?? "").slice(0, 6)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function DepositWithdrawModals({ modal, onClose, config, provider, address, balanceSats, toast, afterTx }) {
  const [amount, setAmount] = useState("10");
  const [pending, setPending] = useState(false);
  const demo = config?.demoMode;
  const explorer = config?.explorerUrl;

  const amountSats = Math.round(Number(amount) * 1e8) || 0;

  const doDeposit = async () => {
    setPending(true);
    try {
      if (demo) {
        await api.deposit(address, { amountSats });
        toast({ tone: "win", title: "Deposited (demo)", body: `+${amount} WJK credited` });
      } else {
        if (!provider) throw new Error("wallet not connected");
        const rawTxHex = await provider.createTx({
          to: config.houseAddress,
          amount: amountSats,
          receiverToPayFee: false,
          feeRate: config.feeRate,
        });
        const res = await api.deposit(address, { rawTxHex });
        toast({
          tone: "win",
          title: "Deposit broadcast",
          body: `${amount} WJK → house`,
          link: res.deposit?.txid ? `${explorer}/tx/${res.deposit.txid}` : undefined,
        });
      }
      await afterTx();
      onClose();
    } catch (e) {
      toast({ tone: "error", title: "Deposit failed", body: e.message });
    } finally {
      setPending(false);
    }
  };

  const doWithdraw = async () => {
    setPending(true);
    try {
      const res = await api.withdraw(address, amountSats);
      toast({
        tone: "info",
        title: demo ? "Cashed out (demo)" : "Withdrawal broadcast",
        body: `${amount} WJK → ${address.slice(0, 8)}…`,
        link: !demo && res.withdrawal?.txid ? `${explorer}/tx/${res.withdrawal.txid}` : undefined,
      });
      await afterTx();
      onClose();
    } catch (e) {
      toast({ tone: "error", title: "Withdrawal failed", body: e.message });
    } finally {
      setPending(false);
    }
  };

  const isDeposit = modal === "deposit";
  const max = isDeposit ? null : toWJK(balanceSats);

  return (
    <Modal open={!!modal} onClose={onClose} title={isDeposit ? "Deposit WJK" : "Cash out WJK"}>
      <p className="mb-4 text-sm text-white/50">
        {isDeposit
          ? demo
            ? "Demo mode credits your balance instantly — no on-chain transaction."
            : "This builds a transaction in your Wojak Wallet sending WJK to the house address. Funds become your game balance."
          : demo
          ? "Demo mode returns your balance instantly — no on-chain transaction."
          : "The house wallet signs and broadcasts a real payout transaction to your address."}
      </p>

      <label className="text-[11px] uppercase tracking-wider text-white/40">Amount (WJK)</label>
      <div className="mt-1 flex gap-2">
        <input
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          type="number"
          min="0"
          className="min-w-0 flex-1 rounded-lg border border-white/10 bg-black/40 px-3 py-2 font-display text-2xl text-gold outline-none focus:border-gold/50"
        />
        {!isDeposit && (
          <button onClick={() => setAmount(String(max))} className="rounded-lg bg-white/5 px-3 text-sm text-white/60 hover:bg-white/10">
            Max
          </button>
        )}
      </div>

      <div className="mt-2 flex gap-2">
        {(isDeposit ? [10, 50, 100, 500] : [1, 5, 25]).map((v) => (
          <button
            key={v}
            onClick={() => setAmount(String(v))}
            className="rounded-lg bg-white/5 px-3 py-1 text-sm text-white/70 hover:bg-white/10"
          >
            {v}
          </button>
        ))}
      </div>

      <button
        onClick={isDeposit ? doDeposit : doWithdraw}
        disabled={pending || amountSats <= 0 || (!isDeposit && amountSats > balanceSats)}
        className="btn-action mt-5 w-full bg-gradient-to-br from-gold to-gold-dark text-lg font-extrabold text-ink shadow-glow disabled:opacity-40"
      >
        {pending ? "Working…" : isDeposit ? "Deposit" : "Cash out"}
      </button>
    </Modal>
  );
}
