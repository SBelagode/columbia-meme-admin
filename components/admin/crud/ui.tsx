import Link from "next/link";
import { DASHBOARD_TIME_ZONE } from "@/lib/admin/dates";

// Small presentational pieces shared by the admin resource pages.

const timeFormat = new Intl.DateTimeFormat("en-US", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: DASHBOARD_TIME_ZONE,
});

export function Time({ value }: { value: string | null }) {
  if (!value) return <Missing />;
  return <time dateTime={value}>{timeFormat.format(new Date(value))}</time>;
}

export function Missing({ label = "—" }: { label?: string }) {
  return <span className="text-zinc-400 dark:text-zinc-500">{label}</span>;
}

export function LoadError({ resource }: { resource: string }) {
  return (
    <p className="rounded border border-red-300 p-4 text-sm text-red-700 dark:border-red-900 dark:text-red-400">
      Could not load {resource}. Please try again.
    </p>
  );
}

export function Summary({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-2 text-xs text-zinc-500 tabular-nums dark:text-zinc-400">{children}</p>
  );
}

export function Note({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-4 rounded border border-dashed border-zinc-300 px-3 py-2 text-xs text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
      {children}
    </p>
  );
}

export function ActiveBadge({ active }: { active: boolean }) {
  return active ? (
    <span className="rounded border border-zinc-400 px-1.5 py-0.5 text-xs font-medium dark:border-zinc-500">
      Active
    </span>
  ) : (
    <span className="rounded border border-dashed border-zinc-300 px-1.5 py-0.5 text-xs text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
      Inactive
    </span>
  );
}

const STATUS_STYLES: Record<string, string> = {
  succeeded: "border-green-600 text-green-800 dark:border-green-700 dark:text-green-400",
  failed: "border-red-400 text-red-700 dark:border-red-800 dark:text-red-400",
  blocked: "border-amber-500 text-amber-800 dark:border-amber-700 dark:text-amber-400",
  pending: "border-dashed border-zinc-400 text-zinc-600 dark:border-zinc-600 dark:text-zinc-300",
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`whitespace-nowrap rounded border px-1.5 py-0.5 text-xs font-medium ${
        STATUS_STYLES[status] ?? "border-zinc-300 dark:border-zinc-700"
      }`}
    >
      {status}
    </span>
  );
}

export function Thumb({
  src,
  alt = "",
  size = "h-12 w-12",
}: {
  src: string | null | undefined;
  alt?: string;
  size?: string;
}) {
  return src ? (
    // Supabase Storage public URL; plain <img> avoids remote image config.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      loading="lazy"
      className={`${size} shrink-0 rounded bg-zinc-100 object-cover dark:bg-zinc-800`}
    />
  ) : (
    <span
      className={`${size} flex shrink-0 items-center justify-center rounded border border-dashed border-zinc-300 text-center text-[10px] text-zinc-400 dark:border-zinc-700 dark:text-zinc-500`}
    >
      No image
    </span>
  );
}

/** Collapsible "New …" panel holding a create form. */
export function CreatePanel({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <details className="mb-4 rounded border border-zinc-200 dark:border-zinc-800">
      <summary className="cursor-pointer px-3 py-2 text-sm font-medium">{label}</summary>
      <div className="border-t border-zinc-200 p-3 dark:border-zinc-800">{children}</div>
    </details>
  );
}

export function FilterLinks({
  options,
  active,
}: {
  options: { label: string; href: string; value: string }[];
  active: string;
}) {
  return (
    <div className="mb-3 flex flex-wrap gap-1" role="group" aria-label="Filter">
      {options.map((o) => (
        <Link
          key={o.value}
          href={o.href}
          aria-current={o.value === active ? "true" : undefined}
          className={`rounded px-2.5 py-1 text-sm ${
            o.value === active
              ? "bg-zinc-200 font-medium text-zinc-900 dark:bg-zinc-800 dark:text-zinc-50"
              : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-900"
          }`}
        >
          {o.label}
        </Link>
      ))}
    </div>
  );
}

/** "Showing 1–50 of 120 terms", or the empty message. */
export function RangeSummary({
  from,
  shown,
  total,
  noun,
  empty,
  suffix,
}: {
  from: number;
  shown: number;
  total: number;
  noun: [singular: string, plural: string];
  empty: string;
  suffix?: string;
}) {
  return (
    <Summary>
      {total === 0
        ? empty
        : shown === 0
          ? "No results on this page."
          : `Showing ${from + 1}–${from + shown} of ${total} ${total === 1 ? noun[0] : noun[1]}${suffix ? ` · ${suffix}` : ""}`}
    </Summary>
  );
}

export function pageCountFor(total: number, pageSize: number) {
  return Math.max(1, Math.ceil(total / pageSize));
}
