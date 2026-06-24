import { getSupabase } from "../cloud/cloud.js";
import { MAX_PLAYERS } from "./config.js";

// Room codes use an unambiguous alphabet (no 0/O/1/I) so they're easy to read
// aloud and type.
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const CODE_LEN = 5;

function randomCode() {
  let out = "";
  const buf = new Uint32Array(CODE_LEN);
  crypto.getRandomValues(buf);
  for (let i = 0; i < CODE_LEN; i++) {
    out += CODE_ALPHABET[buf[i] % CODE_ALPHABET.length];
  }
  return out;
}

function newId() {
  return crypto.randomUUID
    ? crypto.randomUUID()
    : "p-" + Math.random().toString(36).slice(2, 10);
}

export const net = {
  code: null,
  selfId: null,
  isHost: false,
  channel: null,
  roster: [], // [{ id, name, isHost }]
  connected: false,
};

let rosterHandler = null;
const messageHandlers = new Map(); // event -> Set(cb)

export function onRoster(cb) {
  rosterHandler = cb;
  // Fire immediately with whatever roster we already have: the presence 'sync'
  // that first populates net.roster happens during connect, BEFORE callers get
  // a chance to register here, so without this a freshly-joined client would
  // never see the existing members until the next join/leave.
  if (net.roster.length) cb(net.roster);
}

export function onMessage(event, cb) {
  if (!messageHandlers.has(event)) messageHandlers.set(event, new Set());
  messageHandlers.get(event).add(cb);
}

export function offAllMessages() {
  messageHandlers.clear();
  rosterHandler = null;
}

// Broadcasts a payload to everyone else on the channel. `self:false` means the
// sender never receives its own message back.
export function send(event, payload) {
  if (!net.channel) return;
  net.channel.send({ type: "broadcast", event, payload });
}

function rebuildRoster() {
  if (!net.channel) return;
  const state = net.channel.presenceState(); // { presenceKey: [meta, ...] }
  const list = [];
  for (const key of Object.keys(state)) {
    const meta = state[key][0];
    if (!meta) continue;
    list.push({ id: meta.id, name: meta.name, isHost: !!meta.isHost, ship: meta.ship });
  }
  // Stable order: host first, then by join time.
  list.sort((a, b) => (b.isHost ? 1 : 0) - (a.isHost ? 1 : 0));
  net.roster = list;
  if (rosterHandler) rosterHandler(list);
}

// Subscribes to the channel and starts tracking our presence. Resolves once the
// channel is live. `meta` is the presence payload (name, isHost).
function connectChannel(code, meta) {
  const supabase = getSupabase();
  if (!supabase) return Promise.reject(new Error("offline"));

  const channel = supabase.channel(`br:${code}`, {
    config: {
      presence: { key: net.selfId },
      broadcast: { self: false },
    },
  });
  net.channel = channel;
  net.code = code;

  channel.on("presence", { event: "sync" }, rebuildRoster);
  channel.on("presence", { event: "join" }, rebuildRoster);
  channel.on("presence", { event: "leave" }, rebuildRoster);

  // Fan each known broadcast event out to its registered handlers.
  for (const event of ["input", "snapshot", "start", "ended", "drop", "kick"]) {
    channel.on("broadcast", { event }, ({ payload }) => {
      const set = messageHandlers.get(event);
      if (set) for (const cb of set) cb(payload);
    });
  }

  return new Promise((resolve, reject) => {
    let settled = false;
    channel.subscribe(async (status) => {
      if (status === "SUBSCRIBED") {
        await channel.track(meta);
        net.connected = true;
        if (!settled) {
          settled = true;
          resolve();
        }
      } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
        if (!settled) {
          settled = true;
          reject(new Error("connection failed"));
        }
      }
    });
  });
}

// Creates a fresh room and joins it as host.
export async function createRoom(name, ship) {
  net.selfId = newId();
  net.isHost = true;
  const code = randomCode();
  await connectChannel(code, { id: net.selfId, name, isHost: true, ship });
  return code;
}

// Joins an existing room as a client. Rejects if the room is full. (There's a
// small race when two people join a near-full room at once; acceptable for a
// friends-only mode.)
export async function joinRoom(code, name, ship) {
  net.selfId = newId();
  net.isHost = false;
  await connectChannel(code.toUpperCase(), {
    id: net.selfId,
    name,
    isHost: false,
    ship,
  });
  // Give presence a beat to sync so we can see if the room is already full.
  await new Promise((r) => setTimeout(r, 350));
  if (net.roster.length > MAX_PLAYERS) {
    await leaveRoom();
    throw new Error("Room is full");
  }
  if (!net.roster.some((m) => m.isHost)) {
    await leaveRoom();
    throw new Error("Room not found");
  }
}

export async function leaveRoom() {
  offAllMessages();
  if (net.channel) {
    try {
      await net.channel.unsubscribe();
    } catch {
      /* ignore */
    }
  }
  net.channel = null;
  net.code = null;
  net.isHost = false;
  net.roster = [];
  net.connected = false;
}
