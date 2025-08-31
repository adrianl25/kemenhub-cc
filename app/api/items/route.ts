// app/api/items/route.ts
export const runtime = "nodejs";
export const revalidate = 60;

import Parser from "rss-parser";

// ===== Types dari rss-parser (disederhanakan) =====
type RSSItem = {
  title?: string;
  link?: string;
  pubDate?: string;
  contentSnippet?: string;
};

// ===== Output types (selaras dengan UI) =====
type NewsOut = {
  id: string;
  title: string;
  source: string;
  publishedAt: string; // ISO
  link: string;
  summary?: string;
  entities?: string[];
  note?: string; // keterangan saat fallback
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

type ItemsResponse = {
  news: NewsOut[];
  events: EventOut[];
  quotes: QuoteOut[];
};

// ===== Sumber RSS kredibel =====
const FEEDS: string[] = [
  "https://www.antaranews.com/rss/terkini.xml",
  "https://rss.kompas.com/nasional",
  "https://www.tempo.co/rss/nasional",
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

const DEFAULT_KEYWORDS: string[] = [
  "kemenhub",
  "kementerian perhubungan",
  "menhub",
  "budi karya",
  "perhubungan",
  "kementerian perhubungan ri",
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

async function loadNewsFromFeeds(
  keywords: string[],
  fallbackCount: number
): Promise<NewsOut[]> {
  const parser = new Parser<RSSItem>();
  const hits: NewsOut[] = [];
  const raw: NewsOut[] = [];

  for (const feedUrl of FEEDS) {
    try {
      const feed = await parser.parseURL(feedUrl);
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
          entities: ["Kemenhub"],
        };

        raw.push(base);

        if (matchKeywords(title, it.contentSnippet ?? "", keywords)) {
          hits.push(base);
        }
      }
    } catch {
      // jika satu feed gagal, lanjut feed lain
      continue;
    }
  }

  hits.sort(byDateDesc);
  raw.sort(byDateDesc);

  if (hits.length > 0) return hits;

  // fallback supaya tidak kosong
  return raw.slice(0, fallbackCount).map((n) => ({
    ...n,
    note: "fallback_no_keyword_hits",
  }));
}

export async function GET(req: Request): Promise<Response> {
  const url = new URL(req.url);

  // ?types=news,events,quotes — saat ini news yang aktif
  const types = (url.searchParams.get("types") || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  // override kata kunci: ?q=menhub,kemenhub,transportasi
  const q = url.searchParams.get("q");
  const keywords = q
    ? q
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
    : DEFAULT_KEYWORDS;

  // limit fallback: ?limit=15
  const fallbackCount = Math.max(
    1,
    Math.min(50, Number(url.searchParams.get("limit") ?? 15))
  );

  const wantsNews = types.length === 0 || types.includes("news");
  const news = wantsNews
    ? await loadNewsFromFeeds(keywords, fallbackCount)
    : [];

  // tempat events & quotes nanti (tahap berikutnya)
  const events: EventOut[] = [];
  const quotes: QuoteOut[] = [];

  const body: ItemsResponse = { news, events, quotes };

  return new Response(JSON.stringify(body, null, 2), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "s-maxage=60, stale-while-revalidate=300",
    },
  });
}
