import { Suspense } from "react";
import Link from "next/link";
import { requireSuperadmin } from "@/lib/auth";
import PageHeader from "@/components/admin/PageHeader";
import Avatar from "@/components/admin/Avatar";
import CopyButton from "@/components/admin/CopyButton";
import Pagination from "@/components/admin/Pagination";
import { buildHref } from "@/lib/admin/params";
import ProfileFilters, {
  type RoleFilter,
} from "@/components/admin/profiles/ProfileFilters";

const PAGE_SIZE = 50;

type SearchParams = Record<string, string | string[] | undefined>;

type ProfileRow = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  avatar_url: string | null;
  is_superadmin: boolean | null;
};

function first(value: string | string[] | undefined) {
  return (Array.isArray(value) ? value[0] : value) ?? "";
}

function parseParams(params: SearchParams) {
  const q = first(params.q).trim().slice(0, 100);
  const rawRole = first(params.role);
  const role: RoleFilter =
    rawRole === "superadmin" || rawRole === "standard" ? rawRole : "all";
  const page = Math.max(1, Math.floor(Number(first(params.page))) || 1);
  return { q, role, page };
}

// Keep only characters that are safe inside a PostgREST or() filter
// (letters, digits, spaces, apostrophes, hyphens), then split into terms.
function searchTerms(q: string) {
  return q
    .replace(/[^\p{L}\p{N}\s'-]/gu, " ")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 5);
}

function shortId(id: string) {
  return id.length > 13 ? `${id.slice(0, 8)}…${id.slice(-4)}` : id;
}

function displayName(p: ProfileRow) {
  return [p.first_name, p.last_name].filter(Boolean).join(" ").trim();
}

function pageHref(q: string, role: RoleFilter, page: number) {
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  if (role !== "all") params.set("role", role);
  if (page > 1) params.set("page", String(page));
  const qs = params.toString();
  return qs ? `/admin/profiles?${qs}` : "/admin/profiles";
}

// Cross-navigation to this user's generations and votes.
function ActivityLinks({ userId }: { userId: string }) {
  const linkClass =
    "text-xs text-zinc-600 underline-offset-2 hover:text-zinc-900 hover:underline dark:text-zinc-400 dark:hover:text-zinc-100";
  return (
    <span className="flex gap-3 whitespace-nowrap">
      <Link href={buildHref("/admin/generations", { user: userId })} className={linkClass}>
        Generations
      </Link>
      <Link href={buildHref("/admin/votes", { user: userId })} className={linkClass}>
        Votes
      </Link>
    </span>
  );
}

function SuperadminBadge({ value }: { value: boolean }) {
  return value ? (
    <span className="rounded border border-zinc-400 px-1.5 py-0.5 text-xs font-medium dark:border-zinc-500">
      Superadmin
    </span>
  ) : (
    <span className="text-xs text-zinc-500 dark:text-zinc-400">No</span>
  );
}

async function ProfilesContent({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const { supabase } = await requireSuperadmin();
  const { q, role, page } = parseParams(await searchParams);

  // Read-only. RLS (superadmin read-all policy) decides which rows return.
  let query = supabase
    .from("profiles")
    .select("id, first_name, last_name, avatar_url, is_superadmin", {
      count: "exact",
    });

  // Every term must match the first or last name, so "alex kim" works.
  for (const term of searchTerms(q)) {
    query = query.or(`first_name.ilike.*${term}*,last_name.ilike.*${term}*`);
  }
  if (role === "superadmin") query = query.eq("is_superadmin", true);
  if (role === "standard") query = query.or("is_superadmin.is.null,is_superadmin.eq.false");

  const from = (page - 1) * PAGE_SIZE;
  const { data, count, error } = await query
    .order("last_name", { ascending: true, nullsFirst: false })
    .order("first_name", { ascending: true, nullsFirst: false })
    .order("id")
    .range(from, from + PAGE_SIZE - 1);

  if (error) {
    console.error("[admin/profiles]", error.code, error.message);
    return (
      <>
        <ProfileFilters q={q} role={role} />
        <p className="rounded border border-red-300 p-4 text-sm text-red-700 dark:border-red-900 dark:text-red-400">
          Could not load profiles. Please try again.
        </p>
      </>
    );
  }

  const profiles = (data ?? []) as ProfileRow[];
  const total = count ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const shownFrom = total === 0 ? 0 : from + 1;
  const shownTo = from + profiles.length;

  return (
    <>
      <ProfileFilters q={q} role={role} />

      <p className="mb-2 text-xs text-zinc-500 tabular-nums dark:text-zinc-400">
        {total === 0
          ? "No profiles match."
          : `Showing ${shownFrom}–${shownTo} of ${total} ${total === 1 ? "profile" : "profiles"}`}
      </p>

      {profiles.length > 0 && (
        <>
          {/* Table on wider screens */}
          <div className="hidden overflow-x-auto rounded border border-zinc-200 md:block dark:border-zinc-800">
            <table className="w-full text-sm">
              <thead className="bg-zinc-50 text-left text-xs text-zinc-500 dark:bg-zinc-900 dark:text-zinc-400">
                <tr>
                  <th className="px-3 py-2 font-medium">
                    <span className="sr-only">Avatar</span>
                  </th>
                  <th className="px-3 py-2 font-medium">First name</th>
                  <th className="px-3 py-2 font-medium">Last name</th>
                  <th className="px-3 py-2 font-medium">User ID</th>
                  <th className="px-3 py-2 font-medium">Superadmin</th>
                  <th className="px-3 py-2 font-medium">Activity</th>
                </tr>
              </thead>
              <tbody>
                {profiles.map((p) => (
                  <tr
                    key={p.id}
                    className="border-t border-zinc-200 dark:border-zinc-800"
                  >
                    <td className="w-12 px-3 py-2">
                      <Avatar src={p.avatar_url} name={displayName(p)} />
                    </td>
                    <td className="px-3 py-2">
                      {p.first_name || <Missing />}
                    </td>
                    <td className="px-3 py-2">
                      {p.last_name || <Missing />}
                    </td>
                    <td className="px-3 py-2">
                      <span
                        className="font-mono text-xs text-zinc-500 dark:text-zinc-400"
                        title={p.id}
                      >
                        {shortId(p.id)}
                      </span>{" "}
                      <CopyButton value={p.id} label="Copy ID" />
                    </td>
                    <td className="px-3 py-2">
                      <SuperadminBadge value={p.is_superadmin === true} />
                    </td>
                    <td className="px-3 py-2">
                      <ActivityLinks userId={p.id} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Cards on small screens */}
          <ul className="flex flex-col gap-2 md:hidden">
            {profiles.map((p) => (
              <li
                key={p.id}
                className="flex items-center gap-3 rounded border border-zinc-200 p-3 dark:border-zinc-800"
              >
                <Avatar src={p.avatar_url} name={displayName(p)} size={40} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="truncate text-sm font-medium">
                      {displayName(p) || <Missing label="No name set" />}
                    </span>
                    {p.is_superadmin === true && <SuperadminBadge value />}
                  </div>
                  <div className="flex items-center gap-1">
                    <span
                      className="font-mono text-xs text-zinc-500 dark:text-zinc-400"
                      title={p.id}
                    >
                      {shortId(p.id)}
                    </span>
                    <CopyButton value={p.id} label="Copy ID" />
                  </div>
                  <ActivityLinks userId={p.id} />
                </div>
              </li>
            ))}
          </ul>
        </>
      )}

      <Pagination
        page={page}
        pageCount={pageCount}
        hrefFor={(n) => pageHref(q, role, n)}
      />
    </>
  );
}

function Missing({ label = "—" }: { label?: string }) {
  return <span className="text-zinc-400 dark:text-zinc-500">{label}</span>;
}

export default function ProfilesPage({
  searchParams,
}: PageProps<"/admin/profiles">) {
  return (
    <>
      <PageHeader
        title="Users"
        description="All users, from the profiles table. Read-only."
      />
      <Suspense fallback={<p className="text-sm text-zinc-500">Loading…</p>}>
        <ProfilesContent searchParams={searchParams} />
      </Suspense>
    </>
  );
}
