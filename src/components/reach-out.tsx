"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight } from "lucide-react";

type Copy = {
  name: string;
  namePlaceholder: string;
  message: string;
  messagePlaceholder: string;
  send: string;
  sending: string;
  success: string;
  error: string;
  empty: string;
};

type PublicMessage = {
  id: string;
  name: string;
  message: string;
  createdAt: string;
};

export function ReachOut({ copy, locale }: { copy: Copy; locale: string }) {
  const [messages, setMessages] = useState<PublicMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<"idle" | "sending" | "success" | "error">("idle");
  const etagRef = useRef<string | null>(null);
  const dateFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(locale, {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }),
    [locale],
  );

  const loadMessages = useCallback(async () => {
    try {
      const headers: HeadersInit = {};
      if (etagRef.current) headers["If-None-Match"] = etagRef.current;
      const response = await fetch("/api/messages", { headers, cache: "no-store" });
      if (response.status === 304) return; // wall unchanged; keep current state
      if (!response.ok) throw new Error("Message wall unavailable");
      const etag = response.headers.get("ETag");
      if (etag) etagRef.current = etag;
      const data = (await response.json()) as { messages: PublicMessage[] };
      setMessages(data.messages);
    } catch {
      setStatus("error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const initialRefresh = window.setTimeout(() => void loadMessages(), 0);
    const interval = window.setInterval(loadMessages, 15_000);
    return () => {
      window.clearTimeout(initialRefresh);
      window.clearInterval(interval);
    };
  }, [loadMessages]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("sending");

    const form = event.currentTarget;
    const formData = new FormData(form);

    try {
      const response = await fetch("/api/messages", {
        method: "POST",
        body: formData,
      });
      if (!response.ok) throw new Error("Message could not be posted");

      const data = (await response.json()) as { message: PublicMessage };
      setMessages((current) => [data.message, ...current]);
      setStatus("success");
      form.reset();
    } catch {
      setStatus("error");
    }
  }

  return (
    <div className="reach-layout">
      <form className="message-form" onSubmit={handleSubmit}>
        <div className="field honeypot" aria-hidden="true">
          <label htmlFor="website">Website</label>
          <input id="website" name="website" tabIndex={-1} autoComplete="off" />
        </div>
        <div className="field">
          <label htmlFor="name">{copy.name}</label>
          <input
            id="name"
            name="name"
            type="text"
            maxLength={40}
            placeholder={copy.namePlaceholder}
          />
        </div>
        <div className="field">
          <label htmlFor="message">{copy.message}</label>
          <textarea
            id="message"
            name="message"
            required
            minLength={2}
            maxLength={500}
            rows={6}
            placeholder={copy.messagePlaceholder}
          />
        </div>
        <button type="submit" disabled={status === "sending"}>
          {status === "sending" ? copy.sending : copy.send}
          <ArrowRight aria-hidden="true" size={16} strokeWidth={1.7} />
        </button>
        <p className="form-status" aria-live="polite">
          {status === "success" ? copy.success : null}
          {status === "error" ? copy.error : null}
        </p>
      </form>

      <div className="message-wall" aria-busy={loading}>
        {messages.length > 0 ? (
          messages.map((entry) => (
            <article className="public-message" key={entry.id}>
              <header>
                <strong>{entry.name}</strong>
                <time dateTime={entry.createdAt}>
                  {dateFormatter.format(new Date(entry.createdAt))}
                </time>
              </header>
              <p>{entry.message}</p>
            </article>
          ))
        ) : (
          <p className="empty-wall">{loading ? "···" : copy.empty}</p>
        )}
      </div>
    </div>
  );
}
