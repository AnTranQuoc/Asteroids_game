// ===========================================================================
// CLOUD STATE (Supabase, server-authoritative)
// ---------------------------------------------------------------------------
// All money / skins / best-scores live in the database. The client can only
// REQUEST actions via server-side functions (purchase_skin, submit_run, ...);
// it can never write money or ownership directly (blocked by RLS). This object
// is just a local READ-ONLY mirror the render code can read each frame.
// ===========================================================================
const SUPABASE_URL = "https://btvqxstbxhfaudppstwt.supabase.co";
const SUPABASE_KEY = "sb_publishable_KjdUWR5q07g0SlPCm6IvXQ_9Bvk8Rc3";

let supabase = null;

export const cloud = {
  ready: false, // initCloud() has finished (success or failure)
  online: false, // authenticated + profile loaded
  money: 0,
  owned: { ship: ["classic"], gun: ["standard"] },
  selected: { ship: "classic", gun: "standard" },
  bestScores: {},
  name: "",
};

export function getSupabase() {
  return supabase;
}

function applyProfile(row) {
  const p = Array.isArray(row) ? row[0] : row;
  if (!p) return;
  cloud.money = p.money ?? 0;
  if (p.owned_skins) cloud.owned = p.owned_skins;
  if (p.selected_skins) cloud.selected = p.selected_skins;
  cloud.bestScores = p.best_scores ?? {};
  cloud.name = p.name ?? "";
}

// Loads the Supabase client and restores an EXISTING session if the player
// already has one. Does NOT create an account — that happens lazily on the
// first real action (see ensureSignedIn) so mere visitors don't fill the DB
// with empty profiles.
export async function initCloud() {
  try {
    const { createClient } = await import(
      "https://esm.sh/@supabase/supabase-js@2"
    );
    supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (session) {
      // Returning player: load their saved profile.
      await loadProfile();
      cloud.online = true;
      await syncLocalName();
    }
    // No session => no account yet. The leaderboard still reads publicly.
  } catch (err) {
    console.warn("Cloud unavailable, running offline:", err);
  } finally {
    cloud.ready = true;
  }
}

async function loadProfile() {
  const { data, error } = await supabase.from("profiles").select("*").single();
  if (error) throw error;
  applyProfile(data);
}

// Pushes a locally-chosen name to the server if it isn't there yet.
async function syncLocalName() {
  const localName = localStorage.getItem("playerName");
  if (localName && cloud.name !== localName) {
    await cloudSetName(localName);
  }
}

// Creates the anonymous account on demand — only when the player actually does
// something worth saving. Returns true once signed in with a profile loaded.
async function ensureSignedIn() {
  if (!supabase) return false;
  if (cloud.online) return true;
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) {
      const { error } = await supabase.auth.signInAnonymously();
      if (error) throw error;
    }
    await loadProfile();
    cloud.online = true;
    return true;
  } catch (err) {
    console.warn("Sign-in failed:", err);
    return false;
  }
}

// Buys (or, if already owned, equips) a skin. Server validates price + funds.
export async function cloudPurchaseSkin(category, id) {
  if (!(await ensureSignedIn())) return false;
  const { data, error } = await supabase.rpc("purchase_skin", {
    p_category: category,
    p_skin_id: id,
  });
  if (error) {
    console.warn("purchase_skin failed:", error.message);
    return false;
  }
  applyProfile(data);
  return true;
}

// Submits a finished run. Server grants the money and updates the best score.
export async function cloudSubmitRun(score, mode) {
  if (score <= 0) return;
  if (!(await ensureSignedIn())) return;
  const { data, error } = await supabase.rpc("submit_run", {
    p_score: Math.floor(score),
    p_mode: mode,
  });
  if (error) {
    console.warn("submit_run failed:", error.message);
    return;
  }
  applyProfile(data);
}

// Returns { ok: true } or { ok: false, error: "<message>" } so the UI can tell
// the player when a name is already taken.
export async function cloudSetName(name) {
  if (!(await ensureSignedIn())) return { ok: false, error: "offline" };
  const { data, error } = await supabase.rpc("set_player_name", { p_name: name });
  if (error) {
    console.warn("set_player_name failed:", error.message);
    return { ok: false, error: error.message || "error" };
  }
  applyProfile(data);
  return { ok: true };
}
