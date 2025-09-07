/* eslint-disable @typescript-eslint/no-unused-vars */

import Parser from "rss-parser";
export const revalidate = 300; // 5 menit cache ISR

// ========== Types ==========
export type EventItem = {
  id: string;
  title: string;
  date: string; // ISO
  location: string;
  attendedByMinister: boolean;
  source: string;
  tags: string[];
  summary?: string;
  link: string;
};

export type NewsItem = {
  id: string;
  title: string;
  source: string;
  publishedAt: string; // ISO
  link: string;
  summary?: string;
  entities: string[];
};

export type QuoteItem = {
  id: string;
  text: string;
  speaker: string;
  date: string; // ISO
  context?: string;
  link: string;
  tags: string[];
};

type Combined = { kind: "news"; item: NewsItem } | { kind: "event"; item: EventItem } | { kind: "quote"; item: QuoteItem };

type ApiOk = {
  ok: true;
  meta: {
    range: string;
    generatedAt: string;
    srcCount: number;
    kept: { news: number; events: number; quotes: number; total: number };
    debug?: { fetched: number; afterDate: number; afterKeyword: number };
  };
  data: { news: NewsItem[]; events: EventItem[]; quotes: QuoteItem[] };
};
type ApiErr = { ok: false; error: string };

type RssFeed = { name: string; url: string };

// ========== Config ==========
const KEYWORDS = [
  "kemenhub",
  "kementerian perhubungan",
  "menhub",
  "menteri perhubungan",
  "dudy purwagandhi",
];

const EVENT_WORDS = [
  "agenda",
  "rapat",
  "rakor",
  "kunjungan",
  "meninjau",
  "peninjauan",
  "peresmian",
  "meresmikan",
  "peluncuran",
  "launching",
  "pembukaan",
  "penutupan",
  "menandatangani",
  "penandatanganan",
  "apel",
  "upacara",
];

const MODE_TAGS: Record<string, string[]> = {
  Darat: ["terminal", "bus", "jalan", "darat", "perhubungan darat", "angkot", "ojek"],
  Laut: ["pelayaran", "kapal", "pelabuhan", "laut", "ferry", "penyeberangan"],
  Udara: ["bandara", "penerbangan", "pesawat", "udara", "airnav"],
  Perkeretaapian: ["kereta", "kai", "stasiun", "lrt", "mrt", "jalur rel", "perkeretaapian"],
};

const FEEDS: RssFeed[] = [
  // Media besar nasional (stabil menyediakan RSS)
  { name: "Antara Nasional", url: "https://www.antaranews.com/rss/nasional" },
  { name: "Kompas News", url: "https://news.kompas.com/rss" },
  { name: "Tempo Nasional", url: "https://rss.tempo.co/nas" },
  { name: "Bisnis News", url: "https://www.bisnis.com/rss" },
  { name: "Detik News", url: "https://rss.detik.com/index.php/detiknews" },
  // Boleh tambah sumber lain di sini
];

// ========== Helpers ==========
const toISO = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString();

function minDateFromRange(range: string): Date {
  const d = new Date();
  const map: Record<string, number> = { "24h": 1, "7d": 7, "30d": 30, "90d": 90 };
  const days = map[range] ?? 7;
  d.setDate(d.getDate() - days);
  return d;
}

function hasKeyword(s: string): boolean {
  const text = s.toLowerCase();
  return KEYWORDS.some((k) => text.includes(k));
}

function guessTags(text: string): string[] {
  const t = text.toLowerCase();
  const tags: string[] = [];
  for (const [tag, words] of Object.entries(MODE_TAGS)) {
    if (words.some((w) => t.includes(w))) tags.push(tag);
  }
  return tags.length ? tags : ["Umum"];
}

function looksLikeEvent(text: string): boolean {
  const t = text.toLowerCase();
  return EVENT_WORDS.some((w) => t.includes(w));
}

