import { appendFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { rateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const subscribersFile = path.join(process.cwd(), "data", "subscribers.ndjson");
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { email?: string; website?: string } | null;
  if (body?.website) return Response.json({ ok: true }, { status: 202 }); // honeypot — no rate budget spent

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  const { ok, retryAfterSec } = rateLimit(`subscribe:${ip}`, 5, 60 * 60 * 1000);
  if (!ok) return Response.json({ error: "Too many requests" }, { status: 429, headers: { "Retry-After": String(retryAfterSec) } });

  const email = body?.email?.trim().toLowerCase() ?? "";
  if (!emailPattern.test(email) || email.length > 254) {
    return Response.json({ error: "Invalid email" }, { status: 400 });
  }

  await mkdir(path.dirname(subscribersFile), { recursive: true }); // fresh clones have no data/ (gitignored content)
  await appendFile(subscribersFile, `${JSON.stringify({ email, createdAt: new Date().toISOString() })}\n`, "utf8");

  const apiKey = process.env.BUTTONDOWN_API_KEY;
  if (apiKey) {
    const response = await fetch("https://api.buttondown.com/v1/subscribers", {
      method: "POST",
      headers: { Authorization: `Token ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    if (!response.ok && response.status !== 409) {
      // 409 = already subscribed; still a success for the visitor.
      return Response.json({ error: "Provider error" }, { status: 502 });
    }
  }

  return Response.json({ ok: true }, { status: 201 });
}
