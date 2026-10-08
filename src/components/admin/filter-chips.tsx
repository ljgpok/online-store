import Link from "next/link";

/** Filter links that keep their state in the URL, so results can be shared and reloaded. */
export function FilterChips({
  label,
  options,
  current,
}: {
  label: string;
  options: { label: string; href: string; value: string }[];
  current: string;
}) {
  return (
    <nav aria-label={label}>
      <ul className="flex flex-wrap gap-2">
        {options.map((o) => (
          <li key={o.value}>
            <Link href={o.href} className="chip" aria-current={o.value === current ? "page" : undefined}>
              {o.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
