import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { requireStudioSession } from "@/lib/auth/request";

export default async function ProtectedStudioLayout({ children }: { children: ReactNode }) {
  const session = await requireStudioSession();
  if (!session) redirect("/studio/login");
  return <>{children}</>;
}
