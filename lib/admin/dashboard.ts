import type { SupabaseClient } from "@supabase/supabase-js";
import { dayKey, lastDayKeys, startOfDay } from "@/lib/admin/dates";

// All queries run with the signed-in superadmin's JWT through the server
// client, so RLS still decides what is visible.

const PAGE_SIZE = 1000; // PostgREST's default max rows per request.
const MAX_ROWS = 100_000; // Safety cap for in-memory aggregation.
const ACTIVITY_DAYS = 7;

/** Minimum votes before a generation can be called controversial. */
export const CONTROVERSY_MIN_VOTES = 5;

type VoteRow = { generation_id: number; vote_value: number; created_at: string };
type GenerationRow = { created_at: string };

export type GenerationSpotlight = {
  generatedText: string | null;
  imageUrl: string | null;
  createdAt: string;
  creatorName: string | null;
  upvotes: number;
  downvotes: number;
  score: number;
};

export type DashboardStats = {
  totals: { profiles: number; generations: number; votes: number };
  upvotes: number;
  downvotes: number;
  today: { generations: number; votes: number };
  activity: { day: string; generations: number; votes: number }[];
  highestScoring: GenerationSpotlight | null;
  mostControversial: GenerationSpotlight | null;
  truncated: boolean;
};

async function exactCount(
  supabase: SupabaseClient,
  table: "profiles" | "generations" | "votes",
): Promise<number> {
  const { count, error } = await supabase
    .from(table)
    .select("*", { count: "exact", head: true });
  if (error) throw new Error(`${table} count failed: ${error.message}`);
  return count ?? 0;
}

/** Pages through a query until exhausted (or MAX_ROWS). */
async function fetchAll<T>(
  label: string,
  page: (from: number, to: number) => PromiseLike<{
    data: T[] | null;
    error: { message: string } | null;
  }>,
): Promise<{ rows: T[]; truncated: boolean }> {
  const rows: T[] = [];
  for (let from = 0; from < MAX_ROWS; from += PAGE_SIZE) {
    const { data, error } = await page(from, from + PAGE_SIZE - 1);
    if (error) throw new Error(`${label} query failed: ${error.message}`);
    rows.push(...(data ?? []));
    if (!data || data.length < PAGE_SIZE) return { rows, truncated: false };
  }
  return { rows, truncated: true };
}

type Tally = { up: number; down: number };

function score({ up, down }: Tally) {
  return up - down;
}

// Reddit-style controversy: lots of votes, split close to evenly.
// magnitude ** balance rewards both volume and a balanced split.
function controversy({ up, down }: Tally) {
  if (up === 0 || down === 0) return 0;
  return (up + down) ** (Math.min(up, down) / Math.max(up, down));
}

function pickBest(
  tallies: Map<number, Tally>,
  metric: (t: Tally) => number,
  eligible: (t: Tally) => boolean,
): number | null {
  let bestId: number | null = null;
  let best: { value: number; total: number } | null = null;
  for (const [id, tally] of tallies) {
    if (!eligible(tally)) continue;
    const value = metric(tally);
    const total = tally.up + tally.down;
    if (!best || value > best.value || (value === best.value && total > best.total)) {
      bestId = id;
      best = { value, total };
    }
  }
  return bestId;
}

async function loadSpotlights(
  supabase: SupabaseClient,
  ids: number[],
  tallies: Map<number, Tally>,
): Promise<Map<number, GenerationSpotlight>> {
  const result = new Map<number, GenerationSpotlight>();
  if (ids.length === 0) return result;

  const { data: generations, error } = await supabase
    .from("generations")
    .select("id, generated_text, source_image_url, created_at, user_id")
    .in("id", ids);
  if (error) throw new Error(`generation lookup failed: ${error.message}`);

  const userIds = [...new Set((generations ?? []).map((g) => g.user_id))];
  const { data: profiles, error: profileError } = await supabase
    .from("profiles")
    .select("id, first_name, last_name")
    .in("id", userIds);
  if (profileError) throw new Error(`profile lookup failed: ${profileError.message}`);

  const names = new Map(
    (profiles ?? []).map((p) => [
      p.id,
      [p.first_name, p.last_name].filter(Boolean).join(" ").trim() || null,
    ]),
  );

  for (const g of generations ?? []) {
    const tally = tallies.get(g.id) ?? { up: 0, down: 0 };
    result.set(g.id, {
      generatedText: g.generated_text,
      imageUrl: g.source_image_url,
      createdAt: g.created_at,
      creatorName: names.get(g.user_id) ?? null,
      upvotes: tally.up,
      downvotes: tally.down,
      score: score(tally),
    });
  }
  return result;
}

export async function loadDashboardStats(
  supabase: SupabaseClient,
  now: Date,
): Promise<DashboardStats> {
  const days = lastDayKeys(now, ACTIVITY_DAYS);
  const windowStart = startOfDay(days[0]).toISOString();

  const [profiles, generations, votes, voteRows, recentGenerations] =
    await Promise.all([
      exactCount(supabase, "profiles"),
      exactCount(supabase, "generations"),
      exactCount(supabase, "votes"),
      fetchAll<VoteRow>("votes", (from, to) =>
        supabase
          .from("votes")
          .select("generation_id, vote_value, created_at")
          .order("id")
          .range(from, to),
      ),
      fetchAll<GenerationRow>("generations", (from, to) =>
        supabase
          .from("generations")
          .select("created_at")
          .gte("created_at", windowStart)
          .order("id")
          .range(from, to),
      ),
    ]);

  const tallies = new Map<number, Tally>();
  const votesByDay = new Map<string, number>();
  let upvotes = 0;
  let downvotes = 0;

  for (const v of voteRows.rows) {
    const tally = tallies.get(v.generation_id) ?? { up: 0, down: 0 };
    if (v.vote_value > 0) {
      tally.up++;
      upvotes++;
    } else if (v.vote_value < 0) {
      tally.down++;
      downvotes++;
    }
    tallies.set(v.generation_id, tally);

    const key = dayKey(new Date(v.created_at));
    votesByDay.set(key, (votesByDay.get(key) ?? 0) + 1);
  }

  const generationsByDay = new Map<string, number>();
  for (const g of recentGenerations.rows) {
    const key = dayKey(new Date(g.created_at));
    generationsByDay.set(key, (generationsByDay.get(key) ?? 0) + 1);
  }

  const activity = days.map((day) => ({
    day,
    generations: generationsByDay.get(day) ?? 0,
    votes: votesByDay.get(day) ?? 0,
  }));
  const todayKey = days[days.length - 1];

  const topId = pickBest(tallies, score, (t) => t.up + t.down > 0);
  const controversialId = pickBest(
    tallies,
    controversy,
    (t) => t.up + t.down >= CONTROVERSY_MIN_VOTES && t.up > 0 && t.down > 0,
  );

  const spotlights = await loadSpotlights(
    supabase,
    [...new Set([topId, controversialId].filter((id): id is number => id !== null))],
    tallies,
  );

  return {
    totals: { profiles, generations, votes },
    upvotes,
    downvotes,
    today: {
      generations: generationsByDay.get(todayKey) ?? 0,
      votes: votesByDay.get(todayKey) ?? 0,
    },
    activity,
    highestScoring: topId ? (spotlights.get(topId) ?? null) : null,
    mostControversial: controversialId
      ? (spotlights.get(controversialId) ?? null)
      : null,
    truncated: voteRows.truncated || recentGenerations.truncated,
  };
}
