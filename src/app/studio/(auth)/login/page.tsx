import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireStudioSession } from "@/lib/auth/request";
import LoginForm from "./login-form";

export const metadata: Metadata = { title: "Studio sign in" };

export default async function StudioLoginPage() {
  if (await requireStudioSession()) redirect("/studio");
  return (
    <main className="page-width">
      <div className="reach-page-head">
        <h1>Studio</h1>
        <span>owner access only</span>
      </div>
      <LoginForm />
    </main>
  );
}
