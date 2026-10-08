import type { Metadata } from "next";
import { AdminHeader, AdminPending } from "@/components/admin/admin-header";
import { requireAdmin } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Products · Admin", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function Page() {
  await requireAdmin("/admin/products");

  return (
    <>
      <AdminHeader title="Products" />
      <AdminPending>The product list arrives in the next step.</AdminPending>
    </>
  );
}
