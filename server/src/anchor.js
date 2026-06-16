// On-chain anchoring of the provably-fair hash chain.
//
// The epoch anchor (SHA256^length(terminal)) is written into an OP_RETURN output
// on the WojakCoin chain BEFORE any hand of that epoch is dealt. That on-chain
// value is what the in-browser verifier checks every revealed seed against — so
// fairness is rooted in the blockchain, not in this server.
//
// LIVE: the house wallet builds + broadcasts a real OP_RETURN transaction.
// DEMO: an identically-shaped transaction is recorded in the demo chain and
//       served back through /chain/tx/:txid, so the verifier's code path is the
//       same and fully exercisable without spending real WJK.

import { createHash } from "node:crypto";
import { config } from "./config.js";
import { anchorScriptHex } from "../../shared/onchain.js";
import { buildOpReturnTx } from "./wallet.js";
import { broadcast } from "./chain.js";
import { putDemoTx } from "./store.js";

const sha256hex = (s) => createHash("sha256").update(s).digest("hex");

/**
 * Publish an epoch anchor on-chain.
 * @returns { txid, scriptHex, demo, confirmed }
 */
export async function publishAnchor({ anchorHex, length }) {
  const scriptHex = anchorScriptHex(anchorHex, length);

  if (config.demoMode) {
    const txid = sha256hex(`${anchorHex}:${length}:${Date.now()}:${Math.random()}`);
    putDemoTx(txid, {
      txid,
      vin: [],
      vout: [{ scriptpubkey: scriptHex, scriptpubkey_type: "op_return", value: 0 }],
      status: { confirmed: true, block_height: 0, block_time: Math.floor(Date.now() / 1000) },
      demo: true,
    });
    return { txid, scriptHex, demo: true, confirmed: true };
  }

  const { hex, txid } = await buildOpReturnTx({ scriptHex });
  const broadcastTxid = await broadcast(hex);
  return { txid: broadcastTxid, scriptHex, demo: false, confirmed: false };
}
