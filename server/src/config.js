import "dotenv/config";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { DEFAULT_RULES } from "../../shared/blackjack.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

const num = (v, d) => (v === undefined || v === "" ? d : Number(v));
const bool = (v, d) => (v === undefined || v === "" ? d : v === "true" || v === "1");

export const SATS = 100_000_000; // 1 WJK

const network = process.env.NETWORK === "testnet" ? "testnet" : "mainnet";

export const config = {
  port: num(process.env.PORT, 8787),
  network,

  // DEMO_MODE (default ON): no real transactions are broadcast and no real
  // funds move — deposits are simulated and payouts are virtual. This makes the
  // game fully playable and verifiable out of the box. Set DEMO_MODE=false and
  // fund the house wallet to settle real WojakCoin on-chain.
  demoMode: bool(process.env.DEMO_MODE, true),

  // electrs REST API (esplora-style), used to read UTXOs and broadcast txs.
  apiUrl:
    process.env.API_URL ??
    (network === "testnet"
      ? "https://testnet.wojakcoin.cash/electrs"
      : "https://api.wojakcoin.cash"),
  explorerUrl: process.env.EXPLORER_URL ?? "https://explorer.wojakcoin.cash",

  walletFile: process.env.HOUSE_WALLET_FILE ?? path.join(ROOT, "data", "house-wallet.json"),
  stateFile: process.env.STATE_FILE ?? path.join(ROOT, "data", "state.json"),

  feeRate: num(process.env.FEE_RATE, 50), // sats per byte for house payouts
  minBetSats: num(process.env.MIN_BET_SATS, 0.05 * SATS),
  maxBetSats: num(process.env.MAX_BET_SATS, 25 * SATS),

  // Hands committed by a single on-chain anchor before a new anchor is written.
  epochLength: num(process.env.EPOCH_LENGTH, 256),

  // Virtual starting bankroll shown/used in DEMO_MODE only.
  demoBankrollSats: num(process.env.DEMO_BANKROLL_SATS, 100_000 * SATS),
  // A no-deposit-needed welcome balance credited to new players in DEMO_MODE so
  // the game is instantly playable. Ignored when DEMO_MODE=false.
  demoWelcomeSats: num(process.env.DEMO_WELCOME_SATS, 100 * SATS),

  // Require a wallet message-signature to authorize withdrawals (real mode).
  requireWithdrawSig: bool(process.env.REQUIRE_WITHDRAW_SIG, false),

  rules: {
    ...DEFAULT_RULES,
    dealerHitsSoft17: bool(process.env.DEALER_HITS_SOFT17, DEFAULT_RULES.dealerHitsSoft17),
    blackjackPays: num(process.env.BLACKJACK_PAYS, DEFAULT_RULES.blackjackPays),
    maxSplits: num(process.env.MAX_SPLITS, DEFAULT_RULES.maxSplits),
    doubleAfterSplit: bool(process.env.DOUBLE_AFTER_SPLIT, DEFAULT_RULES.doubleAfterSplit),
    oneCardAfterSplitAce: bool(process.env.ONE_CARD_AFTER_SPLIT_ACE, DEFAULT_RULES.oneCardAfterSplitAce),
  },

  corsOrigin: process.env.CORS_ORIGIN ?? "*",
  root: ROOT,
};
