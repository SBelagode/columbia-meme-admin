"use client";

import { useEffect, useRef, useState } from "react";
import type { ComponentProps, ReactNode } from "react";
import AdminNav from "./AdminNav";

const SIDEBAR_ID = "admin-sidebar";
// Tailwind's `md` breakpoint.
const DESKTOP_QUERY = "(min-width: 48rem)";

const ICON_BUTTON_CLASS =
  "shrink-0 items-center justify-center rounded border border-zinc-300 p-1.5 hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900";

function MenuButton({ className, ...props }: ComponentProps<"button">) {
  return (
    <button
      type="button"
      aria-label="Toggle navigation menu"
      aria-controls={SIDEBAR_ID}
      className={`${ICON_BUTTON_CLASS} ${className}`}
      {...props}
    >
      <svg
        aria-hidden="true"
        viewBox="0 0 20 20"
        className="size-5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      >
        <path d="M3 5h14M3 10h14M3 15h14" />
      </svg>
    </button>
  );
}

// Layout chrome only; authorization stays in the server layout that renders
// this. Desktop and mobile keep separate state because they start differently
// (sidebar shown vs. drawer closed), and each gets its own button so that the
// breakpoint is resolved in CSS and the server-rendered markup is always right.
export default function AdminShell({
  account,
  children,
}: {
  account: ReactNode;
  children: ReactNode;
}) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const drawerButtonRef = useRef<HTMLButtonElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!drawerOpen) return;

    const drawerButton = drawerButtonRef.current;
    const desktop = window.matchMedia(DESKTOP_QUERY);
    const close = () => setDrawerOpen(false);
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };

    closeButtonRef.current?.focus();
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", closeOnEscape);
    // The rest of the page is inert while the drawer is open, so it must not
    // stay open once a resize turns it back into the in-flow sidebar.
    desktop.addEventListener("change", close);

    return () => {
      document.body.style.overflow = "";
      document.removeEventListener("keydown", closeOnEscape);
      desktop.removeEventListener("change", close);
      drawerButton?.focus();
    };
  }, [drawerOpen]);

  return (
    <div className="flex flex-1 flex-col">
      {/* Sticky so the menu button stays reachable on long, scrolled pages. */}
      <header
        inert={drawerOpen}
        className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-zinc-200 bg-background px-4 py-3 dark:border-zinc-800"
      >
        <div className="flex min-w-0 items-center gap-3">
          <MenuButton
            ref={drawerButtonRef}
            className="inline-flex md:hidden"
            aria-expanded={drawerOpen}
            onClick={() => setDrawerOpen(true)}
          />
          <MenuButton
            className="hidden md:inline-flex"
            aria-expanded={!sidebarCollapsed}
            onClick={() => setSidebarCollapsed((collapsed) => !collapsed)}
          />
          <span className="truncate font-semibold">Columbia Meme Admin</span>
        </div>
        {account}
      </header>
      <div className="flex flex-1">
        {drawerOpen && (
          <div
            aria-hidden="true"
            className="fixed inset-0 z-40 bg-black/40 md:hidden"
            onClick={() => setDrawerOpen(false)}
          />
        )}
        {/* Visibility is only transitioned on close: it has to flip instantly
            on open, or the close button can't take focus yet. */}
        <aside
          id={SIDEBAR_ID}
          className={`fixed inset-y-0 left-0 z-50 w-64 max-w-[85vw] overflow-y-auto border-r border-zinc-200 bg-background p-2 duration-200 motion-reduce:transition-none md:visible md:static md:z-auto md:w-52 md:max-w-none md:shrink-0 md:translate-x-0 md:overflow-visible md:transition-none dark:border-zinc-800 ${
            drawerOpen
              ? "translate-x-0 transition-[translate]"
              : "invisible -translate-x-full transition-[translate,visibility]"
          } ${sidebarCollapsed ? "md:hidden" : ""}`}
        >
          <div className="flex justify-end pb-2 md:hidden">
            <button
              ref={closeButtonRef}
              type="button"
              aria-label="Close navigation menu"
              className={`inline-flex ${ICON_BUTTON_CLASS}`}
              onClick={() => setDrawerOpen(false)}
            >
              <svg
                aria-hidden="true"
                viewBox="0 0 20 20"
                className="size-5"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.75"
                strokeLinecap="round"
              >
                <path d="M5 5l10 10M15 5L5 15" />
              </svg>
            </button>
          </div>
          <AdminNav onNavigate={() => setDrawerOpen(false)} />
        </aside>
        <main
          inert={drawerOpen}
          className="min-w-0 flex-1 px-4 py-6 font-sans md:px-8"
        >
          {children}
        </main>
      </div>
    </div>
  );
}
