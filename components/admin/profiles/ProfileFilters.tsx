import Form from "next/form";
import Link from "next/link";

export type RoleFilter = "all" | "superadmin" | "standard";

// Plain GET form: filters live in the URL, so results are shareable and
// rendered on the server. next/form makes submission a client navigation.
export default function ProfileFilters({
  q,
  role,
}: {
  q: string;
  role: RoleFilter;
}) {
  const active = q !== "" || role !== "all";

  return (
    <Form
      action="/admin/profiles"
      className="mb-4 flex flex-wrap items-end gap-2"
    >
      <label className="flex min-w-0 flex-1 flex-col gap-1 text-xs text-zinc-500 dark:text-zinc-400 sm:max-w-xs">
        Search by name
        <input
          type="search"
          name="q"
          defaultValue={q}
          placeholder="First or last name"
          className="rounded border border-zinc-300 bg-transparent px-2 py-1.5 text-sm text-zinc-900 placeholder:text-zinc-400 dark:border-zinc-700 dark:text-zinc-100"
        />
      </label>
      <label className="flex flex-col gap-1 text-xs text-zinc-500 dark:text-zinc-400">
        Role
        <select
          name="role"
          defaultValue={role}
          className="rounded border border-zinc-300 bg-transparent px-2 py-1.5 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-black dark:text-zinc-100"
        >
          <option value="all">All</option>
          <option value="superadmin">Superadmins</option>
          <option value="standard">Non-admins</option>
        </select>
      </label>
      <button
        type="submit"
        className="rounded border border-zinc-300 px-3 py-1.5 text-sm hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900"
      >
        Apply
      </button>
      {active && (
        <Link
          href="/admin/profiles"
          className="px-2 py-1.5 text-sm text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
        >
          Clear
        </Link>
      )}
    </Form>
  );
}
