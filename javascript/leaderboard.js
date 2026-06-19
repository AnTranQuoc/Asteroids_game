import { cloud, getSupabase, cloudSetName } from "./cloud.js";

export function isLeaderboardConfigured() {
  // The world-records board is a public read — it only needs the Supabase
  // client to have loaded, not a signed-in session.
  return !!getSupabase();
}

// Name lives on the server profile (cloud.name); we also cache it locally so it
// shows immediately and can be synced once the cloud is online.
export function getPlayerName() {
  return cloud.name || localStorage.getItem("playerName") || "";
}

// Async; returns { ok, error }. Only caches locally on success so a rejected
// (taken) name isn't kept.
export async function setPlayerName(name) {
  const clean = (name || "").trim().slice(0, 16);
  if (!clean) return { ok: false, error: "empty" };
  const res = await cloudSetName(clean);
  if (res.ok) localStorage.setItem("playerName", clean);
  return res;
}

// Best score per player for one mode (one row per name, highest first).
export async function fetchTopScoresByMode(mode, limit = 8) {
  const supabase = getSupabase();
  if (!supabase) return [];
  try {
    const { data, error } = await supabase.rpc("top_scores", {
      p_mode: mode,
      p_limit: limit,
    });
    return error ? [] : data || [];
  } catch (err) {
    console.warn("Leaderboard fetch failed:", err);
    return [];
  }
}
