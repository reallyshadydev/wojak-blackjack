import { useState } from "react";
import Modal from "./Modal.jsx";
import { formatBlackjackPays } from "../lib/rules.js";

const WOJAK_WALLET_URL =
  "https://chromewebstore.google.com/detail/wojak-wallet/jgepofplloabbpjnidnmkpmjdikockkb";

const TABS = [
  { id: "start", label: "Get started" },
  { id: "hand", label: "Play a hand" },
  { id: "actions", label: "Actions" },
  { id: "table", label: "This table" },
  { id: "fair", label: "Fairness" },
];

function Section({ title, children }) {
  return (
    <div className="mb-4 last:mb-0">
      <h4 className="mb-1.5 font-display text-sm uppercase tracking-wider text-gold">{title}</h4>
      <div className="space-y-1.5 text-sm leading-relaxed text-white/75">{children}</div>
    </div>
  );
}

function Step({ n, title, children }) {
  return (
    <div className="flex gap-3">
      <div className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-gold/15 font-display text-sm text-gold ring-1 ring-gold/30">
        {n}
      </div>
      <div className="min-w-0 flex-1 pb-3">
        <div className="mb-0.5 font-medium text-white/90">{title}</div>
        <div className="text-sm leading-relaxed text-white/65">{children}</div>
      </div>
    </div>
  );
}

function Row({ k, v, good }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-white/5 py-1.5 last:border-0">
      <span className="text-white/55">{k}</span>
      <span
        className={`text-right font-mono text-xs ${
          good === true ? "text-emerald-300" : good === false ? "text-amber-300" : "text-white/85"
        }`}
      >
        {v}
      </span>
    </div>
  );
}

function Tip({ children }) {
  return (
    <div className="rounded-lg border border-gold/20 bg-gold/5 px-3 py-2 text-xs leading-relaxed text-gold/90">
      {children}
    </div>
  );
}

function mergeRules(rules = {}) {
  return {
    decks: 1,
    dealerHitsSoft17: false,
    blackjackPays: 1.5,
    maxSplits: 3,
    doubleAfterSplit: true,
    oneCardAfterSplitAce: true,
    noResplitAces: true,
    lateSurrender: true,
    insuranceOffered: true,
    insurancePays: 2,
    ...rules,
  };
}

