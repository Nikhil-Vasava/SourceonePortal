// Packing-slip extraction via Google Gemini.
// Bookings and purchase orders use the built-in parsers in pdf-text.js /
// booking-parsers.js / po-parser.js — no AI, no quotas.
// Set GEMINI_API_KEY in .env (get one free at https://aistudio.google.com/apikey).

const MODEL = process.env.GEMINI_MODEL || "gemini-2.0-flash";

// If the primary model is rate-limited we retry on these, which have their own quotas.
const FALLBACKS = (process.env.GEMINI_FALLBACK_MODELS ??
  "gemini-2.0-flash-lite,gemini-2.5-flash,gemini-1.5-flash")
  .split(",").map(s => s.trim()).filter(Boolean);

const MODEL_CHAIN = [MODEL, ...FALLBACKS.filter(m => m !== MODEL)];

const ENDPOINT = (model) =>
  `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

export function hasGeminiKey() {
  const k = process.env.GEMINI_API_KEY;
  return Boolean(k && k.trim() && !k.includes("your-key-here"));
}

const MIME = {
  pdf: "application/pdf",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  heic: "image/heic",
  txt: "text/plain",
  // .docx is converted to text in docx-text.js before it gets here; Gemini
  // rejects Word MIME types outright. .doc isn't supported at all.
};

export function mimeFor(fileName = "") {
  const ext = fileName.split(".").pop().toLowerCase();
  return MIME[ext] || "application/octet-stream";
}

/** Pulls the retry hint and quota type out of a 429 body. */
function readQuotaError(body) {
  let err = {};
  try { err = JSON.parse(body).error || {}; } catch {}
  const details = err.details || [];

  const retryInfo = details.find(d => String(d["@type"]).includes("RetryInfo"));
  const seconds = retryInfo?.retryDelay ? parseFloat(String(retryInfo.retryDelay).replace("s", "")) : null;

  const failure = details.find(d => String(d["@type"]).includes("QuotaFailure"));
  const violation = failure?.violations?.[0];
  const metric = violation?.quotaId || violation?.quotaMetric || "";
  const perDay = /perday|per_day|daily/i.test(metric);

  return { message: err.message || body, retrySeconds: seconds, perDay, metric };
}

/** One HTTP attempt against a specific model. */
async function callModel(model, parts) {
  const res = await fetch(`${ENDPOINT(model)}?key=${encodeURIComponent(process.env.GEMINI_API_KEY)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts }],
      generationConfig: { temperature: 0, responseMimeType: "application/json" },
    }),
  });
  return { ok: res.ok, status: res.status, body: await res.text() };
}

const MAX_WAIT_MS = 25000; // keep the whole request inside a sensible page timeout

/**
 * Sends a file + prompt and expects JSON back.
 * On a 429 it waits the delay Google asks for and retries, then falls back to
 * other models, which carry separate quotas.
 */
async function callGemini({ prompt, base64, mimeType, schemaHint }) {
  if (!hasGeminiKey()) {
    throw new Error("GEMINI_API_KEY is not set. Add it to .env, then restart the server.");
  }

  const parts = [{ text: prompt + "\n\nReturn ONLY valid JSON matching this shape:\n" + schemaHint }];
  if (base64) parts.push({ inline_data: { mime_type: mimeType, data: base64 } });

  let waited = 0;
  let lastQuota = null;
  let lastError = null;

  for (const model of MODEL_CHAIN) {
    // up to two attempts per model: the first 429 is often a per-minute burst
    for (let attempt = 0; attempt < 2; attempt++) {
      let res;
      try {
        res = await callModel(model, parts);
      } catch (e) {
        lastError = `Could not reach Gemini: ${e.message}`;
        break; // network problem — trying another model won't help
      }

      if (res.ok) return parseGeminiJson(res.body);

      if (res.status === 429) {
        const q = readQuotaError(res.body);
        lastQuota = q;

        // A daily cap won't clear by waiting — move straight to the next model.
        if (q.perDay) break;

        const waitMs = Math.min((q.retrySeconds ? q.retrySeconds + 1 : 6 + attempt * 6) * 1000, 15000);
        if (attempt === 0 && waited + waitMs <= MAX_WAIT_MS) {
          waited += waitMs;
          await sleep(waitMs);
          continue; // retry the same model
        }
        break; // out of patience for this model — try the next one
      }

      // Any other error (bad key, unreadable file, model not found) — report it.
      let msg = res.body;
      try { msg = JSON.parse(res.body).error?.message || res.body; } catch {}
      if (res.status === 404 || /not found|not supported/i.test(msg)) {
        lastError = `Gemini API error (${res.status}): ${String(msg).slice(0, 200)}`;
        break; // this model doesn't exist for the key — try the next
      }
      throw new Error(`Gemini API error (${res.status}): ${String(msg).slice(0, 300)}`);
    }
  }

  if (lastQuota) {
    const tried = MODEL_CHAIN.join(", ");
    const when = lastQuota.perDay
      ? "This looks like a DAILY limit, which resets around midnight Pacific time."
      : lastQuota.retrySeconds
        ? `Try again in about ${Math.ceil(lastQuota.retrySeconds)} seconds.`
        : "Wait a minute and try again.";
    throw new Error(
      `Gemini quota exceeded. ${when} ` +
      `Already retried automatically on: ${tried}. ` +
      `Free keys allow only a few requests per minute and a limited number per day — importing several files at once uses one request each. ` +
      `You can enable billing at aistudio.google.com, use a different key, or enter this document manually for now.`
    );
  }

  throw new Error(lastError || "Gemini request failed.");
}

/** Pulls the JSON payload out of a successful response. */
function parseGeminiJson(raw) {
  let json;
  try { json = JSON.parse(raw); } catch { throw new Error("Gemini returned a non-JSON response."); }
  const text = json.candidates?.[0]?.content?.parts?.map(p => p.text).join("") || "";
  if (!text) throw new Error("Gemini returned an empty response — the document may be unreadable.");

  const cleaned = text.replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  try { return JSON.parse(cleaned); }
  catch { throw new Error("Could not parse extracted data: " + cleaned.slice(0, 200)); }
}


/**
 * Runs a prompt + document through Gemini and returns the parsed JSON.
 * The schema and prompt live in extract.js so both providers stay in step.
 */
export async function extractPackingSlipRaw({ prompt, schemaHint, base64, mimeType }) {
  return callGemini({ prompt, base64, mimeType, schemaHint });
}

/** Convert a browser File (from a form action) to base64. */
export async function fileToBase64(file) {
  const buf = Buffer.from(await file.arrayBuffer());
  return buf.toString("base64");
}
