/* eslint-disable @typescript-eslint/no-unused-vars */
import Parser from "rss-parser";
import type { NextRequest } from "next/server";

export const revalidate = 120; // revalidate ISR 2 menit

// ====== Tipe data yang dipakai UI ======
export type NewsItem = {
  id: string;
  title: string;
  source: string;
  publishedAt: string;
  link: string;
  summary?: string;
  entities?: string[];
};

export type EventItem = {
  id: string;
  title: string;
  date: string;
  location: string;
  attendedByMinister: boolean;
  source: string;
  tags?: string[];
  summary?: string;
  link: string;
};

export type QuoteItem = {
  id: string;
  text: string;
  speaker: string;
  date: string;
  context?: string;
  link: string;
  tags?: string[];
};

// ====== Konfigurasi keyword & feed ======
const MINISTER_NAMES = [
  "Dudy Purwagandhi",
  "Menteri Perhubungan",
  "Menhub",
  "Pak Dudy",
];

const EVENT_WORDS = [
  "agenda",
  "peresmian",
  "kunjungan",
  "rapat",
  "rakor",
  "apel",
  "peninjauan",
  "dialog",
  "seminar",
  "konferensi",
  "kick off",
  "peluncuran",
];

const NEWS_FEEDS: { url: string; source: string }[] = [
  { url: "https://www.dephub.go.id/rss", source: "Kemenhub" }, // jika tidak ada, akan timeout dan di-skip
  { url: "https://www.antaranews.com/rss/terkini", source: "Antara" },
  { url: "https://rss.kompas.com/", source: "Kompas" },
  { url: "https://rss.tempo.co/nasional", source: "Tempo" },
];

type RssItemMinimal = {
  title?: string;
  link?: string;
  contentSnippet?: string;
  content?: string;
  isoDate?: string;
  pubDate?: string;
  categories?: string[];
};

// ====== Util ======
const toIso = (d: Date | string | undefined): string => {
  if (!d) return new Date(0).toISOString();
  try {
    return new Date(d).toISOString();
  } catch {
    return new Date(0).toISOString();
  }
};

const withinRange = (iso: string, after: Date): boolean =>
  new Date(iso).getTime() >= after.getTime();

const includesAny = (hay: string, needles: string[]): boolean => {
  const h = hay.toLowerCase();
  return needles.some((n) => h.includes(n.toLowerCase()));
};

const isMinisterRelated = (text: string): boolean =>
  includesAny(text, MINISTER_NAMES);

// heuristik event sederhana
const looksLikeEvent = (title: string, snippet: string): boolean => {
  const t = `${title} ${snippet}`.toLowerCase();
  return EVENT_WORDS.some((w) => t.includes(w.toLowerCase()));
};

// timeout manual untuk parseURL tanpa AbortSignal (hindari error typings)
async function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return await Promise.race<T>([
    p,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error("timeout")), ms)
    ),
  ]);
}

// Ambil & parse RSS (tanpa argumen kedua)
async function fetchRssItems(feed: { url: string; source: string }): Promise<RssItemMinimal[]> {
  const parser = new Parser();
  try {
    const out = await withTimeout(parser.parseURL(feed.url), 12000);
    const items = (out.items || []) as unknown as RssItemMinimal[];
    return items.map((it) => it);
  } catch {
    return [];
  }
}

// ====== Pemetaan RSS → News/Event/Quote ======
function mapToNews(
  arr: RssItemMinimal[],
  source: string
): NewsItem[] {
  return arr
    .map<NewsItem | null>((it, idx) => {
      const title = (it.title || "").trim();
      const link = (it.link || "").trim();
      if (!title || !link) return null;

      const summary =
        (it.contentSnippet || it.content || "").replace(/\s+/g, " ").trim() ||
        undefined;
      const publishedAt = toIso(it.isoDate || it.pubDate);

      return {
        id: `${source}:${idx}:${link}`,
        title,
        source,
        publishedAt,
        link,
        summary,
        entities: [],
      };
    })
    .filter(Boolean) as NewsItem[];
}

