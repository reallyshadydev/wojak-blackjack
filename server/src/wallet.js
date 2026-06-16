// House wallet: holds the private key, builds/signs/broadcasts payout txs,
// and decodes incoming deposit transactions. WojakCoin is legacy P2PKH, so
// signing requires the full previous transaction (nonWitnessUtxo) per input.

import fs from "node:fs";
import * as belcoin from "belcoinjs-lib";
import { ECPairFactory } from "ecpair";
import * as ecc from "@bitcoinerlab/secp256k1";
import { config } from "./config.js";
import { networkFor } from "./network.js";
import { getTxHex, getUtxos } from "./chain.js";

const ECPair = ECPairFactory(ecc);
const network = networkFor(config.network);

// Approximate sizes for fee estimation on a legacy chain.
const TX_OVERHEAD = 10;
const P2PKH_INPUT = 148;
const P2PKH_OUTPUT = 34;
const DUST = 100_000; // 0.001 WJK; fold change smaller than this into the fee

let house = null; // { keyPair, address, publicKeyHex }

/** belcoin's older typeforce wants Buffers from the signer. */
function toSigner(keyPair) {
  return {
    publicKey: Buffer.from(keyPair.publicKey),
    network,
    sign: (hash) => Buffer.from(keyPair.sign(hash)),
  };
}

export function deriveAddress(keyPair) {
  const { address } = belcoin.payments.p2pkh({
    pubkey: Buffer.from(keyPair.publicKey),
    network,
  });
  return address;
}

/** Create a brand-new house keypair (used by the generator script). */
export function createWallet() {
  const keyPair = ECPair.makeRandom({ network });
  return {
    address: deriveAddress(keyPair),
    wif: keyPair.toWIF(),
    publicKey: Buffer.from(keyPair.publicKey).toString("hex"),
    network: config.network,
    createdAt: new Date().toISOString(),
  };
}

/** Load the house wallet from disk; null if it has not been generated. */
export function loadHouseWallet() {
  if (house) return house;
  if (!fs.existsSync(config.walletFile)) return null;
  const data = JSON.parse(fs.readFileSync(config.walletFile, "utf8"));
  const keyPair = ECPair.fromWIF(data.wif, network);
  const address = deriveAddress(keyPair);
  if (data.address && data.address !== address) {
    throw new Error("house-wallet.json address does not match its WIF");
  }
  house = {
    keyPair,
    address,
    publicKeyHex: Buffer.from(keyPair.publicKey).toString("hex"),
  };
  return house;
}

export function houseAddress() {
  return loadHouseWallet()?.address ?? null;
}

/**
 * Sum the outputs of a signed raw tx that pay the house address. Used to credit
 * a deposit by exactly what the player actually sent on-chain.
 * @returns { txid, amountSats }
 */
export function decodeDepositToHouse(rawTxHex, addr = houseAddress()) {
  const tx = belcoin.Transaction.fromHex(rawTxHex);
  let amountSats = 0;
  for (const out of tx.outs) {
    let outAddr;
    try {
      outAddr = belcoin.address.fromOutputScript(out.script, network);
    } catch {
      continue;
    }
    if (outAddr === addr) amountSats += out.value;
  }
  return { txid: tx.getId(), amountSats };
}

function estimateFee(numInputs, numOutputs, feeRate) {
  return (TX_OVERHEAD + numInputs * P2PKH_INPUT + numOutputs * P2PKH_OUTPUT) * feeRate;
}

/**
 * Build, sign and return a house transaction funding the given target outputs
 * (P2PKH `address`+`value`, or a raw `script`+`value` such as an OP_RETURN),
 * with change returned to the house. Does not broadcast.
 * @returns { hex, txid, fee, inputs }
 */
export async function buildFundedTx({ outputs, feeRate = config.feeRate }) {
  const h = loadHouseWallet();
  if (!h) throw new Error("house wallet not generated");

  const spendSats = outputs.reduce((s, o) => s + (o.value || 0), 0);

  const utxos = await getUtxos(h.address);
  if (!Array.isArray(utxos) || utxos.length === 0) {
    throw new Error("house wallet has no spendable UTXOs (fund it first)");
  }
  utxos.sort((a, b) => b.value - a.value); // largest-first coin selection

  const selected = [];
  let inputSum = 0;
  for (const u of utxos) {
    selected.push(u);
    inputSum += u.value;
    if (inputSum >= spendSats + estimateFee(selected.length, outputs.length + 1, feeRate)) break;
  }

  let fee = estimateFee(selected.length, outputs.length + 1, feeRate);
  if (inputSum < spendSats + estimateFee(selected.length, outputs.length, feeRate)) {
    throw new Error(`house wallet underfunded: need ~${spendSats + fee} sats, have ${inputSum}`);
  }

  let change = inputSum - spendSats - fee;
  let withChange = true;
  if (change < DUST) {
    // Drop the change output; donate the remainder to the fee.
    withChange = false;
    fee = inputSum - spendSats;
    change = 0;
  }

  const psbt = new belcoin.Psbt({ network });
  // WojakCoin (pre-segwit wojakcore) only accepts version-1 transactions; the
  // PSBT default is v2, which the node rejects as "premature-version2-tx".
  psbt.setVersion(1);
  for (const u of selected) {
    const hex = u.hex ?? (await getTxHex(u.txid));
    psbt.addInput({ hash: u.txid, index: u.vout, nonWitnessUtxo: Buffer.from(hex, "hex") });
  }
  for (const o of outputs) {
    if (o.script) psbt.addOutput({ script: Buffer.from(o.script, "hex"), value: o.value || 0 });
    else psbt.addOutput({ address: o.address, value: o.value });
  }
  if (withChange) psbt.addOutput({ address: h.address, value: change });

  const signer = toSigner(h.keyPair);
  selected.forEach((_, i) => psbt.signInput(i, signer));
  psbt.finalizeAllInputs();

  const tx = psbt.extractTransaction(true); // skip the high-fee-rate guard
  return { hex: tx.toHex(), txid: tx.getId(), fee, inputs: selected.length };
}

/** Build a signed payout tx paying `amountSats` to `toAddress` from the house. */
export function buildPayout({ toAddress, amountSats, feeRate = config.feeRate }) {
  return buildFundedTx({ outputs: [{ address: toAddress, value: amountSats }], feeRate });
}

/** Build a signed tx that writes a raw OP_RETURN `scriptHex` on-chain. */
export function buildOpReturnTx({ scriptHex, feeRate = config.feeRate }) {
  return buildFundedTx({ outputs: [{ script: scriptHex, value: 0 }], feeRate });
}