function looksLikeQuote(title: string): boolean {
  // ada tanda kutip atau frasa "ujar/tegas/katanya"
  const t = title.toLowerCase();
  return /["“”]/.test(title) || /(ujar|tegas|ungkap|kata|menyebut)/.test(t);
}

// ========== RSS fetch ==========
type RssItemMinimal = { title?: string; link?: string; isoDate?: string; pubDate?: string; content?: string; contentSnippet?: string; };

async function fetchFeed(feed: RssFeed, signal: AbortSignal): Promise<RssItemMinimal[]> {
  const parser = new Parser();
  try {
    const out = await parser.parseURL(feed.url, { signal } as unknown as { signal: AbortSignal });
    // rss-parser types generic; kita ambil yang penting saja
    const items = (out.items || []) as unknown as RssItemMinimal[];
    return items.map((it) => it);
  } catch {
    return [];
  }
}

// ========== Main ==========
export async function GET(req: Request): Promise<Response> {
  try {
    const url = new URL(req.url);
    const range = (url.searchParams.get("range") || "7d").toLowerCase();
    const debugFlag = url.searchParams.get("debug") === "1";
    const minDate = minDateFromRange(range);

    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 12000); // 12s timeout

    // Fetch semua feed paralel
    const allItemsArrays = await Promise.all(FEEDS.map((f) => fetchFeed(f, ctrl.signal)));
    clearTimeout(t);

    const flat: RssItemMinimal[] = ([] as RssItemMinimal[]).concat(...allItemsArrays);
    const fetched = flat.length;

    // Normalisasi → seleksi by tanggal
    const afterDate = flat.filter((it) => {
      const dStr = it.isoDate || it.pubDate || "";
      const d = dStr ? new Date(dStr) : new Date();
      return d >= minDate;
    });

    // Seleksi by keyword (luas)
    const afterKeyword = afterDate.filter((it) => {
      const bank = [it.title || "", it.contentSnippet || "", it.content || ""].join(" ");
      return hasKeyword(bank);
    });

    // Mapping ke jenis
    const news: NewsItem[] = [];
    const events: EventItem[] = [];
    const quotes: QuoteItem[] = [];

    for (const it of afterKeyword) {
      const title = (it.title || "").trim();
      const link = it.link || "#";
      const dateStr = it.isoDate || it.pubDate || new Date().toISOString();
      const sourceHost = safeHostname(link);

      if (looksLikeQuote(title)) {
        // treat as quote
        const q: QuoteItem = {
          id: `q:${hash(title + link)}`,
          text: stripQuotes(title),
          speaker: "Menteri Perhubungan", // jika ingin lebih presisi perlu NER; sementara default
          date: toISO(new Date(dateStr)),
          context: sourceHost,
          link,
          tags: guessTags(title),
        };
        quotes.push(q);
        continue;
      }

      if (looksLikeEvent(title)) {
        const e: EventItem = {
          id: `e:${hash(title + link)}`,
          title,
          date: toISO(new Date(dateStr)),
          location: "-", // bisa diperkaya dari teks jika ada
          attendedByMinister: true,
          source: sourceHost,
          tags: guessTags(title),
          summary: it.contentSnippet || undefined,
          link,
        };
        events.push(e);
      } else {
        const n: NewsItem = {
          id: `n:${hash(title + link)}`,
          title,
          source: sourceHost,
          publishedAt: toISO(new Date(dateStr)),
          link,
          summary: it.contentSnippet || undefined,
          entities: ["Kemenhub"],
        };
        news.push(n);
      }
    }

    // Urutkan terbaru
    news.sort((a, b) => +new Date(b.publishedAt) - +new Date(a.publishedAt));
    events.sort((a, b) => +new Date(b.date) - +new Date(a.date));
    quotes.sort((a, b) => +new Date(b.date) - +new Date(a.date));

    const payload: ApiOk = {
      ok: true,
      meta: {
        range,
        generatedAt: toISO(new Date()),
        srcCount: FEEDS.length,
        kept: { news: news.length, events: events.length, quotes: quotes.length, total: news.length + events.length + quotes.length },
        debug: debugFlag ? { fetched, afterDate: afterDate.length, afterKeyword: afterKeyword.length } : undefined,
      },
      data: { news, events, quotes },
    };

    return Response.json(payload, { status: 200 });
  } catch (e) {
    const err: ApiErr = { ok: false, error: (e as Error).message || "Internal error" };
    return Response.json(err, { status: 500 });
  }
}

// ========== small utils ==========
function stripQuotes(s: string): string {
  return s.replace(/^[“"\s]+|[”"\s]+$/g, "");
}
function safeHostname(link: string): string {
  try {
    return new URL(link).hostname.replace(/^www\./, "");
  } catch {
    return "unknown";
  }
}
function hash(s: string): string {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h << 5) - h + s.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h).toString(36);
}
