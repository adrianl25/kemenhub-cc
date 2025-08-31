// app/api/items/route.ts
export const runtime = 'nodejs';
export const revalidate = 60;

import Parser from 'rss-parser';

type NewsOut = {
  id: string;
  title: string;
  source: string;
  publishedAt: string; // ISO
  link: string;
  summary?: string;
  entities?: string[];
  note?: string; // keterangan fallback/debug
};

type ItemsResponse = { news: NewsOut[]; events: any[]; quotes: any[] };

type FeedItem = {
  title?: string;
  link?: string;
  isoDate?: string;
  contentSnippet?: string;
};

const parser = new Parser<{}, FeedItem>();

// Kamu boleh tambah sumber lain di sini
const FEEDS = [
  'https://www.antaranews.com/rss/terkini.xml',
  'https://rss.kompas.com/nasional',
  'https://www.tempo.co/rss/nasional',
  // 'https://news.detik.com/rss', // opsional: detik
];

// Helper: ambil hostname jadi "antara…", "kompas…"
function domainOf(url: string) {
  try { return new URL(url).hostname.replace(/^www\./, ''); }
  catch { return 'unknown'; }
}

// Kata kunci default (bisa di-override via ?q=)
const DEFAULT_KEYWORDS = [
  'kemenhub',
  'kementerian perhubungan',
  'menhub',
  'budi karya',          // sesuaikan jika perlu
  'perhubungan',
  'kementerian perhubungan ri'
];

// Pencocokan di title *dan* contentSnippet
function matchKeywords(title = '', snippet = '', keywords: string[]) {
  const t = (title || '').toLowerCase();
  const s = (snippet || '').toLowerCase();
  return keywords.some((k) => {
    const kk = k.toLowerCase();
    return t.includes(kk) || s.includes(kk);
  });
}

// Timeout kecil agar tidak menggantung
async function parseWithTimeout(feedUrl: string, ms = 12000) {
  const controller = new AbortController();
  const to = setTimeout(() => controller.abort(), ms);
  try {
    // rss-parser menerima URL langsung
    return await parser.parseURL(feedUrl);
  } finally {
    clearTimeout(to);
  }
}

async function loadNewsFromFeeds(keywords: string[], fallbackCount = 15): Promise<NewsOut[]> {
  const hits: NewsOut[] = [];
  const raw: NewsOut[] = [];

  for (const feedUrl of FEEDS) {
    try {
      const feed = await parseWithTimeout(feedUrl);
      const source = domainOf(feedUrl);

      for (const it of (feed.items || [])) {
        const title = it.title || '(tanpa judul)';
        const link = it.link || '';
        const iso = it.isoDate ? new Date(it.isoDate) : null;

        if (!link || !iso || isNaN(+iso)) continue;

        const base: NewsOut = {
          id: `${source}#${link}`,
          title,
          source,
          publishedAt: iso.toISOString(),
          link,
          summary: it.contentSnippet || '',
          entities: ['Kemenhub'],
        };

        raw.push(base);

        if (matchKeywords(title, it.contentSnippet || '', keywords)) {
          hits.push(base);
        }
      }
    } catch {
      // biarkan lanjut ke feed berikutnya
      continue;
    }
  }

  // Urut terbaru
  const byDateDesc = (a: NewsOut, b: NewsOut) =>
    +new Date(b.publishedAt) - +new Date(a.publishedAt);

  hits.sort(byDateDesc);
  raw.sort(byDateDesc);

  if (hits.length > 0) {
    return hits;
  }

  // Fallback: kalau tidak ada yang cocok keyword, berikan beberapa item terbaru
  return raw.slice(0, fallbackCount).map((n) => ({ ...n, note: 'fallback_no_keyword_hits' }));
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const types = (url.searchParams.get('types') || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  // Ambil ?q=keyword1,keyword2 kalau ada; kalau tidak, pakai default
  const q = url.searchParams.get('q');
  const keywords = q
    ? q.split(',').map((s) => s.trim()).filter(Boolean)
    : DEFAULT_KEYWORDS;

  const wantsNews = types.length === 0 || types.includes('news');
  const news = wantsNews ? await loadNewsFromFeeds(keywords) : [];

  const body: ItemsResponse = { news, events: [], quotes: [] };

  return new Response(JSON.stringify(body, null, 2), {
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 's-maxage=60, stale-while-revalidate=300',
    },
  });
}
