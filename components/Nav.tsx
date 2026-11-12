"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/", label: "Overview" },
  { href: "/demo", label: "Demonstration" },
  { href: "/results", label: "Results & Conclusions" },
];

export default function Nav() {
  const pathname = usePathname();
  return (
    <header className="border-b border-line">
      <nav className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-x-6 gap-y-2 px-5 py-4">
        <Link href="/" className="font-mono text-sm font-semibold tracking-widest">
          Distribution<span className="text-accent"> Shift</span>
        </Link>
        <ul className="flex flex-wrap gap-x-5 gap-y-1 text-sm">
          {links.map((l) => {
            const active = l.href === "/" ? pathname === "/" : pathname.startsWith(l.href);
            return (
              <li key={l.href}>
                <Link
                  href={l.href}
                  aria-current={active ? "page" : undefined}
                  className={
                    active
                      ? "border-b border-accent pb-0.5 text-fg"
                      : "pb-0.5 text-muted transition-colors hover:text-fg"
                  }
                >
                  {l.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </header>
  );
}
