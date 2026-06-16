import { useState } from "react";
import { shortHash } from "../lib/format.js";
import { verifyRoundOnChain } from "../lib/verify.js";

function Copy({ value }) {
  const [done, setDone] = useState(false);
  return (
    <button
      onClick={() => {
        navigator.clipboard?.writeText(value);
        setDone(true);
        setTimeout(() => setDone(false), 1200);
      }}
      className="ml-1 text-white/40 hover:text-gold"
      title="Copy"
    >
      {done ? "✓" : "⧉"}
    </button>
  );
}

function Row({ label, children }) {
  return (
    <div className="flex items-center justify-between gap-3 py-1.5 text-sm">
      <span className="text-white/45">{label}</span>
      <span className="font-mono text-white/85">{children}</span>
    </div>
  );
}

function Check({ ok, children }) {
  const cls = ok === null ? "text-white/40" : ok ? "text-emerald-300" : "text-rose-400";
  const mark = ok === null ? "•" : ok ? "✓" : "✗";
  return (
    <div className={`flex items-start gap-1.5 ${cls}`}>
      <span className="mt-px">{mark}</span>
      <span>{children}</span>
    </div>
  );
}

export default function FairnessPanel({
  commitment,
  clientSeed,
  nonce,
  epoch,
  chain,
  demoMode,
  revealed,
  editable,
  onSaveClientSeed,
}) {
  const [seed, setSeed] = useState(clientSeed || "");
  const [result, setResult] = useState(null);
  const [verifying, setVerifying] = useState(false);
  const [showDeck, setShowDeck] = useState(false);

  const anchor = epoch?.anchor ?? revealed?.anchor;
  const anchorTxid = epoch?.anchorTxid ?? revealed?.anchorTxid;
  const txUrl = chain?.explorerTxBase && anchorTxid ? `${chain.explorerTxBase}/${anchorTxid}` : null;

  const runVerify = async () => {
    setVerifying(true);
    setResult(null);
    try {
      setResult(await verifyRoundOnChain(revealed, chain));
    } finally {
      setVerifying(false);
    }
  };

  return (
    <div className="glass rounded-2xl p-4">
      <div className="mb-2 flex items-center gap-2">
        <span className="text-lg">🛡️</span>
        <h3 className="font-display text-xl tracking-wide text-gold">Provably Fair · On-Chain</h3>
      </div>
      <p className="mb-3 text-xs leading-relaxed text-white/45">
        The house writes one <span className="text-white/70">anchor</span> on-chain that commits a
        whole hash chain of per-hand seeds. Each hand reveals a fresh seed that hashes straight back
        to that on-chain value — so you verify against the blockchain, not this server.
      </p>

      {/* On-chain anchor — the root of trust */}
      <div className="rounded-xl border border-gold/15 bg-black/30 px-3 py-2">
        <div className="mb-1 flex items-center justify-between">
          <span className="text-[11px] uppercase tracking-wider text-gold/70">On-chain anchor</span>
          {epoch && (
            <span className="text-[11px] text-white/40">
              hand {Math.min((epoch.used ?? 0), epoch.length)} / {epoch.length}
            </span>
          )}
        </div>
        <Row label="Anchor">
          {anchor ? shortHash(anchor, 8) : "—"}
          {anchor && <Copy value={anchor} />}
        </Row>
        <Row label="Anchor tx">
          {anchorTxid ? (
            txUrl ? (
              <a href={txUrl} target="_blank" rel="noreferrer" className="text-sky-300 hover:text-sky-200 underline decoration-dotted">
                {shortHash(anchorTxid, 8)}
              </a>
            ) : (
              shortHash(anchorTxid, 8)
            )
          ) : (
            "—"
          )}
          {demoMode && <span className="ml-1 rounded bg-amber-400/15 px-1 text-[10px] text-amber-200/80">demo chain</span>}
        </Row>
      </div>

      {/* Per-hand commitment */}
      <div className="mt-2 rounded-xl bg-black/30 px-3 py-2 ring-1 ring-white/5">
        <Row label="This hand's commit">
          {commitment ? shortHash(commitment, 8) : "—"}
          {commitment && <Copy value={commitment} />}
        </Row>
        <Row label="Nonce">{nonce ?? "—"}</Row>
        <Row label="Client seed">{clientSeed ? shortHash(clientSeed, 8) : "—"}</Row>
      </div>

      {editable && (
        <div className="mt-3">
          <label className="text-[11px] uppercase tracking-wider text-white/40">
            Your client seed (you control randomness)
          </label>
          <div className="mt-1 flex gap-2">
            <input
              value={seed}
              onChange={(e) => setSeed(e.target.value)}
              placeholder="custom client seed"
              className="min-w-0 flex-1 rounded-lg border border-white/10 bg-black/40 px-3 py-2 font-mono text-sm text-white outline-none focus:border-gold/50"
            />
            <button
              onClick={() => onSaveClientSeed(seed)}
              className="rounded-lg bg-gold/90 px-3 py-2 text-sm font-bold text-ink hover:bg-gold"
            >
              Set
            </button>
          </div>
        </div>
      )}

      {revealed?.serverSeed && (
        <div className="mt-3 rounded-xl border border-emerald-400/15 bg-black/25 p-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs uppercase tracking-wider text-white/45">Last hand · revealed seed</span>
            <button
              onClick={runVerify}
              disabled={verifying}
              className="rounded-lg bg-emerald-500/90 px-3 py-1 text-xs font-bold text-emerald-950 hover:bg-emerald-400 disabled:opacity-50"
            >
              {verifying ? "Verifying…" : "Verify on-chain"}
            </button>
          </div>
          <Row label="Server seed">
            {shortHash(revealed.serverSeed, 10)}
            <Copy value={revealed.serverSeed} />
          </Row>

          {result && (
            <div className="mt-2 space-y-1 text-sm">
              <Check ok={result.error ? false : result.anchorReadOk}>
                anchor read from chain matches this hand
              </Check>
              <Check ok={result.error ? false : result.linkOk}>
                revealed seed hashes to the <b>on-chain</b> anchor
              </Check>
              <Check ok={result.commitmentOk}>SHA-256(serverSeed) = pre-deal commitment</Check>
              <Check ok={result.deckOk}>deck recomputed from seeds matches the deck played</Check>
              {result.error && <div className="text-rose-400/90 text-xs">chain read failed: {result.error}</div>}
              {txUrl && (
                <a href={txUrl} target="_blank" rel="noreferrer" className="block text-xs text-sky-300/80 underline decoration-dotted hover:text-sky-200">
                  inspect the anchor transaction ↗
                </a>
              )}
              <button
                onClick={() => setShowDeck((s) => !s)}
                className="mt-1 text-xs text-white/50 underline decoration-dotted hover:text-gold"
              >
                {showDeck ? "hide" : "show"} recomputed deck
              </button>
              {showDeck && (
                <div className="mt-1 flex flex-wrap gap-1 font-mono text-[11px] text-white/70">
                  {result.deck.map((c, i) => (
                    <span key={i} className="rounded bg-white/5 px-1">
                      {c}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
