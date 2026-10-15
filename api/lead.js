/**
 * POST /api/lead
 * Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */
const EVENTS = new Set([
  "identify",
  "intro_started",
  "intro_completed",
  "lesson_start",
  "progress",
  "milestone",
  "cta_intent",
  "cta_checkout",
]);

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "method_not_allowed" });
  }

  const origin = req.headers.origin;
  const host = req.headers.host;
  if (origin && host) {
    try {
      if (new URL(origin).host !== host) {
        return res.status(403).json({ error: "forbidden" });
      }
    } catch (err) {
      return res.status(403).json({ error: "forbidden" });
    }
  }

  let body;
  try {
    body = readBody(req);
  } catch (err) {
    return res.status(400).json({ error: "invalid_json" });
  }

  const parsed = parseEvent(body);
  if (parsed.error) return res.status(400).json({ error: parsed.error });

  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return res.status(503).json({ error: "capture_unavailable" });
  }

  try {
    if (parsed.event === "identify") {
      const id = await identify(parsed);
      return res.status(200).json({ id: id });
    }

    if (parsed.event === "intro_started" || parsed.event === "intro_completed") {
      await insertEvent(parsed);
      return res.status(200).json({ ok: true });
    }

    const exists = await leadExists(parsed.leadId);
    if (!exists) return res.status(404).json({ error: "unknown_lead" });

    await touchLead(parsed);
    await insertEvent(parsed);
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error("lead_capture", err.status || "", String(err.message || err).slice(0, 300));
    return res.status(502).json({ error: "capture_failed" });
  }
};

function readBody(req) {
  if (!req.body) return {};
  if (typeof req.body === "string") return JSON.parse(req.body);
  return req.body;
}

function parseEvent(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { error: "invalid_body" };
  }
  const event = body.event;
  if (!EVENTS.has(event)) return { error: "invalid_event" };

  const sessionId = typeof body.sessionId === "string" ? body.sessionId.trim() : "";
  if (!UUID_RE.test(sessionId)) return { error: "invalid_session" };

  const leadId = body.leadId ? String(body.leadId) : "";
  if (leadId && !UUID_RE.test(leadId)) return { error: "invalid_lead" };

  const parsed = {
    event: event,
    sessionId: sessionId,
    leadId: leadId,
    videoTime: finite(body.videoTime),
    watchedSeconds: finite(body.watchedSeconds),
    maxSeconds: finite(body.maxSeconds),
    durationSeconds: finite(body.durationSeconds),
    cueId: cueId(body.cueId),
    milestone: milestone(body.milestone),
  };

  if (event === "identify") {
    const name = cleanName(body.name);
    const whatsapp = normalizeWhatsapp(body.whatsapp);
    if (!name) return { error: "invalid_name" };
    if (!whatsapp) return { error: "invalid_whatsapp" };
    if (!leadId) return { error: "invalid_lead" };
    parsed.name = name;
    parsed.whatsapp = whatsapp;
  } else if (event !== "intro_started" && event !== "intro_completed" && !leadId) {
    return { error: "invalid_lead" };
  }

  if ((event === "cta_intent" || event === "cta_checkout") && !parsed.cueId) {
    return { error: "invalid_cue" };
  }
  if (event === "milestone" && !parsed.milestone) return { error: "invalid_milestone" };

  return parsed;
}

async function identify(parsed) {
  const existing = await supabase(
    "leads?whatsapp=eq." + parsed.whatsapp + "&select=id"
  );
  let id = parsed.leadId;
  if (existing && existing.length) {
    id = existing[0].id;
    await supabase("leads?id=eq." + id, {
      method: "PATCH",
      prefer: "return=minimal",
      body: {
        name: parsed.name,
        session_id: parsed.sessionId,
        last_seen_at: new Date().toISOString(),
      },
    });
  } else {
    try {
      await supabase("leads", {
        method: "POST",
        prefer: "return=minimal",
        body: {
          id: id,
          name: parsed.name,
          whatsapp: parsed.whatsapp,
          session_id: parsed.sessionId,
        },
      });
    } catch (err) {
      if (err.status !== 409) throw err;
      const again = await supabase(
        "leads?whatsapp=eq." + parsed.whatsapp + "&select=id"
      );
      if (!again || !again.length) throw err;
      id = again[0].id;
    }
  }

  await supabase(
    "eventos?session_id=eq." + parsed.sessionId + "&lead_id=is.null",
    {
      method: "PATCH",
      prefer: "return=minimal",
      body: { lead_id: id },
    }
  );
  await insertEvent(Object.assign({}, parsed, { leadId: id }));
  return id;
}

