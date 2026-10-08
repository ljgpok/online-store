import type { Metadata } from "next";
import { AdminHeader } from "@/components/admin/admin-header";
import { ProductForm } from "@/components/admin/product-form";
import { listCategoryOptionsForAdmin } from "@/db/admin-queries";
import { requireAdmin } from "@/lib/auth/session";

export const metadata: Metadata = { title: "New product · Admin", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function Page() {
  await requireAdmin("/admin/products/new");
  const categories = await listCategoryOptionsForAdmin();

  return (
    <>
      <AdminHeader title="New product" back={{ href: "/admin/products", label: "Products" }} />
      <ProductForm categories={categories} />
    </>
  );
}
