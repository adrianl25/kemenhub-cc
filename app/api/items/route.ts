import Parser from "rss-parser";
import { NextResponse } from "next/server";

// ===== Types =====
export type EventItem = {
  id: string;
  title: string;
  date: string; // ISO
  location: string;
  attendedByMinister: boolean;
  source: string;
  tags: string[];
  summary: string;
  link: string;
};

export type NewsItem = {
  id: string;
  title: string;
  source: string;
  publishedAt: string; // ISO
  link: string;
  summary: string;
  entities: string[];
};

export type QuoteItem = {
  id: string;
  text: string;
  speaker: string;
  date: string; // ISO
  context: string;
  link: string;
  tags: string[];
};

export type ApiPayload = {
  news: NewsItem[];
  events: EventItem[];
  quotes: QuoteItem[];
  meta: {
    generatedAt: string;
    range: "24h" | "7d" | "30d" | "90d";
    sourceCount: number;
  };
};

// ===== Constants =====
const MENHUB_NAME = "Dudy Purwagandhi";
const NAME_ALIASES: ReadonlyArray<string> = [
  "Menhub",
  "Menteri Perhubungan",
  "Kemenhub",
  "Kementerian Perhubungan",
  MENHUB_NAME,
];

// Feeds stabil
const FEEDS: ReadonlyArray<{ name: string; url: string }> = [
  { name: "Antara", url: "https://www.antaranews.com/rss/terkini.xml" },
  { name: "Tempo", url: "https://rss.tempo.co/nasional" },
  { name: "Kompas", url: "https://news.kompas.com/getrss/nasional" },
  { name: "Detik", url: "https://rss.detik.com/index.php/detikcom" },
];

// ===== Helpers (strictly typed) =====
type FeedItem = {
  title?: string;
  link?: string;
  isoDate?: string;
  contentSnippet?: string;
  content?: string;
  pubDate?: string;
  categories?: string[];
  creator?: string;
  guid?: string;
};

type ParsedFeed = {
  title?: string;
  items: FeedItem[];
};

const parser = new Parser<unknown, FeedItem>();

function normStr(v: unknown): string {
  return typeof v === "string" ? v : "";
}

function toISO(input: string | undefined): string {
  const s = input ?? "";
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
}

function withinRange(iso: string, minDate: Date): boolean {
  return new Date(iso).getTime() >= minDate.getTime();
}

function getMinDate(range: "24h" | "7d" | "30d" | "90d"): Date {
  const d = new Date();
  const map: Record<"24h" | "7d" | "30d" | "90d", number> = {
    "24h": 1,
    "7d": 7,
    "30d": 30,
    "90d": 90,
  };
  d.setDate(d.getDate() - map[range]);
  return d;
}

function hasMenhubSignal(s: string): boolean {
  const low = s.toLowerCase();
  return NAME_ALIASES.some((kw) => low.includes(kw.toLowerCase()));
}

const EVENT_HINTS: ReadonlyArray<string> = [
  "peresmian",
  "meresmikan",
  "meninjau",
  "kunjungan",
  "rapat",
  "rakor",
  "mengecek",
  "tinjau",
  "menyaksikan",
];

function looksLikeEvent(text: string): boolean {
  const low = text.toLowerCase();
  return EVENT_HINTS.some((w) => low.includes(w));
}

function inferTags(text: string): string[] {
  const low = text.toLowerCase();
  const t: string[] = [];
  if (low.includes("kereta") || /\bka\b/.test(low)) t.push("Perkeretaapian");
  if (low.includes("bandara") || low.includes("udara") || low.includes("penerbangan")) t.push("Udara");
  if (low.includes("pelabuhan") || low.includes("laut") || low.includes("pelayaran")) t.push("Laut");
  if (low.includes("terminal") || low.includes("jalan") || low.includes("angkutan")) t.push("Darat");
  return t.length ? t : ["Umum"];
}

async function fetchFeed(url: string): Promise<ParsedFeed> {
  const feed = await parser.parseURL(url);
  return { title: feed.title, items: feed.items };
}

async function gather(range: "24h" | "7d" | "30d" | "90d"): Promise<ApiPayload> {
  const minDate = getMinDate(range);
  const news: NewsItem[] = [];
  const events: EventItem[] = [];
  const quotes: QuoteItem[] = [];

  const results: PromiseSettledResult<ParsedFeed>[] = await Promise.allSettled(
    FEEDS.map((f) => fetchFeed(f.url))
  );

  for (let i = 0; i < results.length; i += 1) {
    const res = results[i];
    const sourceName = FEEDS[i]?.name ?? "Unknown";
    if (res.status !== "fulfilled") continue;

    const feed = res.value;
    for (const item of feed.items) {
      const title = normStr(item.title);
      const link = normStr(item.link);
      const snippet = normStr(item.contentSnippet) || normStr(item.content);
      const iso = toISO(item.isoDate ?? item.pubDate);
      if (!withinRange(iso, minDate)) continue;

      const joined = `${title} ${snippet}`;
      const isMenhub = hasMenhubSignal(joined);

      // Push News (umum)
      news.push({
        id: (item.guid || link || `${sourceName}-${iso}`) + "-n",
        title: title || "(Tanpa judul)",
        source: sourceName,
        publishedAt: iso,
        link: link || "#",
        summary: snippet || title || "",
        entities: inferTags(joined),
      });

      // Event bila kuat indikasi kegiatan + Menhub
      if (isMenhub && looksLikeEvent(joined)) {
        events.push({
          id: (item.guid || link || `${sourceName}-${iso}`) + "-e",
          title: title || "(Kegiatan Menhub)",
          date: iso,
          location: "",
          attendedByMinister: true,
          source: sourceName,
          tags: inferTags(joined),
          summary: snippet || title || "",
          link: link || "#",
        });
      }

      // Quote (sederhana): cari kalimat di dalam tanda kutip
      if (isMenhub && snippet) {
        const m = snippet.match(/["“”](.+?)["“”]/);
        if (m && m[1]) {
          quotes.push({
            id: (item.guid || link || `${sourceName}-${iso}`) + "-q",
            text: m[1],
            speaker: MENHUB_NAME,
            date: iso,
            context: title || "",
            link: link || "#",
            tags: ["Kutipan", ...inferTags(joined)],
          });
        }
      }
    }
  }

  const byTimeDesc = <T extends { publishedAt?: string; date?: string }>(a: T, b: T) => {
    const ta = new Date(a.publishedAt ?? a.date ?? 0).getTime();
    const tb = new Date(b.publishedAt ?? b.date ?? 0).getTime();
    return tb - ta;
  };

  news.sort(byTimeDesc);
  events.sort(byTimeDesc);
  quotes.sort(byTimeDesc);

  return {
    news,
    events,
    quotes,
    meta: {
      generatedAt: new Date().toISOString(),
      range,
      sourceCount: FEEDS.length,
    },
  };
}

// ISR/Cache hint
export const revalidate = 60;

// ===== Route =====
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const rangeParam =
    (searchParams.get("range") as "24h" | "7d" | "30d" | "90d") || "7d";

  try {
    const data = await gather(rangeParam);
    return NextResponse.json<ApiPayload>(data, { status: 200 });
  } catch (err) {
    return NextResponse.json(
      { error: "fetch_failed", message: String(err) },
      { status: 500 }
    );
  }
}
