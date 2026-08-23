import process from "node:process";
import { derivePasswordHash, generateSalt } from "../../src/lib/auth/password";

function readPasswordFromStdin(): Promise<string> {
  return new Promise((resolve, reject) => {
    let input = "";
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (chunk: string) => {
      input += chunk;
    });
    process.stdin.on("end", () => resolve(input.replace(/\r?\n$/, "")));
    process.stdin.on("error", reject);
  });
}

function readPasswordInteractively(): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!process.stdin.isTTY || typeof process.stdin.setRawMode !== "function") {
      reject(new Error("Standard input is not an interactive terminal."));
      return;
    }
    let password = "";
    const stdin = process.stdin;
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding("utf8");
    function cleanup() {
      stdin.setRawMode(false);
      stdin.pause();
      stdin.removeListener("data", onData);
      stdin.removeListener("error", onError);
    }
    function onData(chunk: string) {
      for (const char of chunk) {
        if (char === "\r" || char === "\n") {
          cleanup();
          process.stdout.write("\n");
          resolve(password);
          return;
        }
        if (char === "\u0003") {
          cleanup();
          reject(new Error("Cancelled."));
          return;
        }
        if (char === "\u007f" || char === "\b") {
          password = password.slice(0, -1);
        } else if (char >= " ") {
          password += char;
        }
      }
    }
    function onError(error: Error) {
      cleanup();
      reject(error);
    }
    stdin.on("data", onData);
    stdin.on("error", onError);
    process.stdout.write("Studio password (input hidden): ");
  });
}

async function main() {
  const password = process.stdin.isTTY
    ? await readPasswordInteractively()
    : await readPasswordFromStdin();
  if (!password) {
    console.error("No password supplied. Pipe one in or type it at the prompt.");
    process.exit(1);
  }
  const saltBase64 = generateSalt();
  const hashBase64 = derivePasswordHash(password, saltBase64);
  if (!hashBase64) {
    console.error("Failed to derive a hash from the generated salt.");
    process.exit(1);
  }
  console.log(`STUDIO_PASSWORD_SALT=${saltBase64}`);
  console.log(`STUDIO_PASSWORD_HASH=${hashBase64}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
