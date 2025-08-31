// app/api/items/route.ts
// LIVE aggregator Menhub/Kemenhub via RSS (Google News + media nasional).
// Next.js App Router (Route Handler). Cache sisi server 60 detik.

import Parser from "rss-parser";

export const revalidate = 60;

// ---------- Types ----------
type RawItem = {
  title?: string;
  link?: string;
  isoDate?: string;
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

const parser = new Parser({
  timeout: 10000,
  headers: { "user-agent": "kemenhub-cc/1.0" },
});

// ---------- Kata kunci (relevansi) ----------
const KW = [
  "menhub",
  "menteri perhubungan",
  "kemenhub",
  "kementerian perhubungan",
  "dudy purwagandhi",
];

function looksRelevant(title = "", snippet = "", source = ""): boolean {
  const hay = `${title} ${snippet} ${source}`.toLowerCase();
  return KW.some((k) => hay.includes(k));
}

function unwrapGoogleNewsLink(href: string | undefined): string {
  if (!href) return "";
  try {
    const u = new URL(href);
    const direct = u.searchParams.get("url");
    if (direct) return direct;
  } catch {}
  return href;
}

function normDate(d?: string): string {
  const iso = d ? new Date(d) : new Date();
  return new Date(iso).toISOString();
}

function sourceFromLink(href: string): string {
  try {
    const u = new URL(href);
    return u.hostname.replace(/^www\./, "");
  } catch {
    return "unknown";
  }
}

// ---------- FEEDS ----------
const GN_MAIN =
  "https://news.google.com/rss/search?q=%28%22Menteri%20Perhubungan%22%20OR%20Menhub%20OR%20Kemenhub%20OR%20%22Dudy%20Purwagandhi%22%29+when:7d&hl=id&gl=ID&ceid=ID:id";

const GN_DEPHUB =
  "https://news.google.com/rss/search?q=%28%22Menteri%20Perhubungan%22%20OR%20Menhub%20OR%20Kemenhub%29+site:dephub.go.id+OR+site:kemenhub.go.id+OR+site:hubud.kemenhub.go.id+when:30d&hl=id&gl=ID&ceid=ID:id";

const ANTARA_TOP = "https://www.antaranews.com/rss/top-news";
const DETIK_BERITA = "https://news.detik.com/berita/rss";
const KOMPAS_ROOT = "https://rss.kompas.com/";

// ---------- Helpers ----------
async function grab(feedUrl: string): Promise<RawItem[]> {
  try {
    const res = await fetch(feedUrl, { cache: "no-store" });
    const xml = await res.text();
    const out = await parser.parseString(xml);
    return ((out as unknown as { items?: RawItem[] }).items ?? []) as RawItem[];
  } catch {
    return [];
  }
}

function mapToNews(items: RawItem[]): NewsOut[] {
  return items
    .map((it, idx) => {
      const link = unwrapGoogleNewsLink(it.link);
      const title = (it.title || "").trim();
      const summary = (it.contentSnippet || "").trim();
      return {
        id: `news-${(it.isoDate || it.pubDate || "")}-${idx}`,
        title,
        source: sourceFromLink(link),
        publishedAt: normDate(it.isoDate || it.pubDate),
        link,
        summary,
        entities: ["Menteri Perhubungan"],
      };
    })
    .filter((n) => looksRelevant(n.title, n.summary, n.source));
}

function uniqBy<T extends { link: string }>(arr: T[]): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const a of arr) {
    const k = a.link || "";
    if (!seen.has(k)) {
      seen.add(k);
      out.push(a);
    }
  }
  return out;
}

function toEvent(n: NewsOut): EventOut {
  return {
    id: `evt-${n.id}`,
    title: n.title,
    date: n.publishedAt,
    location: "Indonesia",
    attendedByMinister: true,
    source: n.source,
    tags: ["Agenda", "Menhub"],
    summary: n.summary,
    link: n.link,
  };
}

function extractQuote(n: NewsOut): QuoteOut | null {
  const textSrc = `${n.title}. ${n.summary ?? ""}`;
  const m =
    textSrc.match(/"([^"]{10,200})"/) || textSrc.match(/“([^”]{10,200})”/);
  if (!m) return null;
  const text = m[1].trim();
  return {
    id: `q-${n.id}`,
    text,
    speaker: "Menteri Perhubungan",
    date: n.publishedAt,
    context: n.source,
    link: n.link,
    tags: ["Kutipan", "Menhub"],
  };
}

// ---------- Handler ----------
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const typesRaw = (searchParams.get("types") || "news,events,quotes")
    .split(",")
    .map((s) => s.trim().toLowerCase());
  const sinceDays = Math.max(
    1,
    Math.min(90, Number(searchParams.get("sinceDays")) || 7)
  );
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - sinceDays);

  // Ambil feed paralel
  const [gn, gnDept, ant, detik, kompas] = await Promise.all([
    grab(GN_MAIN),
    grab(GN_DEPHUB),
    grab(ANTARA_TOP),
    grab(DETIK_BERITA),
    grab(KOMPAS_ROOT),
  ]);

  // Normalisasi -> News
  const news = uniqBy(
    [
      ...mapToNews(gn),
      ...mapToNews(ant),
      ...mapToNews(detik),
      ...mapToNews(kompas),
    ].filter((n) => new Date(n.publishedAt) >= cutoff)
  ).sort((a, b) => +new Date(b.publishedAt) - +new Date(a.publishedAt));

  // Events dari domain Kemenhub
  const events = uniqBy(mapToNews(gnDept))
    .filter((n) => new Date(n.publishedAt) >= cutoff)
    .map(toEvent)
    .sort((a, b) => +new Date(b.date) - +new Date(a.date));

  // Quotes dari News
  const quotes = news
    .map(extractQuote)
    .filter((q): q is QuoteOut => Boolean(q))
    .slice(0, 20);

  const payload = {
    news: typesRaw.includes("news") ? news : [],
    events: typesRaw.includes("events") ? events : [],
    quotes: typesRaw.includes("quotes") ? quotes : [],
  };

  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}
