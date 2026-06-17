import express from "express";
import cors from "cors";
import fs from "node:fs";
import path from "node:path";
import { config, SATS } from "./config.js";
import { getPlayer, save, getDemoTx } from "./store.js";
import { startRound, applyAction, setClientSeed, viewRound, httpErr } from "./game.js";
import { houseAddress, loadHouseWallet, decodeDepositToHouse, buildPayout } from "./wallet.js";
import { broadcast, getAddressBalance, getTx } from "./chain.js";
import { randomClientSeed, publicEpoch } from "./fair.js";
import { getWjkUsdtPrice } from "./price.js";

const app = express();
app.use(cors({ origin: config.corsOrigin }));
app.use(express.json({ limit: "1mb" }));

const wrap = (fn) => async (req, res) => {
  try {
    await fn(req, res); // catches both synchronous throws and async rejections
  } catch (e) {
    const status = e.status ?? 500;
    if (status >= 500) console.error("[api]", e);
    res.status(status).json({ error: e.message ?? "server error" });
  }
};

function requireAddress(req) {
  const address = req.body?.address || req.query?.address || req.params?.address;
  if (!address || typeof address !== "string" || address.length < 6) {
    throw httpErr(400, "valid address required");
  }
  return address;
}

/** Credit the demo welcome balance on first contact so play is instant. */
function ensurePlayer(address) {
  const p = getPlayer(address);
  let dirty = false;
  if (!p.clientSeed) {
    p.clientSeed = randomClientSeed();
    dirty = true;
  }
  if (config.demoMode && !p.welcomeGranted) {
    p.welcomeGranted = true;
    p.balanceSats += config.demoWelcomeSats;
    dirty = true;
  }
  if (dirty) save();
  return p;
}

function publicState(player) {
  return {
    address: player.address,
    balanceSats: player.balanceSats,
    clientSeed: player.clientSeed,
    roundCounter: player.roundCounter,
    epoch: publicEpoch(player.epoch), // seed-safe: never includes the terminal
    activeRound: viewRound(player.activeRound, player.balanceSats),
    history: player.history,
    demoMode: config.demoMode,
    houseAddress: houseAddress(),
    network: config.network,
  };
}

app.get("/api/health", (_req, res) => res.json({ ok: true }));

app.get(
  "/api/price/wjk",
  wrap(async (_req, res) => {
    const usdtPerWjk = await getWjkUsdtPrice();
    res.json({ usdtPerWjk, source: "nonkyc", pair: "WJK/USDT" });
  })
);

app.get(
  "/api/config",
  wrap((_req, res) => {
    res.json({
      network: config.network,
      demoMode: config.demoMode,
      houseAddress: houseAddress(),
      houseFunded: !!loadHouseWallet(),
      explorerUrl: config.explorerUrl,
      feeRate: config.feeRate,
      minBetSats: config.minBetSats,
      maxBetSats: config.maxBetSats,
      epochLength: config.epochLength,
      sats: SATS,
      rules: config.rules,
      // Where the in-browser verifier reads the on-chain anchor from:
      //  - explorerTxBase: human-checkable link to the anchor transaction
      //  - electrsTxBase : direct public chain read (live only; may be CORS-gated)
      //  - chainProxyBase: same-origin relay (real chain in live, demo chain in demo)
      explorerTxBase: `${config.explorerUrl}/tx`,
      electrsTxBase: config.demoMode ? null : `${config.apiUrl}/tx`,
      chainProxyBase: "/chain/tx",
    });
  })
);

app.get(
  "/api/state",
  wrap((req, res) => {
    const address = requireAddress(req);
    res.json(publicState(ensurePlayer(address)));
  })
);

app.get(
  "/api/house",
  wrap(async (_req, res) => {
    if (config.demoMode) {
      return res.json({ bankrollSats: config.demoBankrollSats, address: houseAddress(), demo: true });
    }
    const addr = houseAddress();
    const bankrollSats = addr ? await getAddressBalance(addr) : 0;
    res.json({ bankrollSats, address: addr, demo: false });
  })
);

app.post(
  "/api/fair/client-seed",
  wrap((req, res) => {
    const player = ensurePlayer(requireAddress(req));
    setClientSeed(player, req.body?.clientSeed);
    res.json(publicState(player));
  })
);

app.post(
  "/api/round/start",
  wrap(async (req, res) => {
    const player = ensurePlayer(requireAddress(req));
    await startRound(player, Number(req.body?.betSats));
    res.json(publicState(player));
  })
);

app.post(
  "/api/round/action",
  wrap((req, res) => {
    const player = ensurePlayer(requireAddress(req));
    const action = String(req.body?.action || "");
    applyAction(player, action);
    res.json(publicState(player));
  })
);

