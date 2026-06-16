// On-chain anchor codec — encode/parse the provably-fair hash-chain anchor that
// the house writes into an OP_RETURN output. Pure hex/string ops (zero deps), so
// the SAME parser runs in the house server and in the in-browser verifier, and
// the anchor can be read straight from a raw electrs transaction.
//
// OP_RETURN payload layout (42 bytes, well under the 80-byte standard limit):
//   "WJKBJ" (5) | version (1) | anchor (32) | epoch length (4, uint32 BE)

const TAG_HEX = "574a4b424a"; // ascii "WJKBJ"
const VERSION = "01";
const PAYLOAD_HEX_LEN = 10 + 2 + 64 + 8; // 84 hex chars = 42 bytes

const u32beHex = (n) => (n >>> 0).toString(16).padStart(8, "0");

/** Hex of the OP_RETURN data payload (without the opcode/pushdata prefix). */
export function encodeAnchorPayload(anchorHex, length) {
  const a = String(anchorHex).toLowerCase();
  if (!/^[0-9a-f]{64}$/.test(a)) throw new Error("anchor must be 32-byte hex");
  return TAG_HEX + VERSION + a + u32beHex(length);
}

/** Full OP_RETURN scriptPubKey hex (`6a <pushdata> <payload>`). */
export function opReturnScriptHex(payloadHex) {
  const len = payloadHex.length / 2;
  let push;
  if (len <= 75) push = len.toString(16).padStart(2, "0");
  else if (len <= 255) push = "4c" + len.toString(16).padStart(2, "0"); // OP_PUSHDATA1
  else throw new Error("payload too large for a single OP_RETURN push");
  return "6a" + push + payloadHex;
}

/** Convenience: script hex for an anchor directly. */
export function anchorScriptHex(anchorHex, length) {
  return opReturnScriptHex(encodeAnchorPayload(anchorHex, length));
}

/** Parse an OP_RETURN scriptPubKey hex back into { version, anchorHex, length } or null. */
export function parseAnchorScript(scriptHex) {
  if (!scriptHex) return null;
  const s = String(scriptHex).toLowerCase();
  if (s.slice(0, 2) !== "6a") return null; // not OP_RETURN
  let i = 2;
  const op = parseInt(s.slice(i, i + 2), 16);
  i += 2;
  let len;
  if (op === 0x4c) {
    len = parseInt(s.slice(i, i + 2), 16);
    i += 2;
  } else if (op <= 75) {
    len = op;
  } else return null;
  const data = s.slice(i, i + len * 2);
  if (data.length < PAYLOAD_HEX_LEN) return null;
  if (data.slice(0, 10) !== TAG_HEX) return null;
  return {
    version: data.slice(10, 12),
    anchorHex: data.slice(12, 76),
    length: parseInt(data.slice(76, 84), 16),
  };
}

/**
 * Find and decode the anchor in a transaction. Accepts an electrs/esplora tx
 * (vout[].scriptpubkey) or our demo-chain tx of the same shape.
 */
export function findAnchorInTx(tx) {
  const vouts = tx?.vout ?? tx?.vouts ?? tx?.outputs ?? [];
  for (const v of vouts) {
    const script =
      v.scriptpubkey ?? v.scriptpubkey_hex ?? v.scriptPubKey?.hex ?? v.script ?? "";
    const parsed = parseAnchorScript(script);
    if (parsed) return parsed;
  }
  return null;
}
