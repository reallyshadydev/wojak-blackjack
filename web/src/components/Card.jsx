const SUIT = { S: "♠", H: "♥", D: "♦", C: "♣" };
const RANK = { T: "10" };

export default function Card({ code, faceDown, index = 0, size = 76 }) {
  const style = {
    "--cw": `${size}px`,
    animationDelay: `${index * 90}ms`,
  };

  if (faceDown || !code) {
    return (
      <div className="card card-back animate-deal" style={style}>
        <div className="crest">🃏</div>
      </div>
    );
  }

  const rank = code[0];
  const suit = code[1];
  const red = suit === "H" || suit === "D";
  const label = RANK[rank] ?? rank;
  const sym = SUIT[suit];

  return (
    <div className={`card animate-deal ${red ? "red" : "black"}`} style={style}>
      <div className="corner tl">
        <span>{label}</span>
        <span>{sym}</span>
      </div>
      <div className="pip">{sym}</div>
      <div className="corner br">
        <span>{label}</span>
        <span>{sym}</span>
      </div>
    </div>
  );
}