function GetStarted({ demoMode }) {
  return (
    <>
      <Section title="What you need">
        <p>
          Wojak Blackjack is real-money blackjack on Wojakcoin. You bet <b>WJK</b> from a table balance
          held by the house; wins and losses settle against that balance. In live mode every deposit and
          cash-out is an on-chain WJK transfer.
        </p>
      </Section>

      <Section title="Setup (live mode)">
        <div className="space-y-0">
          <Step n="1" title="Install Wojak Wallet">
            Get the{" "}
            <a
              href={WOJAK_WALLET_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="text-gold underline decoration-gold/40 underline-offset-2 hover:text-gold/80"
            >
              Chrome extension
            </a>
            . You need WJK in your wallet to play.
          </Step>
          <Step n="2" title="Connect">
            Click <b>Connect</b> in the header and approve the site in your wallet.
          </Step>
          <Step n="3" title="Deposit to the table">
            Use <b>Deposit</b> to send WJK on-chain to the house. That amount becomes your{" "}
            <b>table balance</b> — the chips you bet with. Your wallet balance and table balance are
            both shown in the header (Wallet · Table).
          </Step>
          <Step n="4" title="Set your bet & deal">
            Pick a bet with the chip buttons or type an amount, then press <b>Deal</b>. The bet is
            deducted from your table balance when the hand starts.
          </Step>
          <Step n="5" title="Cash out">
            When you are done, <b>Withdraw</b> moves WJK from your table balance back to your wallet
            on-chain.
          </Step>
        </div>
      </Section>

      {demoMode ? (
        <Tip>
          <b>Demo mode</b> skips the wallet — you get play money instantly. Rules and dealing are
          identical to live play.
        </Tip>
      ) : (
        <Tip>
          Minimum and maximum bets are enforced before you deal. Dollar amounts beside WJK use the live
          NonKYC WJK/USDT price and are for reference only.
        </Tip>
      )}
    </>
  );
}

function PlayAHand({ r }) {
  return (
    <>
      <Section title="Goal">
        Beat the dealer by getting closer to <b>21</b> without going over. Totals above 21{" "}
        <b>bust</b> and lose immediately. If the dealer busts and you did not, you win.
      </Section>

      <Section title="Card values">
        <div>• Number cards 2–10 count as printed.</div>
        <div>• Jack, Queen, King each count as 10.</div>
        <div>
          • Ace counts as 1 or 11 — whichever helps more. A hand that can use an Ace as 11 is{" "}
          <b>soft</b> (e.g. A+6 = soft 17).
        </div>
        <div className="text-white/45">
          Natural blackjack = exactly two cards totalling 21 (Ace + ten-value card).
        </div>
      </Section>

      <Section title="Flow of one hand">
        <div className="space-y-0">
          <Step n="1" title="Deal">
            You receive two face-up cards. The dealer gets one face-up and one face-down (hole card).
          </Step>
          <Step n="2" title="Dealer peek">
            If the dealer shows an Ace or a 10-value card, they peek for blackjack before you act. If
            they have it, the hand ends (unless you also have blackjack).
          </Step>
          {r.insuranceOffered && (
            <Step n="3" title="Insurance / even money">
              When the dealer shows an Ace you may take <b>insurance</b> (half your main bet) before
              anything else. It pays {r.insurancePays}:1 if the dealer has blackjack. If you already
              have blackjack vs an Ace, the same choice appears as <b>even money</b> — take a
              guaranteed 1:1 instead of risking a push.
            </Step>
          )}
          <Step n={r.insuranceOffered ? "4" : "3"} title="Your turn">
            Choose hit, stand, double, split, or surrender (when offered). You may play up to{" "}
            {r.maxSplits + 1} hands if you split pairs.
          </Step>
          <Step n={r.insuranceOffered ? "5" : "4"} title="Dealer plays">
            After all your hands finish, the dealer reveals the hole card and draws according to house
            rules (hits 16 or less; on 17+ they {r.dealerHitsSoft17 ? "hit soft 17" : "stand"}).
          </Step>
          <Step n={r.insuranceOffered ? "6" : "5"} title="Settle">
            Each hand is compared to the dealer. Your net win/loss (main bet + insurance) is shown on
            the felt. Start a new hand with <b>Deal</b>.
          </Step>
        </div>
      </Section>
    </>
  );
}

function ActionsGuide({ r }) {
  return (
    <>
      <Section title="Hit">
        Take another card. You may hit repeatedly until you stand or bust.
      </Section>

      <Section title="Stand">
        Keep your total and end play on that hand.
      </Section>

      <Section title="Double down">
        Double your bet on that hand and receive exactly <b>one</b> more card, then you must stand.
        Available on your first two cards on that hand
        {r.doubleAfterSplit ? " (including after a split, except split aces)" : " (not after a split)"}.
      </Section>

      <Section title="Split">
        If your first two cards are a pair, split them into two hands. Each hand gets a second card and
        an equal bet. You may split up to {r.maxSplits} times ({r.maxSplits + 1} hands total).
        {r.oneCardAfterSplitAce && (
          <div className="mt-1.5 text-white/55">
            <b>Split aces:</b> each ace hand receives exactly one card and then stands automatically —
            no hit, double, or resplit on those hands.
            {r.noResplitAces && " You cannot split aces a second time."}
          </div>
        )}
      </Section>

      {r.lateSurrender && (
        <Section title="Surrender">
          Forfeit the hand after the dealer peek and lose only <b>half</b> your bet. Only available on
          your original two-card hand before you hit or split.
        </Section>
      )}

      {r.insuranceOffered && (
        <Section title="Insurance">
          A side bet up to half your main wager when the dealer shows an Ace. Pays {r.insurancePays}:1
          if the dealer has blackjack; otherwise the insurance bet loses and the main hand continues.
        </Section>
      )}
    </>
  );
}

function TableRules({ r, minBet, maxBet }) {
  const isSixFive = r.blackjackPays === 1.2;
  return (
    <>
      <Section title="Active house rules">
        <div className="rounded-lg bg-black/30 px-3 py-1 ring-1 ring-white/5">
          <Row k="Blackjack pays" v={formatBlackjackPays(r.blackjackPays)} good={r.blackjackPays === 1.5} />
          <Row
            k="Dealer on soft 17"
            v={r.dealerHitsSoft17 ? "Hits (H17)" : "Stands (S17)"}
            good={!r.dealerHitsSoft17}
          />
          <Row k="Decks" v={`${r.decks} — reshuffled every hand`} />
          <Row k="Double down" v="Any first two cards" good />
          <Row
            k="Double after split"
            v={r.doubleAfterSplit ? "Yes (not on split aces)" : "No"}
            good={r.doubleAfterSplit}
          />
          <Row k="Max hands from splits" v={`${r.maxSplits + 1}`} />
          <Row
            k="Split aces"
            v={`One card each${r.noResplitAces ? ", no resplit" : ""}`}
          />
          <Row
            k="Late surrender"
            v={r.lateSurrender ? "Yes — lose half" : "No"}
            good={r.lateSurrender}
          />
          <Row
            k="Insurance"
            v={r.insuranceOffered ? `${r.insurancePays}:1` : "Not offered"}
          />
          {minBet != null && <Row k="Bet limits" v={`${minBet} – ${maxBet} WJK`} />}
        </div>
      </Section>

      {isSixFive && (
        <Tip>
          This table pays <b>6:5</b> on blackjack instead of the traditional 3:2. A $10 blackjack wins
          $12 here vs $15 at a 3:2 table — check the felt label before you play.
        </Tip>
      )}

      <Section title="Payouts">
        <div className="rounded-lg bg-black/30 px-3 py-1 ring-1 ring-white/5">
          <Row k="Blackjack (natural)" v={formatBlackjackPays(r.blackjackPays)} />
          <Row k="Regular win" v="1:1 (even money)" />
          <Row k="Push (tie)" v="Bet returned" />
          {r.lateSurrender && <Row k="Surrender" v="Lose half" />}
          <Row k="Insurance wins" v={`${r.insurancePays}:1 on insurance stake`} />
          <Row k="Bust / lose" v="Lose bet" />
        </div>
      </Section>

      <Section title="Dealer">
        <div>• Hits on 16 or less; stands on hard 17+.</div>
        <div>
          • Soft 17 (Ace+6): dealer {r.dealerHitsSoft17 ? "hits" : "stands"} on this table.
        </div>
        <div>• Dealer peeks for blackjack when showing Ace or 10-value card.</div>
      </Section>
    </>
  );
}

function FairnessGuide() {
  return (
    <>
      <Section title="Provably fair dealing">
        <p>
          Every hand uses a shuffled deck derived from cryptographic seeds. Before you act, the server
          commits to the next shuffle with an on-chain anchor. When the hand finishes, the server seed
          is revealed so you can re-run the shuffle yourself and confirm every card matched what you saw.
        </p>
      </Section>

      <Section title="What you can verify">
        <div>• The committed server seed hash matches the reveal after the hand.</div>
        <div>• Your client seed and the round nonce determine shuffle order with the server seed.</div>
        <div>• The same rules engine runs on the server and in the fairness panel — card order and payouts must agree.</div>
      </Section>

      <Section title="Client seed">
        <p>
          You may set your own client seed in the <b>Provably Fair</b> sidebar before dealing. Changing
          it affects future shuffles once the current epoch advances. Leave it blank to use a random seed
          from the server.
        </p>
      </Section>

      <Tip>
        After a hand settles, open the fairness panel to inspect the reveal, recompute the deck, and
        compare the outcome to what was dealt on the table.
      </Tip>
    </>
  );
}

/** Tabbed how-to-play guide and table rules reference. */
export default function RulesModal({ open, onClose, rules = {}, minBet, maxBet, demoMode }) {
  const [tab, setTab] = useState("start");
  const r = mergeRules(rules);

  const panels = {
    start: <GetStarted demoMode={demoMode} />,
    hand: <PlayAHand r={r} />,
    actions: <ActionsGuide r={r} />,
    table: <TableRules r={r} minBet={minBet} maxBet={maxBet} />,
    fair: <FairnessGuide />,
  };

  return (
    <Modal open={open} onClose={onClose} title="How to play" wide>
      <div className="mb-3 flex flex-wrap gap-1.5">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-wider transition ${
              tab === t.id
                ? "bg-gold/20 text-gold ring-1 ring-gold/40"
                : "bg-white/5 text-white/50 hover:bg-white/10 hover:text-white/75"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="max-h-[min(65vh,520px)] overflow-y-auto pr-1 scrollbar-thin">{panels[tab]}</div>
    </Modal>
  );
}
