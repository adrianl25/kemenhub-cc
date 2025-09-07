// app/quoteEngine.ts
// ASCII-only; no external deps.
// Membuat kutipan dari item berita (jika ada tanda kutip), atau fallback ringkasan bergaya kutipan.

export type NewsItem = {
  id: string;
  title: string;
  source: string;
  publishedAt: string; // ISO
  link: string;
  summary?: string;
  entities?: string[];
};

export type QuoteItem = {
  id: string;
  text: string;
  speaker: string;
  date: string; // ISO
  context?: string;
  link: string;
  tags?: string[];
};

// Cari frasa di antara tanda kutip
function extractQuoted(sentence: string): string | null {
  const s = sentence || "";
  const rx = /"([^"]{12,280})"/g; // panjang aman
  const m = rx.exec(s);
  if (m && m[1]) return m[1].trim();
  return null;
}

// Heuristik sederhana untuk mendeteksi konteks/speaker
function inferSpeaker(source: string): string {
  const low = (source || "").toLowerCase();
  if (low.includes("kemenhub")) return "Kementerian Perhubungan";
  if (low.includes("antara")) return "ANTARA";
  if (low.includes("kompas")) return "Kompas";
  if (low.includes("tempo")) return "Tempo";
  return "Narasumber";
}

const MENHUB_NAME = "Dudy Purwagandhi";

export function generateQuotesFromNews(newsList: NewsItem[]): QuoteItem[] {
  const out: QuoteItem[] = [];
  const nowISO = new Date().toISOString();

  for (const n of newsList) {
    const joined = [n.title, n.summary].filter(Boolean).join(". ");
    const direct = extractQuoted(joined);

    if (direct) {
      out.push({
        id: `q-${n.id}`,
        text: direct,
        speaker: MENHUB_NAME, // asumsi kutipan relevan dengan Menhub; bisa diperkaya jika ada NER
        date: n.publishedAt || nowISO,
        context: n.title,
        link: n.link,
        tags: ["Kutipan", ...(n.entities || [])],
      });
      continue;
    }

    // Fallback pseudo-quote (parafrasa singkat, tidak mengada-ada di luar ringkasan)
    const s = (n.summary || n.title || "").trim();
    if (!s) continue;

    const trimmed =
      s.length > 180 ? s.slice(0, 177).replace(/\s+\S*$/, "") + "..." : s;

    out.push({
      id: `q-${n.id}-gen`,
      text: `${trimmed} (ringkas)`,
      speaker: `${MENHUB_NAME}`,
      date: n.publishedAt || nowISO,
      context: n.title,
      link: n.link,
      tags: ["Kutipan", ...(n.entities || [])],
    });
  }

  // Dedup by text
  const seen = new Set<string>();
  return out.filter((q) => {
    const k = q.text.toLowerCase();
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}
