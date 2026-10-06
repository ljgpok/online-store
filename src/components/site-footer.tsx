import Link from "next/link";

const groups = [
  {
    title: "Client services",
    links: [
      { label: "Contact us", href: "/contact" },
      { label: "Track an order", href: "/orders" },
      { label: "Delivery", href: "/delivery" },
      { label: "Returns and exchanges", href: "/returns" },
    ],
  },
  {
    title: "Shop",
    links: [
      { label: "New arrivals", href: "/new" },
      { label: "Gift guide", href: "/gifts" },
      { label: "Book a store appointment", href: "/appointments" },
    ],
  },
  {
    title: "About Claude Shop",
    links: [
      { label: "Our workshops", href: "/about" },
      { label: "Careers", href: "/careers" },
      { label: "Sustainability", href: "/sustainability" },
    ],
  },
  {
    title: "Legal",
    links: [
      { label: "Privacy policy", href: "/privacy" },
      { label: "Terms of sale", href: "/terms" },
      { label: "Accessibility", href: "/accessibility" },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="rule-t">
      <div className="container-page grid grid-cols-2 gap-x-6 gap-y-10 py-12 md:grid-cols-4 lg:py-16">
        {groups.map((group) => (
          <nav key={group.title} aria-label={group.title}>
            <h2 className="text-ui mb-4">{group.title}</h2>
            <ul className="flex flex-col gap-2 text-sm">
              {group.links.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="link-quiet">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>
      <div className="container-page flex flex-wrap justify-between gap-4 pb-10 text-meta">
        <span>© 2026 Claude Shop</span>
        <span>United States, prices in USD</span>
      </div>
    </footer>
  );
}
