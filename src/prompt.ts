import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";

export async function prompt(question: string, defaultValue?: string): Promise<string> {
  const rl = createInterface({ input: stdin, output: stdout });
  const q = defaultValue ? `${question} [${defaultValue}]: ` : `${question}: `;
  const answer = (await rl.question(q)).trim();
  rl.close();
  return answer || defaultValue || "";
}

export async function promptSecret(question: string): Promise<string> {
  // Minimal secret prompt — hides input by clearing line on each keypress.
  return new Promise((resolve, reject) => {
    stdout.write(`${question}: `);
    let value = "";
    const onData = (buf: Buffer) => {
      const ch = buf.toString("utf8");
      if (ch === "\n" || ch === "\r" || ch === "\u0004") {
        stdin.removeListener("data", onData);
        stdin.setRawMode(false);
        stdin.pause();
        stdout.write("\n");
        resolve(value);
      } else if (ch === "\u0003") {
        stdin.removeListener("data", onData);
        stdin.setRawMode(false);
        stdin.pause();
        reject(new Error("Aborted"));
      } else if (ch === "\u007f" || ch === "\b") {
        if (value.length > 0) {
          value = value.slice(0, -1);
          stdout.write("\b \b");
        }
      } else {
        value += ch;
        stdout.write("*");
      }
    };
    if (!stdin.isTTY) {
      // Non-interactive: read one line normally.
      let chunks = "";
      stdin.on("data", (d) => (chunks += d.toString()));
      stdin.on("end", () => resolve(chunks.trim()));
      return;
    }
    stdin.setRawMode(true);
    stdin.resume();
    stdin.on("data", onData);
  });
}
