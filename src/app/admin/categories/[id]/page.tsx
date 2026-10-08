import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AdminHeader, AdminPending } from "@/components/admin/admin-header";
import { getCategoryNameForAdmin, parseNumericId } from "@/db/admin-queries";
import { requireAdmin } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Edit category · Admin", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function Page({ params }: PageProps<"/admin/categories/[id]">) {
  const { id: raw } = await params;
  await requireAdmin(`/admin/categories/${raw}`);
  const id = parseNumericId(raw);
  const name = id ? await getCategoryNameForAdmin(id) : undefined;
  if (!name) notFound();

  return (
    <>
      <AdminHeader title={name} back={{ href: "/admin/categories", label: "Categories" }} />
      <AdminPending>The category form arrives in the next step.</AdminPending>
    </>
  );
}
