// app/api/items/route.ts
export const runtime = "nodejs";
export const revalidate = 60;
export const dynamic = "force-dynamic";

import Parser from "rss-parser";

// ===== Types =====
type RSSItem = {
  title?: string;
  link?: string;
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

type ItemsResponse = {
  news: NewsOut[];
  events: never[];
  quotes: never[];
};

// ===== Sumber RSS kredibel =====
const FEEDS: string[] = [
  "https://www.antaranews.com/rss/terkini.xml",
  "https://rss.kompas.com/nasional",
  "https://www.tempo.co/rss/nasional",
  // kamu bisa menambah feed lain yang punya RSS
];

// ===== Utils =====
function domainOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "unknown";
  }
}
function isValidDate(d: Date): boolean {
  return !Number.isNaN(+d);
}
const KEYWORDS_DEFAULT: string[] = [
  "menhub",
  "menteri perhubungan",
  "budi karya sumadi",
  "kementerian perhubungan",
  "kemenhub",
];

function matchKeywords(textA = "", textB = "", keywords: string[]): boolean {
  const a = textA.toLowerCase();
  const b = textB.toLowerCase();
  return keywords.some((k) => {
    const kk = k.toLowerCase();
    return a.includes(kk) || b.includes(kk);
  });
}

const byDateDesc = (a: { publishedAt: string }, b: { publishedAt: string }) =>
  +new Date(b.publishedAt) - +new Date(a.publishedAt);

// fetch XML (User-Agent kustom), lalu parseString via rss-parser
async function fetchAndParseFeed(url: string, parser: Parser<RSSItem>) {
  const res = await fetch(url, {
    headers: {
      "User-Agent": "Kemenhub-CommandCenter/1.0 (+https://vercel.com) Node.js",
      Accept: "application/rss+xml, application/xml;q=0.9, */*;q=0.8",
    },
    redirect: "follow",
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Fetch ${url} status ${res.status}`);
  const xml = await res.text();
  const feed = await parser.parseString(xml);
  return feed;
}

async function loadNewsFromFeeds(
  keywords: string[],
  allowFallback: boolean,
  fallbackCount: number
): Promise<NewsOut[]> {
  const parser = new Parser<RSSItem>();
  const hits: NewsOut[] = [];
  const raw: NewsOut[] = [];

  for (const feedUrl of FEEDS) {
    try {
      const feed = await fetchAndParseFeed(feedUrl, parser);
      const source = domainOf(feedUrl);
      const items = feed.items ?? [];

      for (const it of items) {
        const title = it.title ?? "";
        const link = it.link ?? "";
        const published = it.pubDate ? new Date(it.pubDate) : undefined;
        if (!link || !published || !isValidDate(published)) continue;

        const base: NewsOut = {
          id: `${source}#${link}`,
          title: title || "(tanpa judul)",
          source,
          publishedAt: published.toISOString(),
          link,
          summary: it.contentSnippet ?? "",
          entities: [],
        };

        raw.push(base);
        if (matchKeywords(title, it.contentSnippet ?? "", keywords)) {
          hits.push(base);
        }
      }
    } catch {
      // kalau satu feed error, lanjut feed lain
      continue;
    }
  }

  hits.sort(byDateDesc);
  raw.sort(byDateDesc);

  if (hits.length > 0) return hits;
  if (!allowFallback) return [];
  return raw.slice(0, fallbackCount);
}

export async function GET(req: Request): Promise<Response> {
  const url = new URL(req.url);

  // ?q=menhub,kemenhub (override keywords)
  const q = url.searchParams.get("q");
  const keywords = q
    ? q
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
    : KEYWORDS_DEFAULT;

  // ?fallback=1 untuk tampilkan berita umum saat tidak ada yang cocok
  const allowFallback = url.searchParams.get("fallback") === "1";

  // ?limit=15 batas fallback
  const fallbackCount = Math.max(
    1,
    Math.min(50, Number(url.searchParams.get("limit") ?? 15))
  );

  const news = await loadNewsFromFeeds(keywords, allowFallback, fallbackCount);

  const body: ItemsResponse = {
    news,
    events: [],
    quotes: [],
  };

  return new Response(JSON.stringify(body, null, 2), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "s-maxage=60, stale-while-revalidate=300",
    },
  });
}
