/* eslint-disable @typescript-eslint/no-unused-vars */
// app/api/items/route.ts
import Parser from "rss-parser";
import { extractQuotesFromText, hashId, type QuoteItem as QuoteOut } from "@/lib/quoteEngine";

export const revalidate = 60; // cache ISR 60 detik untuk Vercel

/** ====== TYPES YANG DIKEMBALIKAN API ====== */
export type EventItem = {
  id: string;
  title: string;
  date?: string;
  location?: string;
  attendedByMinister?: boolean;
  source?: string;
  tags?: string[];
  summary?: string;
  link: string;
};

export type NewsItem = {
  id: string;
  title: string;
  source?: string;
  publishedAt?: string;
  link: string;
  summary?: string;
  entities?: string[];
};

export type QuoteItem = QuoteOut;

type ApiOut = {
  events: EventItem[];
  news: NewsItem[];
  quotes: QuoteItem[];
  meta?: { generatedAt?: string };
};

/** ====== INPUT MINIMAL DARI RSS-PARSER ====== */
type RssItemMinimal = {
  title?: string;
  link?: string;
  contentSnippet?: string;
  content?: string;
  isoDate?: string;
  pubDate?: string;
};
type FeedEntry = {
  url: string;
  source: string;
  kind: "official" | "media" | "google";
  topic?: string;
};

/** ====== PARAMS & UTIL ====== */
const MINISTER_KEYWORDS = [
  "Dudy Purwagandhi",
  "Menteri Perhubungan",
  "Menhub",
];

const EVENT_KEYWORDS = [
  "rapat",
  "rakor",
  "kunjungan",
  "meninjau",
  "meninjau",
  "menghadiri",
  "peresmian",
  "upacara",
  "penandatanganan",
  "dialog",
  "diskusi",
  "peluncuran",
];

const TAG_RULES: Array<{ tag: string; kw: string[] }> = [
  { tag: "Darat", kw: ["jalan", "terminal", "angkutan darat", "bus", "lalu lintas"] },
  { tag: "Laut", kw: ["pelayaran", "pelabuhan", "kapal", "laut"] },
  { tag: "Udara", kw: ["bandara", "penerbangan", "pesawat", "udara", "aviation"] },
  { tag: "Kereta", kw: ["kereta", "ka", "perkeretaapian", "stasiun"] },
  { tag: "Keselamatan", kw: ["keselamatan", "audit", "zero accident", "kecelakaan"] },
  { tag: "Integrasi Moda", kw: ["integrasi moda", "antarmoda", "first mile", "last mile"] },
  { tag: "Bus Listrik", kw: ["bus listrik", "emisi", "elektrifikasi", "ev"] },
  { tag: "Infrastruktur", kw: ["terminal", "pelabuhan", "bandara", "jalur", "runway"] },
  { tag: "Regulasi", kw: ["aturan", "peraturan", "permenn", "kebijakan"] },
];

function toLower(s: string | undefined): string {
  return (s ?? "").toLowerCase();
}
function containsAny(hay: string, words: string[]): boolean {
  const L = hay.toLowerCase();
  return words.some((w) => L.includes(w.toLowerCase()));
}
function looksLikeEvent(title: string, snippet: string): boolean {
  const combined = `${title} ${snippet}`.toLowerCase();
  return EVENT_KEYWORDS.some((k) => combined.includes(k));
}
function markTags(title: string, snippet: string): string[] {
  const tags = new Set<string>();
  const combined = `${title} ${snippet}`.toLowerCase();
  for (const r of TAG_RULES) {
    if (r.kw.some((k) => combined.includes(k))) tags.add(r.tag);
  }
  return Array.from(tags);
}
function isMinisterRelated(title: string, snippet: string): boolean {
  return containsAny(`${title} ${snippet}`, MINISTER_KEYWORDS);
}
function pickDate(it: RssItemMinimal): string | undefined {
  return it.isoDate ?? it.pubDate ?? undefined;
}

/** ====== SUMBER FEED ======
 * Gunakan Google News RSS agar fokus ke Menhub/Dudy dan lebih stabil.
 * Tambah beberapa portal umum untuk variasi.
 */
const FEEDS: FeedEntry[] = [
  // Google News (query khusus Menhub)
  {
    url: "https://news.google.com/rss/search?q=%22Dudy+Purwagandhi%22+OR+%22Menteri+Perhubungan%22&hl=id&gl=ID&ceid=ID:id",
    source: "Google News",
    kind: "google",
    topic: "Menhub",
  },

  // Media umum (sering muncul soal Kemenhub)
  { url: "https://rss.tempo.co/nasional", source: "Tempo", kind: "media" },
  { url: "https://rss.detik.com/index.php/detikcom", source: "Detik", kind: "media" },
  { url: "https://www.antaranews.com/rss/terkini.xml", source: "Antara", kind: "media" },
  { url: "https://www.kompas.com/getrss/nasional", source: "Kompas", kind: "media" },
];

/** ====== FILTER RANGE ====== */
function minDateFromRange(range: string | null): Date {
  const r = (range ?? "7d") as "24h" | "7d" | "30d" | "90d";
  const days = r === "24h" ? 1 : r === "7d" ? 7 : r === "30d" ? 30 : 90;
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d;
}

