import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AdminHeader, AdminPending } from "@/components/admin/admin-header";
import { getOrderExistsForAdmin } from "@/db/admin-queries";
import { requireAdmin } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Order · Admin", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function Page({ params }: PageProps<"/admin/orders/[id]">) {
  const { id } = await params;
  await requireAdmin(`/admin/orders/${id}`);
  if (!(await getOrderExistsForAdmin(id))) notFound();

  return (
    <>
      <AdminHeader
        title={`Order ${id.slice(0, 8).toUpperCase()}`}
        back={{ href: "/admin/orders", label: "Orders" }}
      />
      <AdminPending>Order details arrive in the next step.</AdminPending>
    </>
  );
}
