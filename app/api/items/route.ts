// app/api/items/route.ts
// LIVE aggregator Menhub/Kemenhub via RSS (Google News + media nasional).
// Memperbaiki ekstraksi "Kutipan Penting" dengan heuristik bahasa Indonesia.

import Parser from "rss-parser";

export const revalidate = 60;

// ---------- Types ----------
type RawItem = {
  title?: string;
  link?: string;
  isoDate?: string;
  pubDate?: string;
  contentSnippet?: string;
};

type NewsOut = {
  id: string;
  title: string;
  source: string;
  publishedAt: string; // ISO
  link: string;
  summary?: string;
  entities?: string[];
};

type EventOut = {
  id: string;
  title: string;
  date: string; // ISO
  location: string;
  attendedByMinister: boolean;
  source: string;
  tags?: string[];
  summary?: string;
  link: string;
};

type QuoteOut = {
  id: string;
  text: string;
  speaker: string;
  date: string; // ISO
  context?: string;
  link: string;
  tags?: string[];
};

const parser = new Parser({
  timeout: 10000,
  headers: { "user-agent": "kemenhub-cc/1.0" },
});

// ---------- Kata kunci (relevansi) ----------
const KW = [
  "menhub",
  "menteri perhubungan",
  "kemenhub",
  "kementerian perhubungan",
  "dudy purwagandhi",
];

// Verba ujaran (bhs Indonesia umum di berita)
const SPEECH_VERBS = [
  "kata",
  "ujar",
  "ucap",
  "sebut",
  "tutur",
  "jelas",
  "terang",
  "tegas",
  "ungkap",
  "papar",
  "menurut",
  "menyatakan",
  "mengatakan",
  "menegaskan",
  "menyebut",
];

function looksRelevant(title = "", snippet = "", source = ""): boolean {
  const hay = `${title} ${snippet} ${source}`.toLowerCase();
  return KW.some((k) => hay.includes(k));
}

function unwrapGoogleNewsLink(href: string | undefined): string {
  if (!href) return "";
  try {
    const u = new URL(href);
    const direct = u.searchParams.get("url");
    if (direct) return direct;
  } catch {}
  return href;
}

function normDate(d?: string): string {
  const iso = d ? new Date(d) : new Date();
  return new Date(iso).toISOString();
}

function sourceFromLink(href: string): string {
  try {
    const u = new URL(href);
    return u.hostname.replace(/^www\./, "");
  } catch {
    return "unknown";
  }
}

// Decode kecil-kecilan utk entity umum
function decodeEntities(s: string): string {
  return s
    .replace(/&quot;/g, '"')
    .replace(/&ldquo;|&rdquo;/g, '"')
    .replace(/&lsquo;|&rsquo;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&nbsp;/g, " ");
}

function normalizeQuotes(s: string): string {
  return s.replace(/[“”]/g, '"').replace(/[‘’]/g, "'");
}

// ---------- FEEDS ----------
const GN_MAIN =
  "https://news.google.com/rss/search?q=%28%22Menteri%20Perhubungan%22%20OR%20Menhub%20OR%20Kemenhub%20OR%20%22Dudy%20Purwagandhi%22%29+when:7d&hl=id&gl=ID&ceid=ID:id";

const GN_DEPHUB =
  "https://news.google.com/rss/search?q=%28%22Menteri%20Perhubungan%22%20OR%20Menhub%20OR%20Kemenhub%29+site:dephub.go.id+OR+site:kemenhub.go.id+OR+site:hubud.kemenhub.go.id+when:30d&hl=id&gl=ID&ceid=ID:id";

const ANTARA_TOP = "https://www.antaranews.com/rss/top-news";
const DETIK_BERITA = "https://news.detik.com/berita/rss";
const KOMPAS_ROOT = "https://rss.kompas.com/";

// ---------- Helpers ----------
async function grab(feedUrl: string): Promise<RawItem[]> {
  try {
    const res = await fetch(feedUrl, { cache: "no-store" });
    const xml = await res.text();
    const out = await parser.parseString(xml);
    return ((out as unknown as { items?: RawItem[] }).items ?? []) as RawItem[];
  } catch {
    return [];
  }
}

function mapToNews(items: RawItem[]): NewsOut[] {
  return items
    .map((it, idx) => {
      const link = unwrapGoogleNewsLink(it.link);
      const title = normalizeQuotes(decodeEntities((it.title || "").trim()));
      const summary = normalizeQuotes(
        decodeEntities((it.contentSnippet || "").trim())
      );
      return {
        id: `news-${(it.isoDate || it.pubDate || "")}-${idx}`,
        title,
        source: sourceFromLink(link),
        publishedAt: normDate(it.isoDate || it.pubDate),
        link,
        summary,
        entities: ["Menteri Perhubungan"],
      };
    })
    .filter((n) => looksRelevant(n.title, n.summary, n.source));
}

