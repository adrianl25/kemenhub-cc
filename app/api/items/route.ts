// Jalankan di Node runtime (wajib untuk rss-parser di Vercel)
export const runtime = "nodejs";
// Cache ISR 5 menit (boleh Anda ubah)
export const revalidate = 300;

import Parser from "rss-parser";

// ============================
// Tipe data OUTPUT (ke frontend)
// ============================
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

type ItemsResponse = {
  news: NewsItem[];
  events: EventItem[];
  quotes: QuoteItem[];
};

// ============================
// Sumber RSS (bisa ditambah)
// ============================
const FEEDS: Array<{ name: string; url: string }> = [
  { name: "Antara Nasional", url: "https://www.antaranews.com/rss/nasional" },
  { name: "Kompas News", url: "https://news.kompas.com/rss" },
  { name: "Tempo Nasional", url: "https://rss.tempo.co/nasional" },
  { name: "Bisnis Nasional", url: "https://www.bisnis.com/rss/nasional" },
  // Tambah RSS resmi Kemenhub jika tersedia
];

// Kata kunci “aktor” (buat filter spesifik Menhub)
const ACTOR_KEYWORDS = [
  "Dudy Purwagandhi",
  "Menteri Perhubungan",
  "Menhub",
  "Kemenhub",
  "Kementerian Perhubungan",
];

// Peta domain transport -> tag
const DOMAIN_TAGS: Record<string, string> = {
  darat: "Darat",
  jalan: "Darat",
  tol: "Darat",
  bus: "Darat",
  "terminal tipe a": "Darat",
  "angkutan umum": "Darat",
  lrt: "Rel",
  mrt: "Rel",
  "kereta": "Rel",
  "kereta api": "Rel",
  "kci": "Rel",
  "kai": "Rel",
  pelabuhan: "Laut",
  kapal: "Laut",
  pelayaran: "Laut",
  dermaga: "Laut",
  bandara: "Udara",
  "bandar udara": "Udara",
  pesawat: "Udara",
  penerbangan: "Udara",
  "angkasa pura": "Udara",
  "bus listrik": "Green",
  listrik: "Green",
  emisi: "Green",
  "transportasi hijau": "Green",
  "green transport": "Green",
  integrasi: "Integrasi Moda",
  "antarmoda": "Integrasi Moda",
};

// Heuristik event verbs (dilonggarkan + sinonim)
const EVENT_VERBS = [
  "meresmikan", "peresmian",
  "meninjau", "peninjauan", "kunjungan", "meninjau",
  "menghadiri", "hadir",
  "rapat", "memimpin", "membuka", "pembukaan",
  "meluncurkan", "peluncuran", "melantik", "apel", "pemaparan", "kick off", "soft launching", "groundbreaking"
];

// Ambil kutipan dari teks
function extractQuotesFromText(text: string): string[] {
  const out: string[] = [];
  // 1) Tanda kutip "
  const reQuoted = /"([^"]{20,300})"/g;
  let m: RegExpExecArray | null;
  while ((m = reQuoted.exec(text)) !== null) {
    const q = m[1].trim();
    if (q) out.push(q);
  }
  // 2) Tanda kutip gaya lain “...”
  const reCurly = /[“”]([^“”]{20,300})[“”]/g;
  while ((m = reCurly.exec(text)) !== null) {
    const q = m[1].trim();
    if (q) out.push(q);
  }
  // 3) Kalimat setelah kata kunci ujar/tegas/menurut/kata/ungkap
  const cueWords = ["ujar", "tegas", "menurut", "kata", "ungkap"];
  const lower = text.toLowerCase();
  for (const cue of cueWords) {
    const idx = lower.indexOf(`${cue} `);
    if (idx !== -1) {
      const sub = text.slice(idx);
      const sent = sub.split(/[.!?]/)[0] ?? "";
      const cleaned = sent.replace(/^[^"]*["“”]?/g, "").trim();
      if (cleaned.length >= 20 && cleaned.length <= 300) {
        out.push(cleaned);
      }
    }
  }
  return out;
}

// ============================
// Helper util
// ============================
function toISO(d: Date | string | undefined): string {
  if (!d) return new Date().toISOString();
  try { return new Date(d).toISOString(); } catch { return new Date().toISOString(); }
}
function withinHours(dateISO: string, hours: number): boolean {
  const now = Date.now();
  const t = new Date(dateISO).getTime();
  const diffHrs = (now - t) / (1000 * 60 * 60);
  return diffHrs <= hours;
}
function hasAny(str: string, words: string[]): boolean {
  const s = str.toLowerCase();
  for (const w of words) {
    if (w && s.includes(w.toLowerCase())) return true;
  }
  return false;
}
function dedupBy<T>(arr: T[], keyFn: (x: T) => string): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const it of arr) {
    const k = keyFn(it);
    if (!seen.has(k)) {
      seen.add(k);
      out.push(it);
    }
  }
  return out;
}
function inferDomainTags(text: string): string[] {
  const s = text.toLowerCase();
  const tags = new Set<string>();
  for (const key in DOMAIN_TAGS) {
    if (s.includes(key)) tags.add(DOMAIN_TAGS[key]);
  }
  return [...tags];
}

// ============================
// Fetch semua feed
// ============================
const parser = new Parser({
  headers: {
    "User-Agent": "Kemenhub-CC/1.0 (+https://vercel.com) rss-parser node server",
  },
});

