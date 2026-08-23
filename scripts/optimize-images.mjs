import sharp from "sharp";
import { readdirSync, statSync } from "node:fs";
import path from "node:path";

const files = [
  ...readdirSync("public/covers").filter((n) => n.endsWith(".png")).map((n) => path.join("public/covers", n)),
  "public/hero-clean.png",
];

for (const input of files) {
  const output = input.replace(/\.png$/, ".webp");
  const info = await sharp(input).webp({ quality: 82 }).toFile(output);
  console.log(`${input} -> ${output}  ${(statSync(input).size / 1e6).toFixed(2)}MB -> ${(info.size / 1e6).toFixed(2)}MB`);
}
