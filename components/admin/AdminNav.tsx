"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ADMIN_NAV_GROUPS } from "./nav-items";

function isActive(pathname: string, href: string) {
  return href === "/admin"
    ? pathname === href
    : pathname === href || pathname.startsWith(`${href}/`);
}

// Grouped vertical list on desktop; one horizontally scrolling row on mobile
// (group headings hidden).
export default function AdminNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="Admin">
      <ul className="flex gap-1 overflow-x-auto md:flex-col md:gap-3">
        {ADMIN_NAV_GROUPS.map((group) => (
          <li key={group.label ?? "main"} className="contents md:block">
            {group.label && (
              <p className="hidden px-3 pb-1 text-[11px] font-medium tracking-wide text-zinc-400 uppercase md:block dark:text-zinc-500">
                {group.label}
              </p>
            )}
            <ul className="contents md:flex md:flex-col md:gap-0.5">
              {group.items.map(({ href, label }) => {
                const active = isActive(pathname, href);
                return (
                  <li key={href}>
                    <Link
                      href={href}
                      aria-current={active ? "page" : undefined}
                      className={`block whitespace-nowrap rounded px-3 py-1.5 text-sm ${
                        active
                          ? "bg-zinc-200 font-medium text-zinc-900 dark:bg-zinc-800 dark:text-zinc-50"
                          : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-zinc-50"
                      }`}
                    >
                      {label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </li>
        ))}
      </ul>
    </nav>
  );
}
