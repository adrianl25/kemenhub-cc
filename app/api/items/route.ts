/* eslint-disable @typescript-eslint/no-unused-vars */
import Parser from "rss-parser";

// Revalidate ISR setiap 5 menit (sesuaikan kebutuhan)
export const revalidate = 300;

// ============================
// Types (OUTPUT ke Frontend)
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
// Konfigurasi Sumber RSS
// Catatan: daftar ini bisa ditambah/kurangi kapan saja.
// ============================
const FEEDS: Array<{ name: string; url: string }> = [
  // Media nasional (umum)
  { name: "Antara Nasional", url: "https://www.antaranews.com/rss/nasional" },
  { name: "Kompas News", url: "https://news.kompas.com/rss" },
  { name: "Tempo Nasional", url: "https://rss.tempo.co/nasional" },
  { name: "Bisnis.com Nasional", url: "https://www.bisnis.com/rss/nasional" },
  // Portal Kemenhub (bila RSS tersedia — placeholder di bawah)
  // Jika Kemenhub punya RSS resmi, tambahkan di sini.
  // { name: "Kemenhub Siaran Pers", url: "https://dephub.go.id/rss/siaran-pers" },
];

// Kata kunci agar hasil relevan dgn Menhub RI saat ini
const MINISTER_KEYWORDS = [
  "Dudy Purwagandhi",
  "Menteri Perhubungan",
  "Menhub",
  "Kemenhub",
  "Kementerian Perhubungan",
];

const EVENT_VERBS = [
  "meresmikan",
  "peresmian",
  "meninjau",
  "peninjauan",
  "menghadiri",
  "hadir",
  "rapat",
  "kunjungan",
  "melantik",
  "meluncurkan",
  "peluncuran",
  "membuka",
  "pembukaan",
];

// ============================
// Helper
// ============================
const parser = new Parser({
  headers: {
    // Sebagian sumber memerlukan UA
    "User-Agent":
      "Kemenhub-CC/1.0 (+https://vercel.com) rss-parser node server",
  },
});

function toISO(d: Date | string | undefined): string {
  if (!d) return new Date().toISOString();
  try {
    return new Date(d).toISOString();
  } catch {
    return new Date().toISOString();
  }
}

function withinHours(dateISO: string, hours: number): boolean {
  const now = Date.now();
  const dt = new Date(dateISO).getTime();
  const diffHrs = (now - dt) / (1000 * 60 * 60);
  return diffHrs <= hours;
}

function hasAny(str: string, words: string[]): boolean {
  const s = str.toLowerCase();
  return words.some((w) => s.includes(w.toLowerCase()));
}

// Ambil daftar RSS, gabungkan, lalu filter
async function fetchAllFeeds(hours: number): Promise<ItemsResponse> {
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
        const pubISO = toISO(item.isoDate ?? (item.pubDate as string | undefined));
        const summary = ((item.contentSnippet ?? item.content ?? "") as string)
          .replace(/\s+/g, " ")
          .trim();

        // Filter waktu
        if (!withinHours(pubISO, hours)) continue;

        const textPool = `${title} ${summary} ${source}`;
        if (!hasAny(textPool, MINISTER_KEYWORDS)) {
          // Lewatkan berita yg tidak menyebut Menhub/Kemenhub
          continue;
        }

        // Tambah ke NEWS
        const n: NewsItem = {
          id: `${source}:${link || title}:${pubISO}`,
          title,
          source,
          publishedAt: pubISO,
          link: link || "#",
          summary,
          entities: MINISTER_KEYWORDS.filter((k) =>
            textPool.toLowerCase().includes(k.toLowerCase())
          ),
        };
        news.push(n);

        // Klasifikasi sederhana -> EVENTS (heuristik dari kata kerja peristiwa)
        if (hasAny(textPool, EVENT_VERBS)) {
          const e: EventItem = {
            id: `evt:${n.id}`,
            title,
            date: pubISO,
            location: "",
            attendedByMinister: hasAny(textPool, ["Menteri Perhubungan", "Menhub", "Dudy Purwagandhi"]),
            source,
            tags: ["Event"],
            summary,
            link: link || "#",
          };
          events.push(e);
        }

        // Ekstraksi "quotes" sederhana (heuristik)
        // Ambil kalimat di-quote atau kalimat setelah kata "menurut/ujar/kata" dsb.
        const possibleQuotes = extractQuotesFromText(`${title}. ${summary}`);
        for (const qt of possibleQuotes) {
          // Pastikan kalimat cukup layak
          if (qt.length < 30 || qt.length > 280) continue;

          const q: QuoteItem = {
            id: `q:${n.id}:${qt.slice(0, 24)}`,
            text: qt,
            speaker: "Menteri Perhubungan",
            date: pubISO,
            context: title,
            link: link || "#",
            tags: ["Kutipan", ...n.entities],
          };
          quotes.push(q);
        }
      }
    } catch {
      // Biarkan sumber yang error dilewati tanpa memutus build
      continue;
    }
  }

  // Dedup sederhana (berdasar title+publishedAt)
  const dedupedNews = dedupBy(news, (x) => `${x.title}|${x.publishedAt}`);
  const dedupedEvents = dedupBy(events, (x) => `${x.title}|${x.date}`);
  const dedupedQuotes = dedupBy(quotes, (x) => `${x.text}|${x.date}`);

  // Urutkan terbaru di atas
  dedupedNews.sort(
    (a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
  );
  dedupedEvents.sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );
  dedupedQuotes.sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  return { news: dedupedNews, events: dedupedEvents, quotes: dedupedQuotes };
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

// Heuristik ekstraksi kutipan dari teks
function extractQuotesFromText(text: string): string[] {
  const out: string[] = [];
  // 1) Kalimat di dalam tanda kutip
  const reQuoted = /"([^"]{20,300})"/g;
  let m: RegExpExecArray | null;
  while ((m = reQuoted.exec(text)) !== null) {
    const q = m[1].trim();
    if (q) out.push(q);
  }

  // 2) Kalimat setelah kata kunci (ujar/menurut/kata/tegas/ungkap)
  const cueWords = ["ujar", "menurut", "kata", "tegas", "ungkap"];
  const lower = text.toLowerCase();
  for (const cue of cueWords) {
    const idx = lower.indexOf(`${cue} `);
    if (idx !== -1) {
      // ambil substring setelah cue word hingga titik
      const sub = text.slice(idx);
      const sent = sub.split(".")[0] ?? "";
      const cleaned = sent.replace(/^[^"]*["“”]?/g, "").trim();
      if (cleaned.length >= 20 && cleaned.length <= 300) {
        out.push(cleaned);
      }
    }
  }
  return out;
}

// ============================
// API Handler
// ============================

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const hoursParam = url.searchParams.get("hours");
    const typesParam = url.searchParams.get("types"); // "news,events,quotes"

    // Default 24 jam
    const hours = Math.max(1, Math.min(24 * 90, Number(hoursParam ?? "24")));

    const items = await fetchAllFeeds(hours);

    // Filter by requested types
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
