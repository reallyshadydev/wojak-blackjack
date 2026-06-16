# 🃏 WojakCoin Blackjack — Provably Fair, On-Chain

A production-ready, **provably-fair** blackjack game for the
[WojakCoin](https://wojakcoin.cash) (WJK) blockchain. Players connect the
**Wojak Wallet** browser extension, deposit WJK on-chain into a bankroll, play
real blackjack against the house, and cash out on-chain. Every hand is committed
to with `SHA-256(serverSeed)` **before** any card is dealt and the seed is
revealed the instant the hand ends, so the deck can be recomputed and verified
by anyone — trusting math, not the operator.

Built on the [`wojak-sdk`](https://github.com/reallyshadydev/wojak-sdk) provider
interface and the
[`wojak-wallet-extension`](https://github.com/reallyshadydev/wojak-wallet-extension).

```
┌────────────┐   connect / createTx / signMessage   ┌────────────────┐
│  Web dApp  │ ───────────────────────────────────► │  Wojak Wallet  │
│ (React)    │                                      │  (extension)   │
└─────┬──────┘                                       └────────────────┘
      │ REST /api                ┌───────────────┐         ▲ broadcast
      ▼                          │  House server │  electrs│ /tx, /utxo
┌────────────┐  commit / reveal  │  + house key  │ ───────►│ api.wojakcoin.cash
│  Provably  │ ◄──────────────── │  + game engine│         ▼
│  Fair core │   shared code     └───────────────┘   WojakCoin chain
└────────────┘
```

---

## Features

- **Provably fair.** Fresh 32-byte server seed per hand, committed via SHA-256
  before the deal, revealed at settle. Deck = `HMAC-SHA256(serverSeed,
  "clientSeed:nonce:round")` → Fisher–Yates. You pick the client seed.
- **In-browser verifier.** Recomputes the commitment and the exact deck from the
  revealed seed using the **same** code the house ran — zero dependencies.
- **On-chain settlement.** Deposit and cash-out are real WojakCoin transactions.
  The house wallet signs and broadcasts payouts via the electrs REST API.
- **Real house wallet.** A generated legacy P2PKH (`W…`) keypair holds the
  bankroll; the private key never leaves the server.
- **Full blackjack rules.** Hit, Stand, Double, Split (incl. resplit & split
  aces), dealer peek, blackjack pays 3:2, dealer stands on 17.
- **Polished casino UI.** Felt table, dealt-card animations, chips, live
  fairness panel, hand history, deposit/cash-out, toasts.
- **Demo mode (default).** Plays instantly with a free balance and no real funds
  — perfect for trying it, and for development.

---

## Quick start

```bash
# from the repo root
npm run setup     # installs server + web deps and generates the house wallet
npm run dev       # runs the house server (:8787) and the web app (:5173)
```

Open <http://localhost:5173>. Click **Connect Wallet** (with the Wojak Wallet
extension installed) or **“try demo without a wallet”** to play immediately.

> Out of the box the server runs in **DEMO_MODE** — no real WJK moves and every
> new player gets a free play balance. See *Going live* below to settle on-chain.

---

## How provable fairness works — anchored on-chain

WojakCoin has no smart contracts, so the game *logic* can't run *in* the chain.
What lives on-chain is the **root of trust**: a single anchor that commits an
entire sequence of per-hand seeds in advance. You verify every hand against that
on-chain value, not against this server.

**The server-seed hash chain.** The house picks a secret 32-byte `terminal` and
folds it forward with SHA-256 `length` times:

```
node(0) = terminal           (secret)
node(k) = SHA256(node(k-1))
anchor  = node(length)       ← written ON-CHAIN (OP_RETURN) before any hand
```

Hand `nonce` (0-based) uses a **fresh** server seed `node(length-1-nonce)`,
revealed the instant the hand ends. Because
`SHA256(serverSeed(nonce)) = node(length-nonce)`, every revealed seed hashes
forward to the on-chain `anchor` (for nonce 0) or to the previous hand's seed —
so the house can't change any seed after the anchor is published.

**Per hand:**

1. **Anchor (once per epoch).** The house writes `anchor` on-chain in an
   OP_RETURN. One transaction commits the next `EPOCH_LENGTH` hands.
2. **Commit.** Before dealing, you see this hand's commitment
   `SHA256(serverSeed)` — which is just the prior chain link (the anchor, or the
   last revealed seed). Already determined; the house can't move it.
3. **Play.** The deck is derived deterministically; the seed stays secret.
4. **Reveal.** When the hand ends the server reveals `serverSeed`.
5. **Verify against the chain.** The in-browser verifier reads the anchor
   transaction straight from the chain, decodes the OP_RETURN, and confirms:

   ```
   SHA256^(nonce+1)(serverSeed) == on-chain anchor      ← the trustless check
   SHA256(serverSeed)           == pre-deal commitment
   bytes  = HMAC_SHA256(serverSeed, `${clientSeed}:${nonce}`)
   floats = every 4 bytes → b0/256 + b1/256² + b2/256³ + b3/256⁴  ∈ [0,1)
   deck   = Fisher–Yates(52-card deck, floats)          == the deck played
   ```

Because **you** choose `clientSeed` (after the anchor is on-chain), the house
can't grind for a favourable shuffle.

The whole scheme is dependency-free and shared by the house **and** your browser:

- [`shared/sha256.js`](shared/sha256.js) — SHA-256 + HMAC (FIPS/RFC test-vector verified)
- [`shared/provably-fair.js`](shared/provably-fair.js) — hash chain + deck derivation
- [`shared/onchain.js`](shared/onchain.js) — OP_RETURN anchor encode/decode
- [`shared/blackjack.js`](shared/blackjack.js) — the deterministic rules engine

> **Demo vs live.** In live mode the anchor is a real OP_RETURN transaction and
> the verifier reads it from `api.wojakcoin.cash` (with an explorer link to check
> independently). In demo mode the same-shaped transaction lives on a simulated
> chain served at `/chain/tx/:txid`, so the verifier's code path is identical and
> fully exercisable without spending WJK.

### Verify a hand by hand

```bash
node --input-type=module -e '
import { linksToAnchor, commitment, deriveDeck } from "./shared/provably-fair.js";
const serverSeed = "<revealed serverSeed>";
const clientSeed = "<your client seed>";
const nonce      = 0;                 // hand index within the epoch
const anchor     = "<on-chain anchor (from the anchor tx OP_RETURN)>";
console.log("links to chain :", linksToAnchor(serverSeed, nonce, anchor));
console.log("commit ok      :", commitment(serverSeed) === "<pre-deal commitment>");
console.log("deck           :", deriveDeck(serverSeed, clientSeed, nonce).join(" "));
'
```

---

## Going live (real on-chain settlement)

1. Generate (or reuse) the house wallet and note its address:
   ```bash
   npm run generate-wallet
   ```
2. **Fund** the printed `W…` address with WJK (this is the bankroll that pays
   winners).
3. Configure the server:
   ```bash
   cp server/.env.example server/.env
   # set DEMO_MODE=false
   ```
4. Restart: `npm run dev` (or `npm run build && npm start` for single-process).

In live mode:

- **Deposit** builds a transaction in the player’s Wojak Wallet
  (`provider.createTx`) paying the house address; the server broadcasts it and
  credits exactly what landed on-chain.
- **Cash out** has the house wallet build, sign and broadcast a real payout
  transaction to the player’s address.
- Every settlement links to the block explorer.

> ⚠️ The house wallet’s private key (WIF) lives in
> `server/data/house-wallet.json` (git-ignored, `chmod 600`). Treat it like any
> hot wallet: keep only the float you need on it.

---

## Production build (single process)

```bash
npm run build     # builds web/dist
npm start         # the server serves the API *and* the built app on :8787
```

---

## Project layout

```
shared/            provably-fair core + blackjack engine (server & browser)
  sha256.js          zero-dep SHA-256 / HMAC-SHA256
  provably-fair.js   server-seed hash chain + deterministic deck derivation
  onchain.js         OP_RETURN anchor encode/decode (reads electrs txs)
  blackjack.js       pure playRound(deck, actions) rules engine
server/            Express house server
  src/wallet.js      house keypair, payout + OP_RETURN tx build/sign, deposit decode
  src/chain.js       electrs REST client (utxo / pushtx / tx)
  src/anchor.js      publish the epoch anchor on-chain (live) / demo chain (demo)
  src/fair.js        hash-chain epoch manager (secret terminal stays server-side)
  src/game.js        round orchestration + bankroll
  scripts/generate-house-wallet.mjs
web/               React + Vite + Tailwind dApp
  src/lib/wojak.js   window.wojak provider access (wojak-sdk interface)
  src/lib/verify.js  in-browser fairness verification
  src/components/    table, cards, chips, controls, fairness panel, …
```

## API (house server)

| Method | Path | Purpose |
| --- | --- | --- |
| `GET`  | `/api/config` | network, mode, house address, bet limits, rules |
| `GET`  | `/api/state?address=` | balance, active round (redacted), history |
| `GET`  | `/api/house` | house bankroll |
| `POST` | `/api/round/start` | place a bet, commit a seed, deal |
| `POST` | `/api/round/action` | hit / stand / double / split |
| `POST` | `/api/fair/client-seed` | set your client seed |
| `POST` | `/api/deposit` | credit a deposit (broadcasts the tx in live mode) |
| `POST` | `/api/withdraw` | cash out (signs + broadcasts in live mode) |

The server **never** returns the server seed or the unrevealed deck until a hand
is finished.

## License

MIT
