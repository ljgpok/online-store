import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

// No dashboard yet: products is the admin home.
export default async function AdminPage() {
  await requireAdmin("/admin");
  redirect("/admin/products");
}