function mapToEvents(
  news: NewsItem[]
): EventItem[] {
  // Heuristik: news yang terlihat seperti agenda/peresmian menjadi event
  return news
    .filter((n) =>
      looksLikeEvent(n.title, n.summary || "")
    )
    .map<EventItem>((n, i) => {
      const attended = isMinisterRelated(`${n.title} ${n.summary || ""}`);
      // lokasi tidak selalu ada; kosongkan
      return {
        id: `event:${i}:${n.link}`,
        title: n.title,
        date: n.publishedAt,
        location: "",
        attendedByMinister: attended,
        source: n.source,
        tags: [],
        summary: n.summary,
        link: n.link,
      };
    });
}

function mapToQuotes(news: NewsItem[]): QuoteItem[] {
  // Ekstraksi sederhana: kalimat ber-quote pada summary/title
  const out: QuoteItem[] = [];
  news.forEach((n, i) => {
    const pool = `${n.title}. ${n.summary || ""}`;
    const m = pool.match(/"([^"]{20,200})"/); // kalimat di antara tanda kutip
    if (m && m[1]) {
      const text = m[1].trim();
      out.push({
        id: `q:${i}:${n.link}`,
        text,
        speaker: isMinisterRelated(pool) ? "Menteri Perhubungan (Dudy Purwagandhi)" : "Narasumber",
        date: n.publishedAt,
        context: n.title,
        link: n.link,
        tags: ["Kutipan"],
      });
    }
  });
  return out;
}

// ====== Handler API ======
export async function GET(req: NextRequest) {
  // Query
  const { searchParams } = new URL(req.url);
  const range = (searchParams.get("range") || "7d") as "24h" | "7d" | "30d" | "90d";
  const onlyMinister = (searchParams.get("onlyMinister") || "true") === "true";
  const query = (searchParams.get("query") || "").trim();
  const types = (searchParams.get("types") || "news,events,quotes")
    .split(",")
    .map((s) => s.trim().toLowerCase());

  // Batas tanggal
  const now = new Date();
  const after = new Date(now);
  const mapDays: Record<string, number> = { "24h": 1, "7d": 7, "30d": 30, "90d": 90 };
  after.setDate(after.getDate() - (mapDays[range] ?? 7));

  // Ambil semua feed paralel
  const all: { by: string; items: RssItemMinimal[] }[] = [];
  await Promise.all(
    NEWS_FEEDS.map(async (f) => {
      const items = await fetchRssItems(f);
      all.push({ by: f.source, items });
    })
  );

  // Gabung & petakan → News
  let news: NewsItem[] = [];
  all.forEach((blk) => {
    news = news.concat(mapToNews(blk.items, blk.by));
  });

  // Filter waktu
  news = news.filter((n) => withinRange(n.publishedAt, after));

  // Filter query
  if (query) {
    const q = query.toLowerCase();
    news = news.filter((n) =>
      `${n.title} ${n.summary || ""} ${n.source}`.toLowerCase().includes(q)
    );
  }

  // Hanya berita terkait Menhub bila diminta
  if (onlyMinister) {
    news = news.filter((n) =>
      isMinisterRelated(`${n.title} ${n.summary || ""}`)
    );
  }

  // Events & Quotes
  let events: EventItem[] = [];
  let quotes: QuoteItem[] = [];
  if (types.includes("events") || types.includes("all")) {
    events = mapToEvents(news);
  }
  if (types.includes("quotes") || types.includes("all")) {
    quotes = mapToQuotes(news);
  }

  // Kumpulan tag sederhana (dari kategori RSS + heuristik)
  const tagSet = new Set<string>();
  news.forEach((n) => {
    (n.entities || []).forEach((t) => tagSet.add(t));
    if (looksLikeEvent(n.title, n.summary || "")) tagSet.add("Agenda");
    if (isMinisterRelated(`${n.title} ${n.summary || ""}`)) tagSet.add("Menhub");
  });

  return Response.json(
    {
      meta: {
        range,
        afterDate: after.toISOString(),
        generatedAt: now.toISOString(),
        sourcesTried: NEWS_FEEDS.length,
        newsCount: news.length,
        eventCount: events.length,
        quoteCount: quotes.length,
      },
      news: types.includes("news") || types.includes("all") ? news : [],
      events,
      quotes,
      tags: Array.from(tagSet),
    },
    { status: 200 }
  );
}
