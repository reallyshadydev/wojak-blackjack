const TONE = {
  win: "border-emerald-400/40 bg-emerald-500/15 text-emerald-100",
  lose: "border-rose-400/40 bg-rose-500/15 text-rose-100",
  info: "border-gold/30 bg-black/50 text-white",
  error: "border-rose-500/50 bg-rose-600/20 text-rose-100",
};

export default function Toasts({ toasts }) {
  return (
    <div className="pointer-events-none fixed bottom-5 right-5 z-[60] flex w-80 flex-col gap-2">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`animate-floatUp rounded-xl border px-4 py-3 text-sm shadow-lg backdrop-blur ${TONE[t.tone] || TONE.info}`}
        >
          <div className="font-semibold">{t.title}</div>
          {t.body && <div className="mt-0.5 text-xs opacity-80">{t.body}</div>}
          {t.link && (
            <a
              href={t.link}
              target="_blank"
              rel="noreferrer"
              className="pointer-events-auto mt-1 inline-block text-xs font-medium text-gold underline decoration-dotted"
            >
              View on explorer ↗
            </a>
          )}
        </div>
      ))}
    </div>
  );
}
