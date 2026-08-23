"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

export default function LoginForm() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      const response = await fetch("/api/studio/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (response.ok) {
        router.replace("/studio");
        router.refresh();
        return;
      }
      setError(
        response.status === 429
          ? "Too many failed attempts. Try again in a few minutes."
          : "That password did not work.",
      );
    } catch {
      setError("Could not reach the server.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form className="message-form" onSubmit={handleSubmit}>
      <div className="field">
        <label htmlFor="studio-password">Password</label>
        <input
          id="studio-password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          disabled={pending}
        />
      </div>
      <button type="submit" disabled={pending}>
        {pending ? "Signing in…" : "Sign in"}
      </button>
      {error && (
        <p className="form-status" role="alert">
          {error}
        </p>
      )}
    </form>
  );
}
