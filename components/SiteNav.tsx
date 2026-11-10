"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/", label: "Rankings" },
  { href: "/map", label: "Map" },
];

export default function SiteNav() {
  const pathname = usePathname();
  return (
    <nav className="site-nav" aria-label="Main">
      {LINKS.map(({ href, label }) => (
        <Link key={href} href={href} className="site-nav-link" aria-current={pathname === href ? "page" : undefined}>
          {label}
        </Link>
      ))}
    </nav>
  );
}
