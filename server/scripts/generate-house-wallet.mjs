// Generates the house wallet (a WojakCoin legacy P2PKH keypair) and writes it
// to server/data/house-wallet.json. The private key (WIF) never leaves this
// file and is git-ignored. Re-running is a no-op unless --force is passed.
//
//   npm run generate-wallet           # create if absent
//   npm run generate-wallet -- --force   # overwrite (DANGER: old key is lost)

import fs from "node:fs";
import path from "node:path";
import { config } from "../src/config.js";
import { createWallet } from "../src/wallet.js";

const force = process.argv.includes("--force");
const file = config.walletFile;

fs.mkdirSync(path.dirname(file), { recursive: true });

if (fs.existsSync(file) && !force) {
  const existing = JSON.parse(fs.readFileSync(file, "utf8"));
  console.log("House wallet already exists. Use --force to overwrite.\n");
  console.log("  address :", existing.address);
  console.log("  network :", existing.network);
  process.exit(0);
}

const wallet = createWallet();
fs.writeFileSync(file, JSON.stringify(wallet, null, 2));
fs.chmodSync(file, 0o600);

console.log("\n  ✓ House wallet generated\n");
console.log("  ───────────────────────────────────────────────");
console.log("  address :", wallet.address);
console.log("  network :", wallet.network);
console.log("  file    :", file, "(git-ignored, chmod 600)");
console.log("  ───────────────────────────────────────────────\n");
console.log("  Keep the WIF in this file secret — it controls the bankroll.");
console.log("  To settle real on-chain payouts:");
console.log("    1. Fund the address above with WJK.");
console.log("    2. Set DEMO_MODE=false in server/.env");
console.log("    3. Restart the server.\n");
