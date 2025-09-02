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
  // Pisah kalimat sederhana: titik/koma-akhir/seru/tanya, juga baris baru.
  // Menghindari pemisahan angka/akronim sebisanya.
  const normalized = cleanSpaces(idText);
  const parts = normalized
    .split(/(?<=[\.\?\!])\s+(?=[A-ZÂ-Ź“"])/g) // huruf kapital/petik di awal
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

const MENHUB_TERMS = [
  "menhub",
  "menteri perhubungan",
  "kemenhub",
];

// ===== Scoring =====
function scoreSentence(s: string): QuoteCandidate {
  const text = cleanSpaces(s);
  const t = text.toLowerCase();
  const reason: string[] = [];
  let score = 0;

  // 1) Direct quotes “ ... ” atau " ... "
  const hasFancy = /“[^”]{8,400}”/.test(text);
  const hasAscii = /"[^"]{8,400}"/.test(text);
  if (hasFancy || hasAscii) {
    score += 4;
    reason.push("direct-quotes");
  }

  // 2) Menyebut Menhub/Kemenhub
  if (MENHUB_TERMS.some((k) => t.includes(k))) {
    score += 3;
    reason.push("mentions-menhub");
  }

  // 3) Verba pengucapan
  if (SAY_VERBS.some((v) => t.includes(` ${v} `) || t.startsWith(`${v} `))) {
    score += 2;
    reason.push("speech-verb");
  }

  // 4) Panjang kalimat ideal (ringkas-padat)
  if (clampLen(text, 40, 220)) {
    score += 2;
    reason.push("good-length");
  }

  // 5) Tidak terlalu generik
  if (!/https?:\/\//.test(text) && !/baca juga|lihat juga|foto:/.test(t)) {
    score += 1;
    reason.push("contentful");
  }

  return { text, score, reason };
}

// Ekstrak teks di dalam tanda petik sebagai kandidat kuat
function extractQuotedFragments(text: string): string[] {
  const results: string[] = [];
  const fancy = /“([^”]{8,400})”/g;
  const ascii = /"([^"]{8,400})"/g;

  let m: RegExpExecArray | null;
  while ((m = fancy.exec(text)) !== null) results.push(cleanSpaces(m[1]));
  while ((m = ascii.exec(text)) !== null) results.push(cleanSpaces(m[1]));

  return results;
}

// Fallback atribusi tanpa tanda petik: cari kalimat yg menyebut menhub + verba ucap
function extractAttributedFragments(text: string): string[] {
  const sents = splitSentences(text);
  const out: string[] = [];
  for (const s of sents) {
    const t = s.toLowerCase();
    const mentions = MENHUB_TERMS.some((k) => t.includes(k));
    const says = SAY_VERBS.some((v) => t.includes(` ${v} `) || t.startsWith(`${v} `));
    if (mentions && says && s.length >= 30) {
      out.push(cleanSpaces(s));
    }
  }
  return out;
}

// Public API: buat kandidat lalu pilih terbaik
export function generateQuoteFromArticle(input: {
  title?: string;
  content?: string; // HTML/teks
}): QuoteCandidate | null {
  const raw = `${input.title ? input.title + ". " : ""}${input.content ?? ""}`;
  const text = stripHtmlSimple(raw);
  if (!text) return null;

  const candidates: QuoteCandidate[] = [];

  // 1) Direct-quote fragments
  for (const frag of extractQuotedFragments(text)) {
    const c = scoreSentence(frag);
    c.reason.push("from-direct-fragment");
    candidates.push(c);
  }

  // 2) Attributed sentences (tanpa tanda petik)
  for (const s of extractAttributedFragments(text)) {
    const c = scoreSentence(s);
    c.reason.push("from-attributed-sentence");
    candidates.push(c);
  }

  // 3) Cadangan: kalimat yang mengandung menhub (tanpa verba ucap)
  if (candidates.length === 0) {
    const sents = splitSentences(text);
    for (const s of sents) {
      const t = s.toLowerCase();
      if (MENHUB_TERMS.some((k) => t.includes(k)) && s.length >= 30) {
        const c = scoreSentence(s);
        c.reason.push("fallback-mentions-menhub");
        candidates.push(c);
        break; // ambil satu yang pertama relevan
      }
    }
  }

  if (candidates.length === 0) return null;

  // Pilih skor tertinggi; kalau seri, pilih yang lebih singkat
  candidates.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.text.length - b.text.length;
  });

  const best = candidates[0];
  // Rapikan spasi & potong ekstrim panjang
  const trimmed =
    best.text.length > 280 ? best.text.slice(0, 277).trimEnd() + "…" : best.text;

  return { ...best, text: trimmed };
}
