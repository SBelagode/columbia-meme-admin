import { Suspense } from "react";
import { requireSuperadmin } from "@/lib/auth";
import {
  CONTROVERSY_MIN_VOTES,
  loadDashboardStats,
  type DashboardStats,
} from "@/lib/admin/dashboard";
import { DASHBOARD_TIME_ZONE } from "@/lib/admin/dates";
import PageHeader from "@/components/admin/PageHeader";
import StatTile from "@/components/admin/dashboard/StatTile";
import UpvoteMeter from "@/components/admin/dashboard/UpvoteMeter";
import ActivityChart from "@/components/admin/dashboard/ActivityChart";
import SpotlightCard from "@/components/admin/dashboard/SpotlightCard";

const nf = new Intl.NumberFormat("en-US");

async function Dashboard() {
  const { supabase } = await requireSuperadmin();

  let stats: DashboardStats;
  try {
    stats = await loadDashboardStats(supabase, new Date());
  } catch (error) {
    console.error("[admin/dashboard]", error);
    return (
      <p className="rounded border border-red-300 p-4 text-sm text-red-700 dark:border-red-900 dark:text-red-400">
        Could not load dashboard data. Please try again.
      </p>
    );
  }

  const { totals, today } = stats;
  const avgVotes =
    totals.generations > 0 ? (totals.votes / totals.generations).toFixed(1) : "—";

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
        <StatTile label="Profiles" value={nf.format(totals.profiles)} />
        <StatTile label="Generations" value={nf.format(totals.generations)} />
        <StatTile label="Votes" value={nf.format(totals.votes)} />
        <StatTile label="Votes per generation" value={avgVotes} detail="Average" />
        <StatTile label="Generations today" value={nf.format(today.generations)} />
        <StatTile label="Votes today" value={nf.format(today.votes)} />
      </div>

      <div className="grid gap-3 lg:grid-cols-3">
        <UpvoteMeter upvotes={stats.upvotes} downvotes={stats.downvotes} />
        <ActivityChart
          title="Generations, last 7 days"
          unit="generations"
          data={stats.activity.map((d) => ({ day: d.day, value: d.generations }))}
        />
        <ActivityChart
          title="Votes, last 7 days"
          unit="votes"
          data={stats.activity.map((d) => ({ day: d.day, value: d.votes }))}
        />
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <SpotlightCard
          title="Highest-scoring generation"
          description="Most net votes (upvotes minus downvotes)."
          generation={stats.highestScoring}
          emptyMessage="No votes yet."
        />
        <SpotlightCard
          title="Most controversial generation"
          description={`At least ${CONTROVERSY_MIN_VOTES} votes, ranked by volume and how evenly they split.`}
          generation={stats.mostControversial}
          emptyMessage={`No generation has ${CONTROVERSY_MIN_VOTES}+ votes with both upvotes and downvotes yet.`}
        />
      </div>

      <p className="text-xs text-zinc-500 dark:text-zinc-400">
        Days are in {DASHBOARD_TIME_ZONE.replace("_", " ")} time.
        {stats.truncated &&
          " Some statistics are based on the first 100,000 rows only."}
      </p>
    </div>
  );
}

export default function AdminPage() {
  return (
    <>
      <PageHeader title="Dashboard" description="Overview of app activity." />
      <Suspense fallback={<p className="text-sm text-zinc-500">Loading…</p>}>
        <Dashboard />
      </Suspense>
    </>
  );
}
