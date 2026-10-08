import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AdminHeader, AdminPending } from "@/components/admin/admin-header";
import { getProductNameForAdmin, parseNumericId } from "@/db/admin-queries";
import { requireAdmin } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Edit product · Admin", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function Page({ params }: PageProps<"/admin/products/[id]">) {
  const { id: raw } = await params;
  await requireAdmin(`/admin/products/${raw}`);
  const id = parseNumericId(raw);
  const name = id ? await getProductNameForAdmin(id) : undefined;
  if (!name) notFound();

  return (
    <>
      <AdminHeader title={name} back={{ href: "/admin/products", label: "Products" }} />
      <AdminPending>The product form arrives in the next step.</AdminPending>
    </>
  );
}