app.post(
  "/api/deposit",
  wrap(async (req, res) => {
    const player = ensurePlayer(requireAddress(req));
    const rawTxHex = req.body?.rawTxHex;

    if (config.demoMode) {
      // No real broadcast: credit either the requested amount or a decoded tx.
      let amountSats = Math.floor(Number(req.body?.amountSats) || 0);
      let txid = "demo-deposit";
      if (rawTxHex) {
        const d = decodeDepositToHouse(rawTxHex);
        amountSats = d.amountSats || amountSats;
        txid = d.txid;
      }
      if (amountSats <= 0) throw httpErr(400, "amountSats required in demo mode");
      player.balanceSats += amountSats;
      player.deposits.unshift({ txid, amountSats, at: new Date().toISOString(), demo: true });
      save();
      return res.json({ ...publicState(player), deposit: { txid, amountSats, demo: true } });
    }

    // Real mode: the signed tx must pay the house address.
    if (!rawTxHex) throw httpErr(400, "rawTxHex required");
    if (!houseAddress()) throw httpErr(503, "house wallet not generated");
    const { txid: localTxid, amountSats } = decodeDepositToHouse(rawTxHex);
    if (amountSats <= 0) throw httpErr(400, "transaction does not pay the house address");
    const txid = await broadcast(rawTxHex);
    player.balanceSats += amountSats;
    player.deposits.unshift({ txid, amountSats, at: new Date().toISOString() });
    save();
    res.json({ ...publicState(player), deposit: { txid, amountSats } });
  })
);

app.post(
  "/api/withdraw",
  wrap(async (req, res) => {
    const player = ensurePlayer(requireAddress(req));
    const amountSats = Math.floor(Number(req.body?.amountSats) || 0);
    if (amountSats <= 0) throw httpErr(400, "invalid amount");
    if (amountSats > player.balanceSats) throw httpErr(402, "insufficient balance");
    if (player.activeRound && !player.activeRound.finished) {
      throw httpErr(409, "finish your round before withdrawing");
    }

    if (config.demoMode) {
      player.balanceSats -= amountSats;
      const txid = "demo-" + Math.random().toString(36).slice(2, 10);
      player.withdrawals.unshift({ txid, amountSats, at: new Date().toISOString(), demo: true });
      save();
      return res.json({ ...publicState(player), withdrawal: { txid, amountSats, demo: true } });
    }

    if (!loadHouseWallet()) throw httpErr(503, "house wallet not generated");
    const { hex, txid, fee } = await buildPayout({
      toAddress: player.address,
      amountSats,
    });
    const broadcastTxid = await broadcast(hex);
    player.balanceSats -= amountSats;
    player.withdrawals.unshift({ txid: broadcastTxid, amountSats, fee, at: new Date().toISOString() });
    save();
    res.json({ ...publicState(player), withdrawal: { txid: broadcastTxid, amountSats, fee } });
  })
);

// Chain read for the verifier: the transaction carrying an epoch's anchor.
// DEMO -> the simulated demo-chain tx; LIVE -> relayed from electrs (real
// on-chain data; the same tx is independently checkable at the explorer link
// the UI shows). The verification itself is cryptographic, so this relay can't
// forge an anchor a revealed seed would hash to.
app.get(
  "/chain/tx/:txid",
  wrap(async (req, res) => {
    const txid = String(req.params.txid || "");
    if (!/^[0-9a-fA-F]{64}$/.test(txid)) throw httpErr(400, "invalid txid");
    if (config.demoMode) {
      const tx = getDemoTx(txid);
      if (!tx) throw httpErr(404, "tx not found on demo chain");
      return res.json(tx);
    }
    const tx = await getTx(txid);
    if (!tx || typeof tx !== "object") throw httpErr(404, "tx not found");
    res.json(tx);
  })
);

// Optionally serve the built web app (single-process production deploy).
const webDist = path.resolve(config.root, "..", "web", "dist");
if (fs.existsSync(webDist)) {
  app.use(express.static(webDist));
  app.get("*", (_req, res) => res.sendFile(path.join(webDist, "index.html")));
}

app.listen(config.port, () => {
  const house = houseAddress();
  console.log(`\n  WojakCoin Blackjack — house server`);
  console.log(`  ───────────────────────────────────`);
  console.log(`  port      : ${config.port}`);
  console.log(`  network   : ${config.network}`);
  console.log(`  mode      : ${config.demoMode ? "DEMO (no real funds move)" : "LIVE (on-chain settlement)"}`);
  console.log(`  house     : ${house ?? "NOT GENERATED — run: npm run generate-wallet"}`);
  console.log(`  electrs   : ${config.apiUrl}\n`);
});
