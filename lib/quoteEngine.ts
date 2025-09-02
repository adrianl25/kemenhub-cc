// lib/quoteEngine.ts
// Heuristik ekstraksi kutipan Bahasa Indonesia (tanpa dependensi)

// ===== Types =====
export type QuoteCandidate = {
  text: string;
  score: number;
  reason: string[];
};

// ===== Utilities =====
function cleanSpaces(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

function stripHtmlSimple(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function splitSentences(idText: string): string[] {
  const normalized = cleanSpaces(idText);
  const parts = normalized
    .split(/(?<=[\.\?\!])\s+(?=[A-ZÂ-Ź“"])/g)
    .map((x) => x.trim())
    .filter((x) => x.length > 0);
  return parts.length > 0 ? parts : [normalized];
}

function clampLen(s: string, min = 30, max = 260): boolean {
  const n = s.length;
  return n >= min && n <= max;
}

// ===== Rules =====
const SAY_VERBS = [
  "kata",
  "mengatakan",
  "ujar",
  "tutur",
  "jelas",
  "menjelaskan",
  "sebut",
  "menyebut",
  "imbuh",
  "tegas",
  "menegaskan",
  "ungkap",
  "mengungkap",
  "papar",
  "menyampaikan",
  "lanjut",
  "menambahkan",
];

const MENHUB_TERMS = ["menhub", "menteri perhubungan", "kemenhub"];

// ===== Scoring =====
function scoreSentence(s: string): QuoteCandidate {
  const text = cleanSpaces(s);
  const t = text.toLowerCase();
  const reason: string[] = [];
  let score = 0;

  const hasFancy = /“[^”]{8,400}”/.test(text);
  const hasAscii = /"[^"]{8,400}"/.test(text);
  if (hasFancy || hasAscii) {
    score += 4;
    reason.push("direct-quotes");
  }

  if (MENHUB_TERMS.some((k) => t.includes(k))) {
    score += 3;
    reason.push("mentions-menhub");
  }

  if (SAY_VERBS.some((v) => t.includes(` ${v} `) || t.startsWith(`${v} `))) {
    score += 2;
    reason.push("speech-verb");
  }

  if (clampLen(text, 40, 220)) {
    score += 2;
    reason.push("good-length");
  }

  if (!/https?:\/\//.test(text) && !/baca juga|lihat juga|foto:/.test(t)) {
    score += 1;
    reason.push("contentful");
  }

  return { text, score, reason };
}

function extractQuotedFragments(text: string): string[] {
  const results: string[] = [];
  const fancy = /“([^”]{8,400})”/g;
  const ascii = /"([^"]{8,400})"/g;

  let m: RegExpExecArray | null;
  while ((m = fancy.exec(text)) !== null) results.push(cleanSpaces(m[1]));
  while ((m = ascii.exec(text)) !== null) results.push(cleanSpaces(m[1]));

  return results;
}

function extractAttributedFragments(text: string): string[] {
  const sents = splitSentences(text);
  const out: string[] = [];
  for (const s of sents) {
    const t = s.toLowerCase();
    const mentions = MENHUB_TERMS.some((k) => t.includes(k));
    const says = SAY_VERBS.some((v) => t.includes(` ${v} `) || t.startsWith(`${v} `));
    if (mentions && says && s.length >= 30) out.push(cleanSpaces(s));
  }
  return out;
}

export function generateQuoteFromArticle(input: {
  title?: string;
  content?: string;
}): QuoteCandidate | null {
  const raw = `${input.title ? input.title + ". " : ""}${input.content ?? ""}`;
  const text = stripHtmlSimple(raw);
  if (!text) return null;

  const candidates: QuoteCandidate[] = [];

  for (const frag of extractQuotedFragments(text)) {
    const c = scoreSentence(frag);
    c.reason.push("from-direct-fragment");
    candidates.push(c);
  }

  for (const s of extractAttributedFragments(text)) {
    const c = scoreSentence(s);
    c.reason.push("from-attributed-sentence");
    candidates.push(c);
  }

  if (candidates.length === 0) {
    const sents = splitSentences(text);
    for (const s of sents) {
      const t = s.toLowerCase();
      if (MENHUB_TERMS.some((k) => t.includes(k)) && s.length >= 30) {
        const c = scoreSentence(s);
        c.reason.push("fallback-mentions-menhub");
        candidates.push(c);
        break;
      }
    }
  }

  if (candidates.length === 0) return null;

  candidates.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.text.length - b.text.length;
    });

  const best = candidates[0];
  const trimmed =
    best.text.length > 280 ? best.text.slice(0, 277).trimEnd() + "…" : best.text;

  return { ...best, text: trimmed };
}
