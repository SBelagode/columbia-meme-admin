// Plain module (not "use client") so both Server and Client Components can read it.
export const ADMIN_NAV_ITEMS = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/profiles", label: "Profiles" },
  { href: "/admin/generations", label: "Generations" },
  { href: "/admin/votes", label: "Votes" },
] as const;
