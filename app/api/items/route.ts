import Parser from "rss-parser";
import { generateQuoteFromArticle } from "@/lib/quoteEngine";

export const revalidate = 600; // 10 menit

// ===== Types =====
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

type NewsItem = {
  id: string;
  title: string;
  source: string;
  publishedAt: string; // ISO
  link: string;
  summary?: string;
  entities?: string[];
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

type ItemsOut = {
  news: NewsItem[];
  events: EventItem[];
  quotes: QuoteItem[];
  meta: {
    sinceDays: number;
    fetchedAt: string;
    sources: string[];
    counts: { news: number; quotes: number; feedsTried: number };
    relaxed: boolean;
    keywords: string[];
  };
};

type GenericItem = Record<string, unknown> & {
  title?: string;
  link?: string;
  content?: string;
  contentSnippet?: string;
  summary?: string;
  isoDate?: string;
  pubDate?: string;
};

// ===== Helpers =====
function toISO(d: Date | number | string): string {
  const date = d instanceof Date ? d : new Date(d);
  return isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
}
function parseNumber(n: string | null, fallback: number): number {
  if (!n) return fallback;
  const x = Number(n);
  if (!isFinite(x) || x <= 0) return fallback;
  return Math.floor(x);
}
function getSinceDate(sinceDays: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - sinceDays);
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
function getString(obj: Record<string, unknown>, key: string): string {
  const v = obj[key];
  return typeof v === "string" ? v : "";
}
function getItemDate(item: GenericItem): Date {
  const dcDate =
    typeof (item as Record<string, unknown>)["dc:date"] === "string"
      ? ((item as Record<string, unknown>)["dc:date"] as string)
      : "";
  const raw = item.isoDate || item.pubDate || dcDate || "";
  const d = new Date(raw);
  return isNaN(d.getTime()) ? new Date() : d;
}

// ===== Keywords (sudah disesuaikan dgn Menhub: Dudy Purwagandhi) =====
// Bisa override via ENV KEYWORDS (koma-dipisah) atau query ?keywords=a,b,c
const DEFAULT_KEYWORDS = [
  "menhub",
  "menteri perhubungan",
  "kemenhub",
  "kementerian perhubungan",
  "dudy purwagandhi",
  "bapak dudy purwagandhi",
  "dudy",
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
];

const TAG_RULES: Array<{ key: string; tag: string }> = [
  { key: "bandara", tag: "Penerbangan" },
  { key: "penerbangan", tag: "Penerbangan" },
  { key: "pesawat", tag: "Penerbangan" },
  { key: "pelabuhan", tag: "Laut" },
  { key: "pelayaran", tag: "Laut" },
  { key: "kapal", tag: "Laut" },
  { key: "kereta", tag: "Kereta" },
  { key: "krl", tag: "Kereta" },
  { key: "lrt", tag: "Kereta" },
  { key: "mrt", tag: "Kereta" },
  { key: "jalan tol", tag: "Darat" },
  { key: "terminal", tag: "Darat" },
  { key: "angkot", tag: "Darat" },
  { key: "bus listrik", tag: "Transportasi Hijau" },
  { key: "emisi", tag: "Transportasi Hijau" },
  { key: "elektrifikasi", tag: "Transportasi Hijau" },
  { key: "keselamatan", tag: "Keselamatan" },
  { key: "regulasi", tag: "Regulasi" },
];

function isRelevant(text: string, keys: string[]): boolean {
  const t = text.toLowerCase();
  return keys.some((k) => t.includes(k.toLowerCase()));
}

function extractEntities(text: string): string[] {
  const t = text.toLowerCase();
  const out = new Set<string>();
  if (
    t.includes("menhub") ||
    t.includes("menteri perhubungan") ||
    t.includes("dudy purwagandhi") ||
    t.includes("purwagandhi")
  )
    out.add("Menteri Perhubungan");
  if (t.includes("kemenhub") || t.includes("kementerian perhubungan"))
    out.add("Kemenhub");
  for (const r of TAG_RULES) if (t.includes(r.key)) out.add(r.tag);
  return Array.from(out);
}

// ===== Feeds =====
const FEEDS: ReadonlyArray<{ name: string; url: string }> = [
  {
    name: "GoogleNews:Menhub",
    url:
      "https://news.google.com/rss/search?q=Menhub%20OR%20%22Menteri%20Perhubungan%22&hl=id&gl=ID&ceid=ID:id",
  },
  {
    name: "GoogleNews:Kemenhub",
    url:
      "https://news.google.com/rss/search?q=Kemenhub%20OR%20%22Kementerian%20Perhubungan%22&hl=id&gl=ID&ceid=ID:id",
  },
  {
    name: "GoogleNews:Dudy",
    url:
      "https://news.google.com/rss/search?q=%22Dudy%20Purwagandhi%22%20OR%20Purwagandhi&hl=id&gl=ID&ceid=ID:id",
  },
  { name: "Antara", url: "https://www.antaranews.com/rss/terkini" },
  { name: "Kompas", url: "https://news.kompas.com/rss" },
  { name: "Tempo", url: "https://rss.tempo.co/tempo" },
  { name: "Bisnis", url: "https://www.bisnis.com/rss" },
  { name: "Detik", url: "https://rss.detik.com/index.php/detikNews" },
];

// fetch dengan timeout
async function fetchWithTimeout(url: string, ms: number): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, {
      signal: controller.signal,
      headers: {
        "user-agent": "Mozilla/5.0 KemenhubCC/1.0 (+https://vercel.app)",
        accept:
          "application/rss+xml, application/xml, text/xml;q=0.9, */*;q=0.8",
      },
    });
  } finally {
    clearTimeout(id);
  }
}

