/* eslint-disable @typescript-eslint/no-explicit-any */
import Parser from "rss-parser";

export const revalidate = 300; // cache 5 menit

// ====== Types ======
type NewsItem = {
  id: string;
  title: string;
  source: string;
  publishedAt: string;
  link: string;
  summary?: string;
  entities?: string[];
};

type EventItem = {
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

type QuoteItem = {
  id: string;
  text: string;
  speaker: string;
  date: string;
  context?: string;
  link: string;
  tags?: string[];
};

// ====== Helpers ======
const toISO = (d: Date) => d.toISOString();

function extractEntities(text: string): string[] {
  const entities: string[] = [];
  if (/menhub|menteri perhubungan|dudy\s+purwagandhi/i.test(text)) {
    entities.push("Menteri Perhubungan");
  }
  if (/bandara|penerbangan|pesawat/i.test(text)) {
    entities.push("Udara");
  }
  if (/pelabuhan|laut|kapal/i.test(text)) {
    entities.push("Laut");
  }
  if (/terminal|bus|jalan|darat/i.test(text)) {
    entities.push("Darat");
  }
  if (/kereta|rel|stasiun/i.test(text)) {
    entities.push("Kereta Api");
  }
  return entities;
}

// ====== Promote News to Events ======
const EVENT_VERBS = [
  "peresmian",
  "meresmikan",
  "launching",
  "kunjungan kerja",
  "meninjau",
  "rapat",
  "rakor",
  "seminar",
  "forum",
  "penandatanganan",
  "kick off",
];

const WILL_WORDS = ["akan", "besok", "pekan depan", "minggu depan"];

function looksLikeEvent(title: string, summary: string): boolean {
  const t = (title + " " + summary).toLowerCase();
  if (EVENT_VERBS.some((v) => t.includes(v))) return true;
  if (WILL_WORDS.some((w) => t.includes(` ${w} `))) return true;
  if (/\b([0-3]?\d)[\/\-]([01]?\d)(?:[\/\-]\d{2,4})?\b/.test(t)) return true; // 12/09/2025
  if (/\b([0-3]?\d)\s+(jan|feb|mar|apr|mei|jun|jul|agu|sep|okt|nov|des)\w*/i.test(t))
    return true;
  return false;
}

function guessLocation(text: string): string {
  const m = text.match(/\bdi\s+([A-Z][A-Za-z\-\s']{2,50})/);
  return m ? m[1].trim() : "—";
}

function promoteNewsToEvents(news: NewsItem[], since: Date): EventItem[] {
  const out: EventItem[] = [];
  for (const n of news) {
    const sum = n.summary || "";
    if (!looksLikeEvent(n.title, sum)) continue;

    const attended = /menhub|menteri perhubungan|dudy\s+purwagandhi/i.test(
      `${n.title} ${sum}`
    );

    const dt = new Date(n.publishedAt); // pakai const, bukan let
    if (/\b(akan|besok)\b/i.test(`${n.title} ${sum}`)) {
      dt.setDate(dt.getDate() + 1);
    }
    if (dt < since) continue;

    const loc = guessLocation(`${n.title} ${sum}`);
    const tags = extractEntities(`${n.title} ${sum}`);

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

  // urut terbaru
  out.sort((a, b) => +new Date(b.date) - +new Date(a.date));
  // deduplicate
  const uniq = new Map<string, EventItem>();
  for (const e of out) uniq.set(`${e.title}|${e.date}`, e);
  return Array.from(uniq.values());
}

// ====== Quote extractor ======
function extractQuotesFromNews(news: NewsItem[], since: Date): QuoteItem[] {
  const out: QuoteItem[] = [];
  for (const n of news) {
    if (!/menhub|menteri perhubungan|dudy\s+purwagandhi/i.test(n.title + " " + n.summary))
      continue;
    if (new Date(n.publishedAt) < since) continue;

    out.push({
      id: `q-${n.id}`,
      text: n.summary || n.title,
      speaker: "Menteri Perhubungan RI (Dudy Purwagandhi)",
      date: n.publishedAt,
      context: n.title,
      link: n.link,
      tags: ["Menhub", ...(n.entities || [])],
    });
  }
  return out;
}

// ====== Main Handler ======
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const days = parseInt(searchParams.get("days") || "7", 10);
  const types = (searchParams.get("types") || "news,events,quotes")
    .split(",")
    .map((s) => s.trim());

  const since = new Date();
  since.setDate(since.getDate() - days);

  const parser: any = new Parser();
  const feeds = [
    { url: "https://www.antaranews.com/rss/terkini", source: "Antara" },
    { url: "https://rss.kompas.com/kompascom", source: "Kompas" },
    { url: "https://rss.tempo.co/nasional", source: "Tempo" },
  ];

  const newsAll: NewsItem[] = [];
  for (const f of feeds) {
    try {
      const feed = await parser.parseURL(f.url);
      for (const item of feed.items) {
        const published = item.isoDate || item.pubDate;
        if (!published) continue;
        const dt = new Date(published);
        if (dt < since) continue;
        if (!item.title) continue;

        const text = `${item.title} ${item.contentSnippet || ""}`;
        const entities = extractEntities(text);
        newsAll.push({
          id: `${f.source}-${dt.getTime()}`,
          title: item.title,
          source: f.source,
          publishedAt: toISO(dt),
          link: item.link || "#",
          summary: item.contentSnippet || "",
          entities,
        });
      }
    } catch (e) {
      console.error("RSS error", f.url, e);
    }
  }

  // Derive events & quotes
  let eventsAll: EventItem[] = [];
  let quotesAll: QuoteItem[] = [];
  if (types.includes("events")) {
    eventsAll = promoteNewsToEvents(newsAll, since);
  }
  if (types.includes("quotes")) {
    quotesAll = extractQuotesFromNews(newsAll, since);
  }

  const out: Record<string, any> = {};
  if (types.includes("news")) out.news = newsAll;
  if (types.includes("events")) out.events = eventsAll;
  if (types.includes("quotes")) out.quotes = quotesAll;

  return new Response(JSON.stringify(out, null, 2), {
    headers: { "content-type": "application/json" },
  });
}
