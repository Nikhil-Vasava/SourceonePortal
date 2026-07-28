// Mistral document extraction — the fallback provider for packing slips.
// Set MISTRAL_API_KEY in .env (keys at https://console.mistral.ai/api-keys).

const CHAT_URL = "https://api.mistral.ai/v1/chat/completions";
const OCR_URL = "https://api.mistral.ai/v1/ocr";

const VISION_MODEL = process.env.MISTRAL_MODEL || "pixtral-12b-2409";
const OCR_MODEL = process.env.MISTRAL_OCR_MODEL || "mistral-ocr-latest";
const TEXT_MODEL = process.env.MISTRAL_TEXT_MODEL || "mistral-small-latest";

export function hasMistralKey() {
  const k = process.env.MISTRAL_API_KEY;
  return Boolean(k && k.trim() && !k.includes("your-key-here"));
}

const IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/webp", "image/gif"]);

async function post(url, body) {
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.MISTRAL_API_KEY}`,
    },
    body: JSON.stringify(body),
  });
  return { ok: res.ok, status: res.status, body: await res.text() };
}

function failure(status, raw) {
  let msg = raw;
  try { msg = JSON.parse(raw).message || JSON.parse(raw).error?.message || raw; } catch {}
  if (status === 401) return "Mistral rejected the API key. Check MISTRAL_API_KEY in .env.";
  if (status === 429) return "Mistral rate limit reached. Wait a moment and try again.";
  return `Mistral API error (${status}): ${String(msg).slice(0, 200)}`;
}

/** Pulls a JSON object out of a model reply that may be fenced or padded with prose. */
function parseJsonReply(text) {
  const cleaned = String(text || "").replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  try { return JSON.parse(cleaned); } catch {}
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start >= 0 && end > start) {
    try { return JSON.parse(cleaned.slice(start, end + 1)); } catch {}
  }
  throw new Error("Mistral returned data that could not be read as JSON.");
}

/** Runs Mistral's OCR endpoint and returns the document as markdown text. */
async function ocrToText(base64, mimeType) {
  const isImage = IMAGE_TYPES.has(mimeType);
  const document = isImage
    ? { type: "image_url", image_url: `data:${mimeType};base64,${base64}` }
    : { type: "document_url", document_url: `data:application/pdf;base64,${base64}` };

  const res = await post(OCR_URL, { model: OCR_MODEL, document });
  if (!res.ok) throw new Error(failure(res.status, res.body));

  const json = JSON.parse(res.body);
  const text = (json.pages || []).map(p => p.markdown || p.text || "").join("\n\n").trim();
  if (!text) throw new Error("Mistral OCR found no text in this document.");
  return text;
}

/**
 * Extracts structured data from a document.
 * Images go straight to the vision model; PDFs are OCR'd first, then read as text.
 */
export async function extractWithMistral({ prompt, schemaHint, base64, mimeType }) {
  if (!hasMistralKey()) throw new Error("MISTRAL_API_KEY is not set.");

  const instruction = `${prompt}\n\nReturn ONLY valid JSON matching this shape:\n${schemaHint}`;
  let body;

  if (IMAGE_TYPES.has(mimeType)) {
    body = {
      model: VISION_MODEL,
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [{
        role: "user",
        content: [
          { type: "text", text: instruction },
          { type: "image_url", image_url: `data:${mimeType};base64,${base64}` },
        ],
      }],
    };
  } else {
    // PDFs and Word files: OCR to text, then extract from that text.
    const text = await ocrToText(base64, mimeType);
    body = {
      model: TEXT_MODEL,
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [{
        role: "user",
        content: `${instruction}\n\n--- DOCUMENT ---\n${text.slice(0, 20000)}`,
      }],
    };
  }

  const res = await post(CHAT_URL, body);
  if (!res.ok) throw new Error(failure(res.status, res.body));

  const json = JSON.parse(res.body);
  const reply = json.choices?.[0]?.message?.content;
  if (!reply) throw new Error("Mistral returned an empty response.");
  return parseJsonReply(reply);
}
