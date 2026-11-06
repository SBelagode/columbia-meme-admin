"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ADMIN_NAV_GROUPS } from "./nav-items";

function isActive(pathname: string, href: string) {
  return href === "/admin"
    ? pathname === href
    : pathname === href || pathname.startsWith(`${href}/`);
}

// Grouped vertical list, shown in the sidebar on desktop and the drawer on mobile.
export default function AdminNav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();

  return (
    <nav aria-label="Admin">
      <ul className="flex flex-col gap-3">
        {ADMIN_NAV_GROUPS.map((group) => (
          <li key={group.label ?? "main"}>
            {group.label && (
              <p className="px-3 pb-1 text-[11px] font-medium tracking-wide text-zinc-400 uppercase dark:text-zinc-500">
                {group.label}
              </p>
            )}
            <ul className="flex flex-col gap-0.5">
              {group.items.map(({ href, label }) => {
                const active = isActive(pathname, href);
                return (
                  <li key={href}>
                    <Link
                      href={href}
                      aria-current={active ? "page" : undefined}
                      onNavigate={onNavigate}
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
