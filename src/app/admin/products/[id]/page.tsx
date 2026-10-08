import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminHeader } from "@/components/admin/admin-header";
import { ProductForm } from "@/components/admin/product-form";
import { getProductForAdmin, listCategoryOptionsForAdmin, parseNumericId } from "@/db/admin-queries";
import { requireAdmin } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Edit product · Admin", robots: { index: false } };
export const dynamic = "force-dynamic";

const savedCopy: Record<string, string> = {
  created: "Product created. It’s live in the shop now.",
  updated: "Changes saved. The shop shows them now.",
};

export default async function Page({ params, searchParams }: PageProps<"/admin/products/[id]">) {
  const { id: raw } = await params;
  const { saved } = await searchParams;
  await requireAdmin(`/admin/products/${raw}`);
  const id = parseNumericId(raw);
  const [product, categories] = await Promise.all([
    id ? getProductForAdmin(id) : undefined,
    listCategoryOptionsForAdmin(),
  ]);
  if (!product) notFound();
  const notice = typeof saved === "string" ? savedCopy[saved] : undefined;

  return (
    <>
      <AdminHeader title={product.name} back={{ href: "/admin/products", label: "Products" }}>
        <Link href={`/products/${product.slug}`} className="btn btn-secondary btn-sm">
          View in shop
        </Link>
      </AdminHeader>
      {notice && (
        <p role="status" className="text-ui text-confirm border-l-2 border-confirm pl-4">
          {notice}
        </p>
      )}
      {/* Keyed by the saved version so a successful save shows the stored values. */}
      <ProductForm key={JSON.stringify(product)} product={product} categories={categories} />
    </>
  );
}
