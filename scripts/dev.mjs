// Runs the house server and the web dev server together (no extra deps).
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

function run(name, cwd, color) {
  const child = spawn("npm", ["run", "dev"], { cwd: path.join(root, cwd), shell: true });
  const tag = `\x1b[${color}m[${name}]\x1b[0m `;
  const pipe = (stream) =>
    stream.on("data", (d) =>
      String(d)
        .split("\n")
        .filter(Boolean)
        .forEach((line) => process.stdout.write(tag + line + "\n"))
    );
  pipe(child.stdout);
  pipe(child.stderr);
  child.on("exit", (code) => {
    console.log(tag + `exited (${code})`);
    process.exit(code ?? 0);
  });
  return child;
}

console.log("Starting WojakCoin Blackjack (server :8787, web :5173)…\n");
const server = run("server", "server", "36");
const web = run("web", "web", "33");

for (const sig of ["SIGINT", "SIGTERM"]) {
  process.on(sig, () => {
    server.kill();
    web.kill();
    process.exit(0);
  });
}