async function fetchAllFeeds(hours: number, keywords: string[], debugMode: boolean): Promise<ItemsResponse> {
  const news: NewsItem[] = [];
  const events: EventItem[] = [];
  const quotes: QuoteItem[] = [];

  for (const f of FEEDS) {
    try {
      const feed = await parser.parseURL(f.url);
      for (const item of feed.items) {
        const title = (item.title ?? "").trim();
        const link = (item.link ?? "").trim();
        const source = f.name;
        const pubISO = toISO((item as unknown as { isoDate?: string }).isoDate ?? (item.pubDate as string | undefined));
        const summary = ((item.contentSnippet ?? item.content ?? "") as string).replace(/\s+/g, " ").trim();
        const textPool = `${title}. ${summary} — ${source}`;

        // Rentang waktu
        if (!withinHours(pubISO, hours)) continue;

        // Filter spesifik (kecuali debug)
        if (!debugMode && !hasAny(textPool, keywords)) continue;

        // Entities = ACTOR_KEYWORDS yang match + tag domain
        const entitiesMatched = ACTOR_KEYWORDS.filter(k => textPool.toLowerCase().includes(k.toLowerCase()));
        const domainTags = inferDomainTags(textPool);

        // ------ NEWS ------
        const n: NewsItem = {
          id: `${source}:${link || title}:${pubISO}`,
          title,
          source,
          publishedAt: pubISO,
          link: link || "#",
          summary,
          entities: [...new Set([...entitiesMatched, ...domainTags])],
        };
        news.push(n);

        // ------ EVENTS (heuristik dilonggarkan) ------
        // Event bila mengandung salah satu EVENT_VERBS ATAU (entitiesMatched memuat Menhub/dll dan ada domain tag)
        const isEvent =
          hasAny(textPool, EVENT_VERBS) ||
          (entitiesMatched.length > 0 && domainTags.length > 0);

        if (isEvent) {
          const eTags = new Set<string>(["Event", ...domainTags]);
          if (entitiesMatched.length > 0) eTags.add("Menhub");

          const e: EventItem = {
            id: `evt:${n.id}`,
            title,
            date: pubISO,
            location: "", // bisa ditingkatkan dengan regex alamat jika ada
            attendedByMinister: hasAny(textPool, ["Menteri Perhubungan", "Menhub", "Dudy Purwagandhi"]),
            source,
            tags: [...eTags],
            summary,
            link: link || "#",
          };
          events.push(e);
        }

        // ------ QUOTES (otomatis dari teks bila ada) ------
        const foundQuotes = extractQuotesFromText(`${title}. ${summary}`);
        for (const qt of foundQuotes) {
          if (qt.length < 30 || qt.length > 280) continue;
          const qTags = new Set<string>(["Kutipan", ...domainTags]);
          if (entitiesMatched.length > 0) qTags.add("Menhub");

          const q: QuoteItem = {
            id: `q:${n.id}:${qt.slice(0, 24)}`,
            text: qt,
            speaker: hasAny(textPool, ["Menteri Perhubungan", "Menhub", "Dudy Purwagandhi"]) ? "Menteri Perhubungan" : "Narasumber",
            date: pubISO,
            context: title,
            link: link || "#",
            tags: [...qTags],
          };
          quotes.push(q);
        }
      }
    } catch {
      // lanjut feed berikutnya jika gagal
      continue;
    }
  }

  // De-dup & sort
  const dedupedNews = dedupBy(news, (x) => `${x.title}|${x.publishedAt}`);
  const dedupedEvents = dedupBy(events, (x) => `${x.title}|${x.date}`);
  const dedupedQuotes = dedupBy(quotes, (x) => `${x.text}|${x.date}`);

  dedupedNews.sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());
  dedupedEvents.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  dedupedQuotes.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return { news: dedupedNews, events: dedupedEvents, quotes: dedupedQuotes };
}

// ============================
// HTTP handler
// ============================
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const hoursParam = url.searchParams.get("hours");
    const typesParam = url.searchParams.get("types"); // "news,events,quotes"
    const debugParam = url.searchParams.get("debug"); // "1" = lepas filter spesifik
    const qParam = url.searchParams.get("q"); // kata kunci kustom (dipisah koma)

    // Rentang default 24 jam (maks 90 hari)
    const hoursNum = Number(hoursParam ?? "24");
    const hours = Math.max(1, Math.min(24 * 90, Number.isFinite(hoursNum) ? hoursNum : 24));

    // Kata kunci: q kustom (kalau ada) -> kalau tidak, pakai ACTOR_KEYWORDS
    const custom = (qParam ? qParam.split(",") : []).map((s) => s.trim()).filter(Boolean);
    const keywords = custom.length > 0 ? custom : ACTOR_KEYWORDS;

    const debugMode = debugParam === "1";

    const items = await fetchAllFeeds(hours, keywords, debugMode);

    const wants = new Set<string>(
      (typesParam ?? "news,events,quotes")
        .split(",")
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean)
    );

    const body: ItemsResponse = {
      news: wants.has("news") ? items.news : [],
      events: wants.has("events") ? items.events : [],
      quotes: wants.has("quotes") ? items.quotes : [],
    };

    return new Response(JSON.stringify(body), {
      headers: { "content-type": "application/json; charset=utf-8" },
      status: 200,
    });
  } catch {
    const empty: ItemsResponse = { news: [], events: [], quotes: [] };
    return new Response(JSON.stringify(empty), {
      headers: { "content-type": "application/json; charset=utf-8" },
      status: 200,
    });
  }
}
