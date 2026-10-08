"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { SignOutButton } from "@/components/auth/sign-out-button";

// Only sections that exist. Add addresses and so on here as they ship.
const accountNav = [
  { label: "Account information", href: "/account" },
  { label: "Orders", href: "/account/orders" },
];

/** "page" on the section itself; "true" on pages inside it, such as one order. */
function current(pathname: string, href: string) {
  if (pathname === href) return "page" as const;
  if (href !== "/account" && pathname.startsWith(`${href}/`)) return "true" as const;
  return undefined;
}

/**
 * Section navigation for the account area: a row above the content on small
 * screens, a column beside it from `lg` up.
 */
export function AccountNav({ isAdmin }: { isAdmin: boolean }) {
  const pathname = usePathname();
  const items = isAdmin ? [...accountNav, { label: "Admin", href: "/admin" }] : accountNav;

  return (
    <nav
      aria-label="Account"
      className="rule-b pb-4 lg:sticky lg:top-24 lg:self-start lg:border-b-0 lg:pb-0"
    >
      <ul className="flex flex-wrap items-baseline gap-x-6 gap-y-2 lg:flex-col lg:items-start lg:gap-3">
        {items.map((item) => (
          <li key={item.href}>
            <Link
              href={item.href}
              className="link-nav"
              aria-current={current(pathname, item.href)}
            >
              {item.label}
            </Link>
          </li>
        ))}
        <li className="lg:rule-t lg:mt-3 lg:w-full lg:pt-6">
          <SignOutButton className="link-quiet py-1.5 text-sm font-medium cursor-pointer" />
        </li>
      </ul>
    </nav>
  );
}