async function leadExists(id) {
  const rows = await supabase("leads?id=eq." + id + "&select=id");
  return Boolean(rows && rows.length);
}

async function touchLead(parsed) {
  const rows = await supabase(
    "leads?id=eq." +
      parsed.leadId +
      "&select=watched_seconds,max_seconds,percent,checkout_clicked_at"
  );
  if (!rows || !rows.length) return;
  const current = rows[0];
  const patch = { last_seen_at: new Date().toISOString() };

  if (parsed.watchedSeconds != null) {
    patch.watched_seconds = Math.max(Number(current.watched_seconds) || 0, parsed.watchedSeconds);
  }
  if (parsed.maxSeconds != null) {
    patch.max_seconds = Math.max(Number(current.max_seconds) || 0, parsed.maxSeconds);
  }
  if (parsed.durationSeconds != null) patch.duration_seconds = parsed.durationSeconds;

  const maxSeconds = patch.max_seconds != null ? patch.max_seconds : Number(current.max_seconds) || 0;
  let percent = Number(current.percent) || 0;
  if (parsed.durationSeconds) {
    percent = Math.max(percent, Math.min(100, (maxSeconds / parsed.durationSeconds) * 100));
  }
  if (parsed.milestone) percent = Math.max(percent, parsed.milestone);
  if (parsed.durationSeconds || parsed.milestone) {
    patch.percent = Math.round(percent * 10) / 10;
  }
  if (parsed.event === "cta_checkout" && !current.checkout_clicked_at) {
    patch.checkout_clicked_at = new Date().toISOString();
  }

  await supabase("leads?id=eq." + parsed.leadId, {
    method: "PATCH",
    prefer: "return=minimal",
    body: patch,
  });
}

async function insertEvent(parsed) {
  await supabase("eventos", {
    method: "POST",
    prefer: "return=minimal",
    body: {
      lead_id: parsed.leadId || null,
      session_id: parsed.sessionId,
      type: parsed.event,
      video_time: parsed.videoTime,
      payload: compact({
        cueId: parsed.cueId,
        milestone: parsed.milestone,
        watchedSeconds: parsed.watchedSeconds,
        maxSeconds: parsed.maxSeconds,
        durationSeconds: parsed.durationSeconds,
      }),
    },
  });
}

async function supabase(path, options) {
  const opts = options || {};
  const base = process.env.SUPABASE_URL.replace(/\/$/, "");
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const response = await fetch(base + "/rest/v1/" + path, {
    method: opts.method || "GET",
    headers: {
      apikey: key,
      Authorization: "Bearer " + key,
      "Content-Type": "application/json",
      Prefer: opts.prefer || "return=representation",
    },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });

  const text = await response.text();
  if (!response.ok) {
    const error = new Error(text.slice(0, 300) || "supabase_error");
    error.status = response.status;
    throw error;
  }
  if (!text) return [];
  try {
    return JSON.parse(text);
  } catch (err) {
    return [];
  }
}

function compact(obj) {
  const out = {};
  Object.keys(obj).forEach(function (key) {
    if (obj[key] != null && obj[key] !== "") out[key] = obj[key];
  });
  return out;
}

function finite(value) {
  if (value == null || value === "") return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0 || n > 14400) return null;
  return Math.round(n * 10) / 10;
}

function milestone(value) {
  const n = Number(value);
  return n === 25 || n === 50 || n === 75 || n === 100 ? n : null;
}

function cueId(value) {
  if (typeof value !== "string") return null;
  const id = value.trim();
  if (!/^[a-z0-9_-]{1,40}$/i.test(id)) return null;
  return id;
}

function cleanName(raw) {
  const name = String(raw || "").replace(/\s+/g, " ").trim();
  if (name.length < 2 || name.length > 80) return "";
  return name;
}

function normalizeWhatsapp(raw) {
  let digits = String(raw || "").replace(/\D/g, "");
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (!(digits.startsWith("55") && digits.length >= 12)) {
    if (digits.length === 10 || digits.length === 11) digits = "55" + digits;
  }
  if (!/^55[1-9]{2}\d{8,9}$/.test(digits)) return "";
  return digits;
}
