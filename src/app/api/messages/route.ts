import { createHash } from "node:crypto";
import { appendFile, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { rateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type PublicMessage = {
  id: string;
  name: string;
  message: string;
  createdAt: string;
};

const messageFile = path.join(process.cwd(), "data", "reach-out.ndjson");

async function readAllLines(): Promise<PublicMessage[]> {
  const source = await readFile(messageFile, "utf8");
  return source
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line) as PublicMessage);
}

export async function GET(request: Request) {
  let source: string;
  try {
    source = await readFile(messageFile, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") source = "";
    else throw error;
  }
  const etag = `"${createHash("sha1").update(source).digest("hex")}"`;
  const headers = { ETag: etag, "Cache-Control": "private, no-cache" };
  if (request.headers.get("if-none-match") === etag) {
    return new Response(null, { status: 304, headers });
  }
  const messages = source
    ? JSON.parse(`[${source.trim().split("\n").filter(Boolean).join(",")}]`)
    : [];
  return Response.json({ messages: messages.slice(-30).reverse() }, { headers });
}

export async function POST(request: Request) {
  const formData = await request.formData();
  const website = String(formData.get("website") ?? "").trim();
  const rawName = String(formData.get("name") ?? "").trim();
  const message = String(formData.get("message") ?? "").trim();

  if (website) return Response.json({ ok: true }, { status: 202 });

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  const { ok, retryAfterSec } = rateLimit(`messages:${ip}`, 5, 60 * 60 * 1000);
  if (!ok) {
    return Response.json(
      { error: "Too many messages" },
      { status: 429, headers: { "Retry-After": String(retryAfterSec) } },
    );
  }

  if (message.length < 2 || message.length > 500 || rawName.length > 40) {
    return Response.json({ error: "Invalid message" }, { status: 400 });
  }

  const linkCount = message.match(/https?:\/\//gi)?.length ?? 0;
  if (linkCount > 1) {
    return Response.json({ error: "Too many links" }, { status: 400 });
  }

  const entry: PublicMessage = {
    id: crypto.randomUUID(),
    name: rawName || "anonymous",
    message,
    createdAt: new Date().toISOString(),
  };

  await mkdir(path.dirname(messageFile), { recursive: true });
  await appendFile(messageFile, `${JSON.stringify(entry)}\n`, "utf8");

  const all = await readAllLines();
  if (all.length > 1000) {
    await writeFile(
      messageFile,
      all.slice(-1000).map((l) => `${JSON.stringify(l)}\n`).join(""),
      "utf8",
    );
  }
  return Response.json({ message: entry }, { status: 201 });
}
