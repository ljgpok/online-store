"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// Convenience only: every admin page and action checks the role on the server.
export const adminSections = [
  { label: "Products", href: "/admin/products" },
  { label: "Categories", href: "/admin/categories" },
  { label: "Stock", href: "/admin/stock" },
  { label: "Orders", href: "/admin/orders" },
];

export function AdminNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Admin" className="rule-b">
      <ul className="flex gap-x-6 overflow-x-auto pb-3 [scrollbar-width:none]">
        {adminSections.map((section) => {
          const current =
            pathname === section.href
              ? "page"
              : pathname.startsWith(`${section.href}/`)
                ? "true"
                : undefined;
          return (
            <li key={section.href} className="shrink-0">
              <Link href={section.href} className="link-nav" aria-current={current}>
                {section.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
