// WojakCoin chain parameters — must match the wallet extension's
// src/shared/networks.ts (and wojakcore src/chainparams.cpp).
// WojakCoin is a pre-segwit chain: legacy P2PKH addresses only.

export const wojakcoin = {
  messagePrefix: "WojakCoin Signed Message:\n",
  bech32: "wjk", // unused (no segwit) but required by the Network type
  bip32: { public: 0x0488b21e, private: 0x0488ade4 },
  pubKeyHash: 73, // addresses start with 'W'
  scriptHash: 5,
  wif: 201,
};

export const wojakcoinTestnet = {
  messagePrefix: "WojakCoin Signed Message:\n",
  bech32: "twjk",
  bip32: { public: 0x043587cf, private: 0x04358394 },
  pubKeyHash: 111,
  scriptHash: 196,
  wif: 239,
};

export function networkFor(name) {
  return name === "testnet" ? wojakcoinTestnet : wojakcoin;
}
