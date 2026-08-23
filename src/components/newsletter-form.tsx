"use client";

import { FormEvent, useState } from "react";
import { ArrowRight } from "lucide-react";

type Copy = { email: string; send: string; sending: string; success: string; error: string };

export function NewsletterForm({ copy }: { copy: Copy }) {
  const [status, setStatus] = useState<"idle" | "sending" | "success" | "error">("idle");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("sending");
    const form = event.currentTarget;
    const formData = new FormData(form);
    const data = { email: String(formData.get("email") ?? ""), website: String(formData.get("website") ?? "") };
    try {
      const response = await fetch("/api/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error("subscribe failed");
      setStatus("success");
      form.reset();
    } catch {
      setStatus("error");
    }
  }

  return (
    <form className="newsletter-form" onSubmit={handleSubmit}>
      <div className="field honeypot" aria-hidden="true">
        <label htmlFor="newsletter-website">Website</label>
        <input id="newsletter-website" name="website" tabIndex={-1} autoComplete="off" />
      </div>
      <input name="email" type="email" required maxLength={254} placeholder={copy.email} aria-label={copy.email} />
      <button type="submit" disabled={status === "sending"} aria-label={status === "sending" ? copy.sending : copy.send}>
        <ArrowRight aria-hidden="true" size={14} strokeWidth={1.7} />
      </button>
      <p className="form-status" aria-live="polite">
        {status === "success" ? copy.success : null}
        {status === "error" ? copy.error : null}
      </p>
    </form>
  );
}
