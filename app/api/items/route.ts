/* eslint-disable @typescript-eslint/no-unused-vars */
import Parser from "rss-parser";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/** ===== Types ===== */
export type EventItem = {
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

export type NewsItem = {
  id: string;
  title: string;
  source: string;
  publishedAt: string; // ISO
  link: string;
  summary?: string;
  entities?: string[];
  tags?: string[]; // <-- tambahan: selalu diisi oleh API
};

export type QuoteItem = {
  id: string;
  text: string;
  speaker: string;
  date: string; // ISO
  context?: string;
  link: string;
  tags?: string[]; // <-- selalu diisi oleh API
};

export type ItemsResponse = {
  meta: {
    ok: boolean;
    generatedAt: string;
    sourcesTried: string[];
    sourcesOk: string[];
    note?: string;
  };
  news: NewsItem[];
  events: EventItem[];
  quotes: QuoteItem[];
};

/** ===== Utils ===== */
const UA =
  "Mozilla/5.0 (compatible; Kemenhub-CC/1.0; +https://example.invalid)";

function sinceDays(days: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d;
}

function minDateFromRange(key: string): Date {
  switch (key) {
    case "24h":
    case "1d":
      return sinceDays(1);
    case "7d":
      return sinceDays(7);
    case "30d":
      return sinceDays(30);
    case "90d":
      return sinceDays(90);
    default:
      return sinceDays(7);
  }
}

function parseDateGuess(s?: string): Date | null {
  if (!s) return null;
  const d = new Date(s);
  return Number.isNaN(+d) ? null : d;
}

const MENHUB_KEYWORDS = [
  "menteri perhubungan",
  "menhub",
  "dudy purwagandhi",
  "kemenhub",
  "kementerian perhubungan",
];

const EVENT_VERBS = [
  "meresmikan",
  "resmikan",
  "peresmian",
  "menghadiri",
  "hadiri",
  "meninjau",
  "tinjau",
  "melepas",
  "kunjungan",
  "rapat",
  "rakor",
  "meluncurkan",
  "launching",
  "dialog publik",
  "diskusi publik",
];

const TAG_MAP: Array<[string, RegExp]> = [
  ["Darat", /\b(bus|terminal|jalan tol|lalu lintas|angkutan jalan|angkot|ojek)\b/i],
  ["Laut", /\b(pelabuhan|kapal|pelayaran|laut|ferry|penyeberangan|bakauheni|merak)\b/i],
  ["Udara", /\b(bandara|penerbangan|pesawat|airnav|runway|ap ii|ap i)\b/i],
  ["Kereta", /\b(kereta|ka|stasiun|krl|lrt|mrt|kcic|whoosh)\b/i],
  ["Keselamatan", /\b(keselamatan|kecelakaan|audit|zero accident|penertiban)\b/i],
  ["Logistik", /\b(logistik|kontainer|kargo|supply chain)\b/i],
  ["Integrasi", /\b(integrasi|antarmoda|first mile|last mile|tiket terusan)\b/i],
  ["Regulasi", /\b(permenhub|aturan|regulasi|surat edaran|se)\b/i],
];

function titleCase(s: string) {
  return s
    .toLowerCase()
    .split(" ")
    .map((w) => (w.length ? w[0].toUpperCase() + w.slice(1) : w))
    .join(" ");
}

function extractTagsByRegex(text: string): string[] {
  const t: string[] = [];
  for (const [name, rx] of TAG_MAP) {
    if (rx.test(text)) t.push(name);
  }
  return t;
}

function normalizeTags(raw: string[]): string[] {
  const blacklist = new Set(
    MENHUB_KEYWORDS.map((x) => x.toLowerCase())
  );
  const unique = Array.from(
    new Set(
      raw
        .map((s) => s.trim())
        .filter(Boolean)
        .filter((s) => !blacklist.has(s.toLowerCase()))
    )
  );
  const pretty = unique.map(titleCase);
  return pretty.length ? pretty.slice(0, 8) : ["Umum"];
}

function mentionsMenhub(text: string): boolean {
  const hay = text.toLowerCase();
  return MENHUB_KEYWORDS.some((k) => hay.includes(k));
}

function looksLikeEvent(title: string, desc: string): boolean {
  const hay = `${title} ${desc}`.toLowerCase();
  return mentionsMenhub(hay) && EVENT_VERBS.some((v) => hay.includes(v));
}

function pickQuoteFrom(description: string, title: string): string | null {
  const desc = (description || "").replace(/\s+/g, " ").trim();
  const q1 = desc.match(/[“"']([^"”']{30,220})["”']/);
  if (q1?.[1]) return q1[1].trim();

  const sentences = desc.split(/(?<=[.!?])\s+/).slice(0, 8);
  const q2 = sentences.find(
    (s) =>
      mentionsMenhub(s) &&
      /\b(mengatakan|menyatakan|menegaskan|menjelaskan|ujar|kata)\b/i.test(s)
  );
  if (q2) return q2.trim();

  if (mentionsMenhub(title)) return title.trim();
  return null;
}

async function parseRss(url: string) {
  const parser = new Parser({
    headers: { "User-Agent": UA },
    customFields: { item: ["description", "contentSnippet"] },
    timeout: 8000,
  } as unknown as Parser.Options);
  return parser.parseURL(url);
}

function buildSources(): string[] {
  const q = encodeURIComponent(
    '(("Menteri Perhubungan" OR Menhub OR "Dudy Purwagandhi") AND (Kemenhub OR "Kementerian Perhubungan"))'
  );
  const base = "&hl=id&gl=ID&ceid=ID:id";
  return [
    `https://news.google.com/rss/search?q=${q}${base}`,
    `https://news.google.com/rss/search?q=${encodeURIComponent(
      'Kemenhub OR "Kementerian Perhubungan"'
    )}${base}`,
  ];
}

/** ===== GET ===== */
export async function GET(req: Request): Promise<Response> {
  const { searchParams } = new URL(req.url);
  const range = (searchParams.get("range") || "7d") as "24h" | "7d" | "30d" | "90d";
  const onlyMenhub = (searchParams.get("onlyMenhub") || "1") === "1";
  const q = (searchParams.get("q") || "").trim().toLowerCase();
  const types = (searchParams.get("types") || "news,events,quotes")
    .split(",")
    .map((s) => s.trim());

  const minDate = minDateFromRange(range);

  const sources = buildSources();
  const sourcesOk: string[] = [];
  const sourcesTried: string[] = [...sources];

  const news: NewsItem[] = [];
  const events: EventItem[] = [];
  const quotes: QuoteItem[] = [];

  const settled = await Promise.allSettled(sources.map((u) => parseRss(u)));

  settled.forEach((res, idx) => {
    if (res.status !== "fulfilled") return;
    sourcesOk.push(sources[idx]);
    const feed = res.value;

    for (const it of feed.items || []) {
      const published =
        parseDateGuess(it.isoDate || it.pubDate || (it as any).pubdate) || new Date();
      if (published < minDate) continue;

      const title = (it.title || "").trim();
      const link = (it.link || "").trim();
      const summary = (it.contentSnippet || (it as any)["description"] || "").trim();
      const sourceDomain = (feed.link || sources[idx]).replace(/^https?:\/\//, "");
      const hay = `${title} ${summary}`.toLowerCase();

      if (q && !hay.includes(q)) continue;

      const isMenhub = mentionsMenhub(hay);
      const isEvent = looksLikeEvent(title, summary);

      // tags: gabungan regex + kata kunci yang cocok
      const regexTags = extractTagsByRegex(hay);
      const menhubTags = MENHUB_KEYWORDS.filter((k) => hay.includes(k));
      const combinedTags = normalizeTags([...regexTags, ...menhubTags]);

      const entities = normalizeTags([...combinedTags]);

      if (types.includes("events") && isEvent) {
        const ev: EventItem = {
          id: `evt-${Math.random().toString(36).slice(2, 10)}`,
          title,
          date: published.toISOString(),
          location: "",
          attendedByMinister: isMenhub,
          source: sourceDomain,
          tags: combinedTags, // <-- selalu ada (minimal "Umum")
          summary,
          link,
        };
        if (!onlyMenhub || ev.attendedByMinister) events.push(ev);
      }

      if (types.includes("news")) {
        if (!onlyMenhub || isMenhub) {
          const n: NewsItem = {
            id: `news-${Math.random().toString(36).slice(2, 10)}`,
            title,
            source: sourceDomain,
            publishedAt: published.toISOString(),
            link,
            summary,
            entities,
            tags: combinedTags, // <-- tambahkan untuk tampilan chip
          };
          news.push(n);
        }
      }

      if (types.includes("quotes")) {
        if (!onlyMenhub || isMenhub) {
          const text = pickQuoteFrom(summary, title);
          if (text) {
            const qitem: QuoteItem = {
              id: `q-${Math.random().toString(36).slice(2, 10)}`,
              text,
              speaker: "Menteri Perhubungan",
              date: published.toISOString(),
              context: title,
              link,
              tags: combinedTags, // <-- tambahkan
            };
            quotes.push(qitem);
          }
        }
      }
    }
  });

  // sort terbaru
  news.sort((a, b) => +new Date(b.publishedAt) - +new Date(a.publishedAt));
  events.sort((a, b) => +new Date(b.date) - +new Date(a.date));
  quotes.sort((a, b) => +new Date(b.date) - +new Date(a.date));

  const payload: ItemsResponse = {
    meta: {
      ok: true,
      generatedAt: new Date().toISOString(),
      sourcesTried,
      sourcesOk,
      note:
        "Live dari Google News RSS (kueri Menhub/Dudy/Kemenhub). Event=heuristik (kata kerja + menyebut Menhub).",
    },
    news,
    events,
    quotes,
  };

  return Response.json(payload, { status: 200 });
}
