import { NextResponse } from "next/server";
import Parser from "rss-parser";

export const revalidate = 60; // 60 detik cache ISR

// ========= Types =========
type NewsItem = {
  id: string;
  title: string;
  source: string;
  publishedAt: string; // ISO
  link: string;
  summary?: string;
  entities?: string[];
};

type EventItem = {
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

type QuoteItem = {
  id: string;
  text: string;
  speaker: string;
  date: string; // ISO
  context?: string;
  link: string;
  tags?: string[];
};

// Parser item superset (hindari any)
type GenericItem = {
  title?: string;
  link?: string;
  content?: string;
  contentSnippet?: string;
  "content:encoded"?: string;
  summary?: string;
  isoDate?: string;
  pubDate?: string;
} & Record<string, unknown>;

// ========= Konfigurasi Sumber =========
const FEEDS: ReadonlyArray<{ url: string; source: string }> = [
  { url: "https://www.antaranews.com/rss/terkini", source: "Antara" },
  { url: "https://rss.kompas.com/", source: "Kompas" },
  { url: "https://www.tempo.co/rss/nasional", source: "Tempo" },
  // Tambahkan feed lain yang relevan di sini
];

const parser = new Parser();

// ========= Kata Kunci Relevansi =========
const DEFAULT_KEYWORDS = [
  "menhub",
  "menteri perhubungan",
  "kemenhub",
  "kementerian perhubungan",
  "dudy purwagandhi",
  "purwagandhi",
];

const DOMAIN_KEYWORDS = [
  "transportasi",
  "penerbangan",
  "bandara",
  "pelabuhan",
  "pelayaran",
  "kereta",
  "krl",
  "lrt",
  "mrt",
  "jalan tol",
  "terminal",
  "angkot",
  "bus listrik",
  "emisi",
  "elektrifikasi",
  "keselamatan",
  "regulasi",
];

// ========= Utilities =========
function toISO(d: Date | string): string {
  return d instanceof Date ? d.toISOString() : new Date(d).toISOString();
}
function parseIntSafe(s: string | null, fallback: number): number {
  if (!s) return fallback;
  const n = Number(s);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}
function getSince(days: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d;
}
function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
function includesAny(text: string, keys: string[]): boolean {
  const t = text.toLowerCase();
  return keys.some((k) => t.includes(k.toLowerCase()));
}
function extractEntities(text: string): string[] {
  const t = text.toLowerCase();
  const set = new Set<string>();
  if (
    t.includes("menhub") ||
    t.includes("menteri perhubungan") ||
    t.includes("dudy purwagandhi") ||
    t.includes("purwagandhi")
  ) {
    set.add("Menteri Perhubungan");
  }
  if (t.includes("kemenhub") || t.includes("kementerian perhubungan")) {
    set.add("Kemenhub");
  }
  if (t.includes("bandara") || t.includes("penerbangan")) set.add("Penerbangan");
  if (t.includes("pelabuhan") || t.includes("pelayaran") || t.includes("kapal")) set.add("Laut");
  if (t.includes("kereta") || t.includes("krl") || t.includes("lrt") || t.includes("mrt"))
    set.add("Kereta");
  if (t.includes("jalan tol") || t.includes("terminal") || t.includes("angkot")) set.add("Darat");
  if (t.includes("bus listrik") || t.includes("elektrifikasi") || t.includes("emisi"))
    set.add("Transportasi Hijau");
  if (t.includes("keselamatan")) set.add("Keselamatan");
  if (t.includes("regulasi")) set.add("Regulasi");
  return Array.from(set);
}

// ========= Heuristik Event =========
const EVENT_VERBS = [
  "peresmian",
  "meresmikan",
  "kunjungan kerja",
  "meninjau",
  "rapat",
  "rakor",
  "dialog",
  "seminar",
  "forum",
  "penandatanganan",
  "kick off",
  "kick-off",
];
function looksLikeEvent(title: string, summary: string): boolean {
  const t = `${title} ${summary}`.toLowerCase();
  return EVENT_VERBS.some((v) => t.includes(v));
}
function guessLocation(text: string): string {
  const m = text.match(/\bdi\s+([A-Z][A-Za-z\-\s']{2,50})/);
  return m ? m[1].trim() : "—";
}

// ========= Heuristik Quotes =========
function splitSentences(idText: string): string[] {
  const normalized = idText.replace(/\s+/g, " ").trim();
  const parts = normalized
    .split(/(?<=[\.\?\!])\s+(?=[A-ZÂ-Ź“"])/g)
    .map((x) => x.trim())
    .filter((x) => x.length > 0);
  return parts.length > 0 ? parts : [normalized];
}
function bestQuoteFrom(title: string, content: string): string | null {
  const body = stripHtml(`${title ? `${title}. ` : ""}${content}`);
  if (!body) return null;
  const sents = splitSentences(body);
  // Prioritaskan kalimat yang menyebut Menhub/Dudy
  const pri = sents.find((s) =>
    /menhub|menteri perhubungan|dudy\s+purwagandhi/i.test(s)
  );
  if (pri && pri.length >= 30 && pri.length <= 240) return pri.trim();
  // fallback kalimat terpanjang yang masuk akal
  const sorted = [...sents].sort((a, b) => b.length - a.length);
  const cand = sorted.find((s) => s.length >= 50 && s.length <= 220);
  return cand ? cand.trim() : null;
}

// ========= Fetch RSS =========
async function fetchNewsFromFeeds(
  feeds: ReadonlyArray<{ url: string; source: string }>,
  since: Date,
  keys: string[]
): Promise<{ news: NewsItem[]; quotes: QuoteItem[] }> {
  const news: NewsItem[] = [];
  const quotes: QuoteItem[] = [];

  for (const f of feeds) {
    try {
      const feed = await parser.parseURL(f.url);
      const items = Array.isArray(feed.items) ? (feed.items as GenericItem[]) : [];
      for (const it of items) {
        const title = (it.title || "").trim();
        const link = (it.link || "").trim();
        const raw =
          (it.content as string | undefined) ||
          (it["content:encoded"] as string | undefined) ||
          (it.contentSnippet as string | undefined) ||
          (it.summary as string | undefined) ||
          "";
        const summary = stripHtml(raw);
        const rawDate = (it.isoDate || it.pubDate || "") as string;
        const dt = new Date(rawDate);
        if (!title || isNaN(dt.getTime()) || dt < since) continue;

        const combined = `${title} ${summary}`;
        const relevant = includesAny(combined, keys) || includesAny(combined, DOMAIN_KEYWORDS);
        if (!relevant) continue;

        const entities = extractEntities(combined);
        const n: NewsItem = {
          id: `${f.source}-${dt.getTime()}-${title.slice(0, 20)}`,
          title,
          source: f.source,
          publishedAt: toISO(dt),
          link: link || "#",
          summary: summary.slice(0, 500),
          entities,
        };
        news.push(n);

        // Quotes (jika menyebut Menhub/Dudy)
        if (/menhub|menteri perhubungan|dudy\s+purwagandhi/i.test(combined)) {
          const qtext = bestQuoteFrom(title, raw || summary);
          if (qtext) {
            quotes.push({
              id: `q-${n.id}`,
              text: qtext,
              speaker: "Menteri Perhubungan (Dudy Purwagandhi)",
              date: n.publishedAt,
              context: n.title,
              link: n.link,
              tags: ["Kutipan", ...entities],
            });
          }
        }
      }
    } catch {
      // Abaikan feed error, lanjut feed berikutnya
    }
  }

  news.sort((a, b) => +new Date(b.publishedAt) - +new Date(a.publishedAt));
  quotes.sort((a, b) => +new Date(b.date) - +new Date(a.date));
  return { news, quotes };
}

function promoteNewsToEvents(news: NewsItem[], since: Date): EventItem[] {
  const out: EventItem[] = [];
  for (const n of news) {
    const sum = n.summary || "";
    if (!looksLikeEvent(n.title, sum)) continue;
    const attended = /menhub|menteri perhubungan|dudy\s+purwagandhi/i.test(
      `${n.title} ${sum}`
    );
    let dt = new Date(n.publishedAt);
    if (/\b(akan|besok)\b/i.test(`${n.title} ${sum}`)) {
      dt.setDate(dt.getDate() + 1);
    }
    if (dt < since) continue;
    const loc = guessLocation(`${n.title} ${sum}`);
    const tags = n.entities || [];
    out.push({
      id: `ev-${n.id}`,
      title: n.title,
      date: toISO(dt),
      location: loc,
      attendedByMinister: attended,
      source: n.source,
      tags,
      summary: sum,
      link: n.link,
    });
  }
  // dedup by title+date
  const map = new Map<string, EventItem>();
  for (const e of out) map.set(`${e.title}|${e.date}`, e);
  const arr = Array.from(map.values());
  arr.sort((a, b) => +new Date(b.date) - +new Date(a.date));
  return arr;
}

// ========= Handler =========
export async function GET(req: Request) {
  const url = new URL(req.url);
  const types = (url.searchParams.get("types") || "news,events,quotes")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter((t) => t === "news" || t === "events" || t === "quotes");

  const days = parseIntSafe(url.searchParams.get("days"), 7);
  const since = getSince(days);

  const envKeys =
    typeof process.env.KEYWORDS === "string" && process.env.KEYWORDS.trim()
      ? process.env.KEYWORDS.split(",").map((x) => x.trim())
      : DEFAULT_KEYWORDS;
  const keys = envKeys.length > 0 ? envKeys : DEFAULT_KEYWORDS;

  const { news, quotes } = await fetchNewsFromFeeds(FEEDS, since, keys);
  const events = promoteNewsToEvents(news, since);

  const body: { news?: NewsItem[]; events?: EventItem[]; quotes?: QuoteItem[] } = {};
  if (types.includes("news")) body.news = news;
  if (types.includes("events")) body.events = events;
  if (types.includes("quotes")) body.quotes = quotes;

  return NextResponse.json(body, { status: 200 });
}
