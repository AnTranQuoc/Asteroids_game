import { cloud, getSupabase, cloudSetName } from "./cloud.js";

export function isLeaderboardConfigured() {
  return cloud.online && !!getSupabase();
}

// Name lives on the server profile (cloud.name); we also cache it locally so it
// shows immediately and can be synced once the cloud is online.
export function getPlayerName() {
  return cloud.name || localStorage.getItem("playerName") || "";
}

export function setPlayerName(name) {
  const clean = (name || "").trim().slice(0, 16) || "Unknown";
  localStorage.setItem("playerName", clean);
  return cloudSetName(clean); // async; updates cloud.name on success
}

// Top runs for one difficulty mode (highest first). Returns [] on any failure.
export async function fetchTopScoresByMode(mode, limit = 8) {
  const supabase = getSupabase();
  if (!supabase) return [];
  try {
    const { data, error } = await supabase
      .from("scores")
      .select("name,score")
      .eq("mode", mode)
      .order("score", { ascending: false })
      .limit(limit);
    return error ? [] : data || [];
  } catch (err) {
    console.warn("Leaderboard fetch failed:", err);
    return [];
  }
}
