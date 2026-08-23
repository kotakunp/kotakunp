import { writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";

const sampleRate = 8000;
const seconds = 3;
const samples = sampleRate * seconds;
const data = Buffer.alloc(samples * 2);
for (let i = 0; i < samples; i++) {
  const envelope = Math.min(1, i / 800, (samples - i) / 800);
  const value = Math.round(Math.sin((2 * Math.PI * 440 * i) / sampleRate) * 12000 * envelope);
  data.writeInt16LE(value, i * 2);
}
const header = Buffer.alloc(44);
header.write("RIFF", 0); header.writeUInt32LE(36 + data.length, 4); header.write("WAVE", 8);
header.write("fmt ", 12); header.writeUInt32LE(16, 16); header.writeUInt16LE(1, 20);
header.writeUInt16LE(1, 22); header.writeUInt32LE(sampleRate, 24); header.writeUInt32LE(sampleRate * 2, 28);
header.writeUInt16LE(2, 32); header.writeUInt16LE(16, 34);
header.write("data", 36); header.writeUInt32LE(data.length, 40);
mkdirSync("public/audio", { recursive: true });
writeFileSync(path.join("public/audio", "transparent-city-and-rain-preview.wav"), Buffer.concat([header, data]));
console.log("wrote public/audio/transparent-city-and-rain-preview.wav");