function uniqBy<T extends { link: string }>(arr: T[]): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const a of arr) {
    const k = a.link || "";
    if (!seen.has(k)) {
      seen.add(k);
      out.push(a);
    }
  }
  return out;
}

function toEvent(n: NewsOut): EventOut {
  return {
    id: `evt-${n.id}`,
    title: n.title,
    date: n.publishedAt,
    location: "Indonesia",
    attendedByMinister: true,
    source: n.source,
    tags: ["Agenda", "Menhub"],
    summary: n.summary,
    link: n.link,
  };
}

// --------- Ekstraksi Kutipan ---------
function pickQuotedSegments(text: string): string[] {
  // Ambil isi dalam tanda petik "..."
  const out: string[] = [];
  const re = /"([^"]{10,240})"/g; // 10..240 char
  let m: RegExpExecArray | null;
  // eslint-disable-next-line no-cond-assign
  while ((m = re.exec(text)) !== null) {
    out.push(m[1].trim());
  }
  return out;
}

function splitSentences(text: string): string[] {
  // Pemisah sederhana: titik/koma panjang dan tanda tanya/seru
  // Hindari memotong angka/desimal singkat — cukup kasar sudah cukup untuk ringkasan RSS
  return text
    .split(/(?<=[\.\?\!])\s+|—|\u2014/g)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

function looksLikeSpeechSentence(s: string): boolean {
  const low = s.toLowerCase();
  const hasMenhub =
    low.includes("menhub") || low.includes("menteri perhubungan");
  const hasVerb = SPEECH_VERBS.some((v) => low.includes(` ${v} `) || low.startsWith(`${v} `));
  return hasMenhub && hasVerb;
}

function clampQuoteLen(s: string): string | null {
  const t = s.trim();
  if (t.length < 10) return null;
  if (t.length > 240) {
    // coba potong di batas kalimat
    const idx = t.indexOf(". ");
    if (idx > 80 && idx < 240) return t.slice(0, idx + 1);
    return t.slice(0, 240);
  }
  return t;
}

function extractQuote(n: NewsOut): QuoteOut | null {
  const textSrc = `${n.title}. ${n.summary ?? ""}`;
  const clean = normalizeQuotes(decodeEntities(textSrc));

  // 1) Prioritas isi tanda petik
  const quoted = pickQuotedSegments(clean)
    .map(clampQuoteLen)
    .filter((x): x is string => Boolean(x));
  if (quoted.length > 0) {
    return {
      id: `q-${n.id}`,
      text: quoted[0],
      speaker: "Menteri Perhubungan",
      date: n.publishedAt,
      context: n.source,
      link: n.link,
      tags: ["Kutipan", "Menhub"],
    };
  }

  // 2) Fallback: kalimat dengan pola "ujar/menurut/menegaskan ... Menhub"
  const cand = splitSentences(clean).find((s) => looksLikeSpeechSentence(s));
  const clipped = cand ? clampQuoteLen(cand) : null;
  if (clipped) {
    return {
      id: `q-${n.id}`,
      text: clipped,
      speaker: "Menteri Perhubungan",
      date: n.publishedAt,
      context: n.source,
      link: n.link,
      tags: ["Parafrasa", "Menhub"],
    };
  }

  return null;
}

// ---------- Handler ----------
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const typesRaw = (searchParams.get("types") || "news,events,quotes")
    .split(",")
    .map((s) => s.trim().toLowerCase());
  const sinceDays = Math.max(
    1,
    Math.min(90, Number(searchParams.get("sinceDays")) || 7)
  );
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - sinceDays);

  // Ambil feed paralel
  const [gn, gnDept, ant, detik, kompas] = await Promise.all([
    grab(GN_MAIN),
    grab(GN_DEPHUB),
    grab(ANTARA_TOP),
    grab(DETIK_BERITA),
    grab(KOMPAS_ROOT),
  ]);

  // Normalisasi -> News
  const news = uniqBy(
    [
      ...mapToNews(gn),
      ...mapToNews(ant),
      ...mapToNews(detik),
      ...mapToNews(kompas),
    ].filter((n) => new Date(n.publishedAt) >= cutoff)
  ).sort((a, b) => +new Date(b.publishedAt) - +new Date(a.publishedAt));

  // Events dari domain Kemenhub
  const events = uniqBy(mapToNews(gnDept))
    .filter((n) => new Date(n.publishedAt) >= cutoff)
    .map(toEvent)
    .sort((a, b) => +new Date(b.date) - +new Date(a.date));

  // Quotes dari News (top 20)
  const quotes = news
    .map(extractQuote)
    .filter((q): q is QuoteOut => Boolean(q))
    // de-dupe by text
    .filter((q, idx, arr) => arr.findIndex((z) => z.text === q.text) === idx)
    .slice(0, 20);

  const payload = {
    news: typesRaw.includes("news") ? news : [],
    events: typesRaw.includes("events") ? events : [],
    quotes: typesRaw.includes("quotes") ? quotes : [],
  };

  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}
