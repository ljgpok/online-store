import Link from "next/link";
import { MobileMenu } from "./mobile-menu";
import { primaryNav } from "./site-nav";

export function SiteHeader() {
  return (
    <header className="header-bar container-page">
      <div>
        <nav aria-label="Primary" className="flex gap-6 max-lg:hidden">
          {primaryNav.map((item) => (
            <Link key={item.href} href={item.href} className="link-nav">
              {item.label}
            </Link>
          ))}
        </nav>
        <MobileMenu />
      </div>

      <Link
        href="/"
        className="text-subtitle font-semibold font-stretch-75% tracking-heading"
      >
        Claude Shop
      </Link>

      <div className="flex justify-end gap-6">
        <Link href="/search" className="link-nav max-lg:hidden">
          Search
        </Link>
        <Link href="/account" className="link-nav max-lg:hidden">
          Account
        </Link>
        <Link href="/bag" className="link-nav">
          Bag (0)
        </Link>
      </div>
    </header>
  );
}