async function parseFeed(
  parser: Parser,
  feed: { name: string; url: string },
  since: Date,
  keys: string[],
  strict: boolean
): Promise<{ news: NewsItem[]; quotes: QuoteItem[] }> {
  const news: NewsItem[] = [];
  const quotes: QuoteItem[] = [];

  const res = await fetchWithTimeout(feed.url, 12000);
  if (!res.ok) return { news, quotes };

  const xml = await res.text();
  const out = (await parser.parseString(xml)) as Parser.Output<GenericItem>;
  const items: GenericItem[] = Array.isArray(out.items)
    ? (out.items as GenericItem[])
    : [];

  for (const item of items) {
    const record = item as Record<string, unknown>;
    const title = typeof item.title === "string" ? item.title.trim() : "";
    const link = typeof item.link === "string" ? item.link.trim() : "";
    const contentRaw =
      (typeof item.content === "string" ? item.content : "") ||
      getString(record, "content:encoded") ||
      (typeof item.contentSnippet === "string" ? item.contentSnippet : "") ||
      (typeof item.summary === "string" ? item.summary : "") ||
      "";
    const summary = stripHtml(contentRaw);

    const dt = getItemDate(item);
    if (dt < since) continue;

    const combined = `${title} ${summary}`;
    const relevant = isRelevant(combined, keys);

    if (!relevant && strict) continue;
    if (!relevant && !strict) {
      const domainOK = isRelevant(combined, DOMAIN_KEYWORDS);
      if (!domainOK) continue;
    }

    const entities = extractEntities(combined);

    const n: NewsItem = {
      id: `${feed.name}-${dt.getTime()}-${title.slice(0, 24)}`,
      title: title || "(tanpa judul)",
      source: feed.name,
      publishedAt: toISO(dt),
      link: link || "#",
      summary: summary.slice(0, 400),
      entities,
    };
    news.push(n);

    const qCand = generateQuoteFromArticle({
      title,
      content: contentRaw || summary,
    });
    if (qCand) {
      const tags = ["Kutipan", ...entities];
      const q: QuoteItem = {
        id: `${n.id}-q`,
        text: qCand.text,
        speaker: "Menteri Perhubungan (Dudy Purwagandhi)",
        date: n.publishedAt,
        context: n.title,
        link: n.link,
        tags,
      };
      quotes.push(q);
    }
  }

  return { news, quotes };
}

// ===== Handler =====
export async function GET(req: Request): Promise<Response> {
  const url = new URL(req.url);

  const typesParam = url.searchParams.get("types");
  const sinceParam = url.searchParams.get("sinceDays");
  const maxParam = url.searchParams.get("max");
  const keywordsParam = url.searchParams.get("keywords");
  const strictParam = url.searchParams.get("strict"); // "1"(default) | "0"

  const types = (typesParam ? typesParam.split(",") : ["news", "quotes"])
    .map((s) => s.trim().toLowerCase())
    .filter((s) => s === "news" || s === "events" || s === "quotes");

  const sinceDays = parseNumber(sinceParam, 7);
  const since = getSinceDate(sinceDays);
  const max = Math.min(Math.max(parseNumber(maxParam, 100), 10), 300);

  const envKeys =
    typeof process.env.KEYWORDS === "string" && process.env.KEYWORDS.trim()
      ? process.env.KEYWORDS.split(",").map((x) => x.trim())
      : [];
  const keys = (keywordsParam ? keywordsParam.split(",") : envKeys.length ? envKeys : DEFAULT_KEYWORDS)
    .map((k) => k.trim())
    .filter((k) => k.length > 0);

  const strict = strictParam === "0" ? false : true;

  const parser = new Parser({
    timeout: 15000,
    headers: {
      "user-agent": "KemenhubCC/1.0 (+https://vercel.app)",
      accept:
        "application/rss+xml, application/xml, text/xml;q=0.9, */*;q=0.8",
    },
  });

  const newsAll: NewsItem[] = [];
  const quotesAll: QuoteItem[] = [];
  const eventsAll: EventItem[] = []; // TODO: sambungkan ke agenda resmi bila tersedia

  let relaxed = false;

  // Strict fetch
  await Promise.all(
    FEEDS.map(async (f) => {
      try {
        const { news, quotes } = await parseFeed(parser, f, since, keys, true);
        newsAll.push(...news);
        quotesAll.push(...quotes);
      } catch {
        // lanjut feed berikutnya
      }
    })
  );

  // Relaxed fetch (domain transportasi) jika kosong total
  if (newsAll.length === 0 && quotesAll.length === 0) {
    relaxed = true;
    await Promise.all(
      FEEDS.map(async (f) => {
        try {
          const { news, quotes } = await parseFeed(parser, f, since, keys, false);
          newsAll.push(...news);
          quotesAll.push(...quotes);
        } catch {
          // lanjut
        }
      })
    );
  }

  newsAll.sort((a, b) => +new Date(b.publishedAt) - +new Date(a.publishedAt));
  quotesAll.sort((a, b) => +new Date(b.date) - +new Date(a.date));

  const out: ItemsOut = {
    news: types.includes("news") ? newsAll.slice(0, max) : [],
    events: types.includes("events") ? eventsAll : [],
    quotes: types.includes("quotes") ? quotesAll.slice(0, max) : [],
    meta: {
      sinceDays,
      fetchedAt: new Date().toISOString(),
      sources: FEEDS.map((f) => f.name),
      counts: { news: newsAll.length, quotes: quotesAll.length, feedsTried: FEEDS.length },
      relaxed,
      keywords: keys,
    },
  };

  return new Response(JSON.stringify(out), {
    status: 200,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}
