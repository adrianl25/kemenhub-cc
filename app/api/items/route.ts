import Parser from "rss-parser";

export const revalidate = 600; // cache 10 menit

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
  };
};

// Representasi minimal sebuah item RSS, TANPA any
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

const FEEDS: ReadonlyArray<{ name: string; url: string }> = [
  { name: "Antara", url: "https://www.antaranews.com/rss/terkini" },
  { name: "Kompas", url: "https://news.kompas.com/rss" },
  { name: "Tempo", url: "https://rss.tempo.co/tempo" },
  { name: "Bisnis", url: "https://www.bisnis.com/rss" },
  { name: "Detik", url: "https://rss.detik.com/index.php/detikNews" },
];

// Timeout fetch (stabil di serverless)
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

function extractEntities(text: string): string[] {
  const t = text.toLowerCase();
  const ents: string[] = [];
  if (t.includes("menhub") || t.includes("menteri perhubungan"))
    ents.push("Menteri Perhubungan");
  if (t.includes("kemenhub")) ents.push("Kemenhub");
  if (t.includes("transportasi")) ents.push("Transportasi");
  if (t.includes("penerbangan")) ents.push("Penerbangan");
  if (t.includes("pelabuhan") || t.includes("pelayaran")) ents.push("Laut");
  if (t.includes("kereta") || t.includes("krl")) ents.push("Kereta");
  if (t.includes("jalan") || t.includes("terminal") || t.includes("angkot"))
    ents.push("Darat");
  return Array.from(new Set(ents));
}

function extractQuoteFromText(text: string): string | null {
  const candidates: string[] = [];
  const fancy = /“([^”]{10,300})”/g;
  const ascii = /"([^"]{10,300})"/g;
  let m: RegExpExecArray | null;
  while ((m = fancy.exec(text)) !== null) candidates.push(m[1]);
  while ((m = ascii.exec(text)) !== null) candidates.push(m[1]);

  if (candidates.length === 0) return null;

  const t = text.toLowerCase();
  const okContext =
    t.includes("menhub") ||
    t.includes("menteri perhubungan") ||
    t.includes("kemenhub");
  if (!okContext) return null;

  const chosen = candidates.sort((a, b) => a.length - b.length)[0];
  return chosen ? chosen.trim() : null;
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

function getString(obj: Record<string, unknown>, key: string): string {
  const v = obj[key];
  return typeof v === "string" ? v : "";
}

async function parseFeed(
  parser: Parser,
  feed: { name: string; url: string },
  since: Date
): Promise<{ news: NewsItem[]; quotes: QuoteItem[] }> {
  const news: NewsItem[] = [];
  const quotes: QuoteItem[] = [];

  const res = await fetchWithTimeout(feed.url, 12000);
  if (!res.ok) return { news, quotes };

  const xml = await res.text();
  // Hindari any: gunakan output generik
  const out = (await parser.parseString(xml)) as Parser.Output<GenericItem>;
  const items: GenericItem[] = Array.isArray(out.items) ? (out.items as GenericItem[]) : [];

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

    const qText = extractQuoteFromText(`${title}. ${summary}`);
    if (qText) {
      const ents = Array.isArray(entities) ? entities : [];
      const q: QuoteItem = {
        id: `${n.id}-q`,
        text: qText,
        speaker: "Menteri Perhubungan",
        date: n.publishedAt,
        context: n.title,
        link: n.link,
        tags: ["Kutipan", ...ents],
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

  const types = (typesParam ? typesParam.split(",") : ["news", "quotes"])
    .map((s) => s.trim().toLowerCase())
    .filter((s) => s === "news" || s === "events" || s === "quotes");

  const sinceDays = parseNumber(sinceParam, 7);
  const since = getSinceDate(sinceDays);

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
  const eventsAll: EventItem[] = []; // TODO: sambungkan ke agenda resmi jika tersedia RSS

  await Promise.all(
    FEEDS.map(async (f) => {
      try {
        const { news, quotes } = await parseFeed(parser, f, since);
        newsAll.push(...news);
        quotesAll.push(...quotes);
      } catch {
        // lanjut ke feed berikutnya
      }
    })
  );

  newsAll.sort(
    (a, b) => +new Date(b.publishedAt) - +new Date(a.publishedAt)
  );
  quotesAll.sort((a, b) => +new Date(b.date) - +new Date(a.date));

  const out: ItemsOut = {
    news: types.includes("news") ? newsAll.slice(0, 80) : [],
    events: types.includes("events") ? eventsAll : [],
    quotes: types.includes("quotes") ? quotesAll.slice(0, 80) : [],
    meta: {
      sinceDays,
      fetchedAt: new Date().toISOString(),
      sources: FEEDS.map((f) => f.name),
    },
  };

  return new Response(JSON.stringify(out), {
    status: 200,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}
