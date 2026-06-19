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

// Signs in anonymously (creating a persistent identity in this browser) and
// loads the player's profile. Falls back to offline defaults on any failure.
export async function initCloud() {
  try {
    const { createClient } = await import(
      "https://esm.sh/@supabase/supabase-js@2"
    );
    supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) {
      const { error } = await supabase.auth.signInAnonymously();
      if (error) throw error;
    }

    const { data, error } = await supabase.from("profiles").select("*").single();
    if (error) throw error;
    applyProfile(data);
    cloud.online = true;

    // If a name was chosen locally (e.g. on the name screen before sign-in
    // finished), push it to the server so the profile matches.
    const localName = localStorage.getItem("playerName");
    if (localName && cloud.name !== localName) {
      await cloudSetName(localName);
    }
  } catch (err) {
    console.warn("Cloud unavailable, running offline:", err);
    cloud.online = false;
  } finally {
    cloud.ready = true;
  }
}

// Buys (or, if already owned, equips) a skin. Server validates price + funds.
export async function cloudPurchaseSkin(category, id) {
  if (!cloud.online) return false;
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
  if (!cloud.online || score <= 0) return;
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
  if (!cloud.online) return { ok: false, error: "offline" };
  const { data, error } = await supabase.rpc("set_player_name", { p_name: name });
  if (error) {
    console.warn("set_player_name failed:", error.message);
    return { ok: false, error: error.message || "error" };
  }
  applyProfile(data);
  return { ok: true };
}
