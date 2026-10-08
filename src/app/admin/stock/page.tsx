import type { Metadata } from "next";
import { AdminHeader, AdminPending } from "@/components/admin/admin-header";
import { requireAdmin } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Stock · Admin", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function Page() {
  await requireAdmin("/admin/stock");

  return (
    <>
      <AdminHeader title="Stock" />
      <AdminPending>Stock levels arrive in the next step.</AdminPending>
    </>
  );
}