/** ====== PARSE SEMUA FEED ====== */
async function loadAllFeeds(): Promise<Array<{ source: string; items: RssItemMinimal[] }>> {
  const parser = new Parser(); // tanpa opsi (menghindari error typing)
  const results: Array<{ source: string; items: RssItemMinimal[] }> = [];

  for (const feed of FEEDS) {
    try {
      const out = await parser.parseURL(feed.url);
      const items = (out.items ?? []).map((it) => ({
        title: it.title,
        link: it.link,
        contentSnippet: (it as unknown as { contentSnippet?: string }).contentSnippet,
        content: (it as unknown as { content?: string }).content,
        isoDate: (it as unknown as { isoDate?: string }).isoDate,
        pubDate: (it as unknown as { pubDate?: string }).pubDate,
      }));
      results.push({ source: feed.source, items });
    } catch (_e) {
      // Lewati feed yang gagal
    }
  }
  return results;
}

/** ====== TRANSFORM KE NEWS / EVENTS / QUOTES ====== */
function toNewsItems(
  bundles: Array<{ source: string; items: RssItemMinimal[] }>,
  minDate: Date,
  onlyMinister: boolean
): NewsItem[] {
  const out: NewsItem[] = [];
  for (const b of bundles) {
    for (const it of b.items) {
      const title = (it.title ?? "").trim();
      const link = (it.link ?? "#").trim();
      if (!title || !link) continue;

      const snippet = (it.contentSnippet ?? it.content ?? "").trim();
      const dt = pickDate(it);
      if (dt && new Date(dt) < minDate) continue;

      const related = isMinisterRelated(title, snippet);
      if (onlyMinister && !related) continue;

      const entities = [
        ...(related ? ["Menteri Perhubungan"] : []),
        ...markTags(title, snippet),
      ];
      out.push({
        id: `news-${hashId(`${link}-${title}`)}`,
        title,
        source: b.source,
        publishedAt: dt,
        link,
        summary: snippet ? snippet.slice(0, 300) : undefined,
        entities,
      });
    }
  }
  // urut terbaru
  out.sort((a, b) => {
    const da = a.publishedAt ? +new Date(a.publishedAt) : 0;
    const db = b.publishedAt ? +new Date(b.publishedAt) : 0;
    return db - da;
  });
  return out;
}

function toEventItems(
  news: NewsItem[],
  onlyMinister: boolean
): EventItem[] {
  const evts: EventItem[] = [];
  for (const n of news) {
    const title = n.title;
    const snippet = n.summary ?? "";
    if (!looksLikeEvent(title, snippet)) continue;

    const ministerAttend = (n.entities ?? []).includes("Menteri Perhubungan") ||
      MINISTER_KEYWORDS.some((k) => title.toLowerCase().includes(k.toLowerCase()));

    if (onlyMinister && !ministerAttend) continue;

    const tags = Array.from(new Set([...(n.entities ?? []), "Event"])).filter(Boolean);
    evts.push({
      id: `evt-${hashId(n.id)}`,
      title: n.title,
      date: n.publishedAt,
      location: undefined,
      attendedByMinister: ministerAttend,
      source: n.source,
      tags,
      summary: n.summary,
      link: n.link,
    });
  }
  // urut terbaru
  evts.sort((a, b) => {
    const da = a.date ? +new Date(a.date) : 0;
    const db = b.date ? +new Date(b.date) : 0;
    return db - da;
  });
  return evts;
}

function toQuoteItems(
  bundles: Array<{ source: string; items: RssItemMinimal[] }>,
  minDate: Date,
  onlyMinister: boolean
): QuoteItem[] {
  const quotes: QuoteItem[] = [];

  for (const b of bundles) {
    for (const it of b.items) {
      const title = (it.title ?? "").trim();
      const link = (it.link ?? "#").trim();
      if (!title || !link) continue;

      const snippet = (it.contentSnippet ?? it.content ?? "").trim();
      const dt = pickDate(it);
      if (dt && new Date(dt) < minDate) continue;

      const related = isMinisterRelated(title, snippet);
      if (onlyMinister && !related) continue;

      const found = extractQuotesFromText(snippet || title, {
        link,
        date: dt,
        context: title,
        defaultSpeaker: related ? "Menteri Perhubungan" : undefined,
        extraTags: related ? ["Menteri Perhubungan"] : [],
        maxQuotes: 2,
      });

      // hanya masukkan jika memang ada kutipan
      for (const q of found) quotes.push(q);
    }
  }

  // urut terbaru
  quotes.sort((a, b) => {
    const da = a.date ? +new Date(a.date) : 0;
    const db = b.date ? +new Date(b.date) : 0;
    return db - da;
  });
  return quotes;
}

/** ====== HANDLER ====== */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const range = searchParams.get("range"); // 24h|7d|30d|90d
  const onlyMinisterParam = (searchParams.get("onlyMinister") ?? "true").toLowerCase();
  const onlyMinister = onlyMinisterParam === "true";
  const types = (searchParams.get("types") ?? "all").toLowerCase(); // all|news|events|quotes

  const minDate = minDateFromRange(range);

  // Ambil feeds
  const bundles = await loadAllFeeds();

  // Transform
  const newsAll = toNewsItems(bundles, minDate, onlyMinister);
  const eventsAll = toEventItems(newsAll, onlyMinister);
  const quotesAll = toQuoteItems(bundles, minDate, onlyMinister);

  const out: ApiOut = {
    events: types === "events" ? eventsAll : types === "all" ? eventsAll : [],
    news: types === "news" ? newsAll : types === "all" ? newsAll : [],
    quotes: types === "quotes" ? quotesAll : types === "all" ? quotesAll : [],
    meta: { generatedAt: new Date().toISOString() },
  };

  return new Response(JSON.stringify(out), {
    status: 200,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}
