// Tiny synthesized sound engine (Web Audio API) — no asset files, works offline.
// The AudioContext is created lazily on the first sound, which is always fired
// from inside a user gesture (chip click, deal, …) so browsers allow playback.

const STORE_KEY = "wjkbj.muted";

let ctx = null;
let master = null;
let muted = (() => {
  try {
    return localStorage.getItem(STORE_KEY) === "1";
  } catch {
    return false;
  }
})();

function ac() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.5;
    master.connect(ctx.destination);
  }
  if (ctx.state === "suspended") ctx.resume();
  return ctx;
}

/** A single enveloped oscillator note. */
function note(freq, start, dur, { type = "sine", peak = 0.2, glideTo } = {}) {
  const c = ac();
  if (!c) return;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, start);
  if (glideTo) o.frequency.exponentialRampToValueAtTime(glideTo, start + dur);
  g.gain.setValueAtTime(0.0001, start);
  g.gain.exponentialRampToValueAtTime(peak, start + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
  o.connect(g);
  g.connect(master);
  o.start(start);
  o.stop(start + dur + 0.02);
}

/** Short filtered-noise burst — used for the card-deal flick. */
function noise(start, dur, { peak = 0.12, highpass = 1600 } = {}) {
  const c = ac();
  if (!c) return;
  const n = Math.max(1, Math.floor(c.sampleRate * dur));
  const buf = c.createBuffer(1, n, c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < n; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / n); // decaying
  const src = c.createBufferSource();
  src.buffer = buf;
  const hp = c.createBiquadFilter();
  hp.type = "highpass";
  hp.frequency.value = highpass;
  const g = c.createGain();
  g.gain.value = peak;
  src.connect(hp);
  hp.connect(g);
  g.connect(master);
  src.start(start);
}

function arpeggio(freqs, { gap = 0.08, dur = 0.18, type = "triangle", peak = 0.22 } = {}) {
  const c = ac();
  if (!c) return;
  const t = c.currentTime;
  freqs.forEach((f, i) => note(f, t + i * gap, dur, { type, peak }));
}

// Note frequencies
const N = { A3: 220, C4: 261.6, E4: 329.6, F4: 349.2, G4: 392, A4: 440, C5: 523.3, E5: 659.3, G5: 784, C6: 1046.5 };

export const sound = {
  isMuted: () => muted,
  setMuted(v) {
    muted = !!v;
    try {
      localStorage.setItem(STORE_KEY, muted ? "1" : "0");
    } catch {
      /* ignore */
    }
    if (!muted) ac(); // unlock on enable (we're in a click handler)
  },
  toggle() {
    this.setMuted(!muted);
    return muted;
  },

  deal() {
    if (muted) return;
    const c = ac();
    if (!c) return;
    noise(c.currentTime, 0.11, { peak: 0.13, highpass: 1800 });
    note(720, c.currentTime, 0.06, { type: "triangle", peak: 0.06, glideTo: 480 });
  },
  chip() {
    if (muted) return;
    const c = ac();
    if (!c) return;
    note(N.C6, c.currentTime, 0.05, { type: "square", peak: 0.08 });
    note(N.G5, c.currentTime + 0.04, 0.06, { type: "square", peak: 0.07 });
  },
  click() {
    if (muted) return;
    const c = ac();
    if (!c) return;
    note(660, c.currentTime, 0.05, { type: "triangle", peak: 0.12, glideTo: 880 });
  },
  win() {
    if (muted) return;
    arpeggio([N.C5, N.E5, N.G5], { gap: 0.085, dur: 0.2, peak: 0.2 });
  },
  blackjack() {
    if (muted) return;
    arpeggio([N.C5, N.E5, N.G5, N.C6], { gap: 0.075, dur: 0.26, peak: 0.24 });
  },
  lose() {
    if (muted) return;
    arpeggio([N.F4, N.C4, N.A3], { gap: 0.1, dur: 0.26, type: "sine", peak: 0.18 });
  },
  push() {
    if (muted) return;
    const c = ac();
    if (!c) return;
    note(N.E4, c.currentTime, 0.22, { type: "sine", peak: 0.16 });
  },
};
