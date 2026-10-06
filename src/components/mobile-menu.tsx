"use client";

import Link from "next/link";
import { useEffect, useId, useState } from "react";
import { primaryNav } from "./site-nav";

// Below 64rem the primary navigation folds into a panel under the header.
export function MobileMenu() {
  const [open, setOpen] = useState(false);
  const panelId = useId();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <div className="lg:hidden">
      <button
        type="button"
        className="link-nav cursor-pointer"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((o) => !o)}
      >
        {open ? "Close" : "Menu"}
      </button>

      <nav
        id={panelId}
        aria-label="Primary"
        hidden={!open}
        className="absolute inset-x-0 top-full h-[calc(100svh-var(--header-height))] overflow-y-auto bg-white rule-t"
      >
        <ul className="container-page flex flex-col py-6">
          {primaryNav.map((item) => (
            <li key={item.href}>
              <Link
                href={item.href}
                className="block py-3 text-title"
                onClick={() => setOpen(false)}
              >
                {item.label}
              </Link>
            </li>
          ))}
        </ul>
        <ul className="container-page flex flex-col gap-3 pb-10 text-ui">
          <li>
            <Link href="/search" className="link-quiet" onClick={() => setOpen(false)}>
              Search
            </Link>
          </li>
          <li>
            <Link href="/account" className="link-quiet" onClick={() => setOpen(false)}>
              Account
            </Link>
          </li>
        </ul>
      </nav>
    </div>
  );
}
