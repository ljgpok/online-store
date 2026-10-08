import Link from "next/link";
import type { ReactNode } from "react";

/** The heading row of an admin page, with optional actions (e.g. "New product"). */
export function AdminHeader({
  title,
  back,
  children,
}: {
  title: string;
  back?: { href: string; label: string };
  children?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      {back && (
        <Link href={back.href} className="link-quiet text-sm self-start">
          <span aria-hidden="true">← </span>
          {back.label}
        </Link>
      )}
      <div className="flex flex-wrap items-baseline justify-between gap-4">
        <h1 className="text-title">{title}</h1>
        {children && <div className="flex flex-wrap gap-3">{children}</div>}
      </div>
    </div>
  );
}

/** Placeholder body for sections not built yet. */
export function AdminPending({ children }: { children: ReactNode }) {
  return <p className="text-body text-graphite rule-t pt-(--space-block)">{children}</p>;
}
