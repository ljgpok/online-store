import type { Metadata } from "next";
import { AdminHeader, AdminPending } from "@/components/admin/admin-header";
import { requireAdmin } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Orders · Admin", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function Page() {
  await requireAdmin("/admin/orders");

  return (
    <>
      <AdminHeader title="Orders" />
      <AdminPending>The order list arrives in the next step.</AdminPending>
    </>
  );
}
