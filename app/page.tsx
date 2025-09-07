'use client';
import React, { useEffect, useState } from "react";

/** ===== Types (sinkron dengan API) ===== */
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

type NewsItem = {
  id: string;
  title: string;
  source: string;
  publishedAt: string;
  link: string;
  summary?: string;
  entities?: string[];
  tags?: string[]; // <-- dipakai untuk chip
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

type ItemsResponse = {
  meta: { ok: boolean; generatedAt: string; sourcesTried: string[]; sourcesOk: string[]; note?: string };
  news: NewsItem[];
  events: EventItem[];
  quotes: QuoteItem[];
};

/** ===== UI helpers ===== */
const cn = (...c: Array<string | false | undefined>) => c.filter(Boolean).join(" ");
const fmt = (iso: string) =>
  new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });

const SectionHeader: React.FC<{ icon?: React.ReactNode; title: string; right?: React.ReactNode }> = ({ icon, title, right }) => (
  <div className="flex items-center justify-between mb-3">
    <div className="flex items-center gap-2">{icon}<h2 className="text-lg font-semibold">{title}</h2></div>
    <div>{right}</div>
  </div>
);

const Card: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">{children}</div>
);

const StatBadge: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800 border border-amber-200">
    {children}
  </span>
);

/** ===== Fetch helper ===== */
async function fetchItems(params: {
  range: "24h" | "7d" | "30d" | "90d";
  onlyMenhub: boolean;
  q: string;
  types: string;
}): Promise<ItemsResponse> {
  const usp = new URLSearchParams();
  usp.set("range", params.range);
  usp.set("onlyMenhub", params.onlyMenhub ? "1" : "0");
  if (params.q) usp.set("q", params.q);
  usp.set("types", params.types);
  const res = await fetch(`/api/items?${usp.toString()}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return (await res.json()) as ItemsResponse;
}

/** ===== Page ===== */
export default function Dashboard() {
  // filter
  const [range, setRange] = useState<"24h" | "7d" | "30d" | "90d">("7d");
  const [onlyMenhub, setOnlyMenhub] = useState(true);
  const [q, setQ] = useState("");
  const [autoFetch, setAutoFetch] = useState(true);

  // data
  const [news, setNews] = useState<NewsItem[]>([]);
  const [events, setEvents] = useState<EventItem[]>([]);
  const [quotes, setQuotes] = useState<QuoteItem[]>([]);
  const [tagsUniverse, setTagsUniverse] = useState<string[]>(["All"]);

  // ui state
  const [status, setStatus] = useState<"idle" | "loading" | "ok" | "error">("idle");
  const [toast, setToast] = useState("");
  const [caption, setCaption] = useState("");

  // bentuk universe tag dari semua list (news.tags || entities, event.tags, quote.tags)
  useEffect(() => {
    const set = new Set<string>(["All"]);
    news.forEach((n) => (n.tags ?? n.entities ?? []).forEach((t) => set.add(t)));
    events.forEach((e) => (e.tags ?? []).forEach((t) => set.add(t)));
    quotes.forEach((q) => (q.tags ?? []).forEach((t) => set.add(t)));
    setTagsUniverse([...set]);
  }, [news, events, quotes]);

  const load = async () => {
    try {
      setStatus("loading");
      const data = await fetchItems({ range, onlyMenhub, q, types: "news,events,quotes" });
      setNews(data.news || []);
      setEvents(data.events || []);
      setQuotes(data.quotes || []);
      setStatus("ok");
      setToast("");
    } catch {
      setStatus("error");
      setToast("Gagal mengambil data. Coba lagi.");
    }
  };

  useEffect(() => {
    if (autoFetch) void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range, onlyMenhub]);

  const genCaption = () => {
    const top = news[0] || events[0];
    if (!top) {
      setToast("Tidak ada item untuk caption");
      setTimeout(() => setToast(""), 1200);
      return;
    }
    const title = (top as NewsItem).title || (top as EventItem).title;
    const info =
      (top as NewsItem).summary ||
      (top as EventItem).summary ||
      (top as NewsItem).source ||
      (top as EventItem).source ||
      "";
    setCaption(`Menhub: ${title} — ${info} #Kemenhub #Transportasi`);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-amber-50 text-slate-900">
      {/* Header */}
      <header className="sticky top-0 z-20 bg-white/80 backdrop-blur border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 py-3 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl grid place-items-center font-bold bg-indigo-700 text-white">CC</div>
            <div>
              <div className="font-semibold">Command Center Kemenhub</div>
              <div className="text-xs opacity-70">Internal — LIVE</div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 items-center">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Cari event/berita/quote"
              className="min-w-[220px] px-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-600"
            />
            <select
              value={range}
              onChange={(e) => setRange(e.target.value as typeof range)}
              className="px-3 py-2 rounded-xl border border-slate-300 focus:outline-none"
            >
              <option value="24h">24 jam</option>
              <option value="7d">7 hari</option>
              <option value="30d">30 hari</option>
              <option value="90d">90 hari</option>
            </select>
            <button
              onClick={() => setOnlyMenhub((v) => !v)}
              className="px-3 py-2 rounded-xl border border-slate-300 bg-white"
              title="Toggle hanya yang menyebut Menhub/Dudy"
            >
              Hanya Menhub: {onlyMenhub ? "ON" : "OFF"}
            </button>
            <button
              onClick={load}
              className="px-3 py-2 rounded-xl bg-indigo-700 text-white hover:bg-indigo-800"
            >
              Ambil Data Sekarang
            </button>
            <label className="ml-2 flex items-center gap-2 text-sm">
              <input type="checkbox" checked={autoFetch} onChange={(e) => setAutoFetch(e.target.checked)} />
              <span>Auto fetch saat ganti rentang</span>
            </label>
          </div>
        </div>
      </header>

      {/* Body */}
      <main className="max-w-7xl mx-auto px-3 sm:px-4 py-5 grid grid-cols-12 gap-4 sm:gap-6">
        <section className="col-span-12 lg:col-span-8 space-y-4 sm:space-y-6">
          {/* Status */}
          <Card>
            <div className="flex items-center gap-3 flex-wrap">
              <div className="font-medium">Status:</div>
              {status === "loading" && <StatBadge>Memuat…</StatBadge>}
              {status === "error" && <StatBadge>Gagal mengambil data</StatBadge>}
              {status === "ok" && <StatBadge>OK</StatBadge>}
              <div className="text-sm opacity-70">
                Tag aktif: {tagsUniverse.length ? `All (${tagsUniverse.length - 1})` : "—"}
              </div>
            </div>
          </Card>

          {/* Events */}
          <Card>
            <SectionHeader
              icon={<span className="w-2.5 h-2.5 rounded-full inline-block bg-indigo-700" />}
              title="Events Terbaru (LIVE)"
              right={<div className="text-sm opacity-70">{events.length} item</div>}
            />
            {events.length === 0 ? (
              <div className="border border-dashed rounded-xl p-6 text-slate-500">
                Tidak ada event pada rentang ini.
              </div>
            ) : (
              <div className="divide-y" style={{ borderColor: "#e2e8f0" }}>
                {events.map((e) => (
                  <div key={e.id} className="py-3 flex flex-col md:flex-row gap-3">
                    <div className="md:w-48 text-xs opacity-70">{fmt(e.date)}</div>
                    <div className="flex-1">
                      <div className="font-medium">{e.title}</div>
                      <div className="text-sm opacity-80">{e.location || "—"} — {e.source}</div>
                      {e.summary && <div className="text-sm mt-1 opacity-90">{e.summary}</div>}
                      <div className="mt-2 flex flex-wrap gap-2">
                        {e.attendedByMinister && (
                          <span className="text-[10px] uppercase tracking-wide bg-amber-500 text-white px-2 py-1 rounded">Menhub hadir</span>
                        )}
                        {(e.tags ?? []).map((t) => (
                          <span key={t} className="px-2 py-0.5 rounded-full text-xs border bg-slate-100 border-slate-200">{t}</span>
                        ))}
                        <a href={e.link} target="_blank" rel="noopener noreferrer" className="text-sm text-indigo-700 hover:underline ml-auto">
                          Buka sumber
                        </a>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* News */}
          <Card>
            <SectionHeader
              icon={<span className="w-2.5 h-2.5 rounded-full inline-block bg-indigo-700" />}
              title="News Ringkas (LIVE)"
              right={<div className="text-sm opacity-70">{news.length} item</div>}
            />
            {news.length === 0 ? (
              <div className="border border-dashed rounded-xl p-6 text-slate-500">
                Belum ada berita pada rentang ini.
              </div>
            ) : (
              <div className="divide-y" style={{ borderColor: "#e2e8f0" }}>
                {news.map((n) => (
                  <div key={n.id} className="py-3 flex flex-col md:flex-row gap-3">
                    <div className="md:w-48 text-xs opacity-70">{fmt(n.publishedAt)}</div>
                    <div className="flex-1">
                      <div className="font-medium">{n.title}</div>
                      <div className="text-sm opacity-80">{n.source}</div>
                      {n.summary && <div className="text-sm mt-1 opacity-90">{n.summary}</div>}
                      <div className="mt-2 flex flex-wrap gap-2">
                        {/* Perbaikan utama: pakai tags kalau ada, lalu entities */}
                        {(n.tags ?? n.entities ?? []).map((t) => (
                          <span key={t} className="px-2 py-0.5 rounded-full text-xs border bg-slate-100 border-slate-200">{t}</span>
                        ))}
                        <a href={n.link} target="_blank" rel="noopener noreferrer" className="text-sm text-indigo-700 hover:underline ml-auto">
                          Buka sumber
                        </a>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* Quotes */}
          <Card>
            <SectionHeader
              icon={<span className="w-2.5 h-2.5 rounded-full inline-block bg-indigo-700" />}
              title="Quotes Terkini (LIVE)"
              right={<div className="text-sm opacity-70">{quotes.length} item</div>}
            />
            {quotes.length === 0 ? (
              <div className="border border-dashed rounded-xl p-6 text-slate-500">
                Belum ada kutipan pada rentang ini.
              </div>
            ) : (
              <div className="grid md:grid-cols-2 gap-4">
                {quotes.map((q) => (
                  <Card key={q.id}>
                    <blockquote>
                      <div className="italic text-base md:text-lg">&quot;{q.text}&quot;</div>
                      <div className="text-sm opacity-80">- {q.speaker}</div>
                      <div className="text-xs opacity-70">{fmt(q.date)} — {q.context}</div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {(q.tags ?? []).map((t) => (
                          <span key={t} className="px-2 py-0.5 rounded-full text-xs border bg-slate-100 border-slate-200">{t}</span>
                        ))}
                        <a href={q.link} target="_blank" rel="noopener noreferrer" className="text-sm text-indigo-700 hover:underline ml-auto">
                          Buka sumber
                        </a>
                      </div>
                    </blockquote>
                  </Card>
                ))}
              </div>
            )}
          </Card>

          {/* Caption */}
          <Card>
            <SectionHeader
              icon={<span className="w-2.5 h-2.5 rounded-full inline-block bg-amber-500" />}
              title="Generator Caption"
            />
            <div className="flex flex-wrap gap-2 mb-2">
              <button onClick={genCaption} className="px-3 py-2 rounded-xl bg-indigo-700 text-white hover:bg-indigo-800">Generate</button>
              <button
                onClick={async () => {
                  if (!caption) return;
                  try {
                    await navigator.clipboard.writeText(caption);
                    setToast("Caption disalin");
                    setTimeout(() => setToast(""), 1200);
                  } catch {
                    setToast("Gagal menyalin. Salin manual.");
                    setTimeout(() => setToast(""), 1500);
                  }
                }}
                className="px-3 py-2 rounded-xl border border-slate-300 bg-white"
              >
                Copy
              </button>
              {toast && <StatBadge>{toast}</StatBadge>}
            </div>
            <textarea
              className="w-full h-28 p-3 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-600"
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
            />
          </Card>
        </section>

        {/* Aside */}
        <aside className="col-span-12 lg:col-span-4 space-y-4 sm:space-y-6">
          <Card>
            <SectionHeader icon={<span className="w-2.5 h-2.5 rounded-full inline-block bg-amber-500" />} title="Status Ingestor" />
            <ul className="text-sm space-y-2">
              <li>News/Quotes: <span className="text-emerald-600 font-medium">{status === "error" ? "ERR" : "LIVE"}</span></li>
              <li>Events: <span className="text-emerald-600 font-medium">{status === "error" ? "ERR" : "LIVE"}</span></li>
              <li>Rentang aktif: {range === "24h" ? "24 jam" : range === "7d" ? "7 hari" : range === "30d" ? "30 hari" : "90 hari"}</li>
            </ul>
          </Card>

          <Card>
            <SectionHeader icon={<span className="w-2.5 h-2.5 rounded-full inline-block bg-amber-500" />} title="Sumber (konfigurasi contoh)" />
            <div className="text-sm">
              <details open>
                <summary className="cursor-pointer select-none font-medium">Resmi</summary>
                <ul className="list-disc ml-5 mt-1 space-y-1">
                  <li>Portal Kemenhub (agenda & siaran pers)</li>
                  <li>Akun media sosial resmi</li>
                  <li>Dokumen publik (PDF/RSS bila tersedia)</li>
                </ul>
              </details>
              <details className="mt-2" open>
                <summary className="cursor-pointer select-none font-medium">Media Terpercaya</summary>
                <ul className="list-disc ml-5 mt-1 space-y-1">
                  <li>Google News RSS (filter Menhub/Kemenhub)</li>
                </ul>
              </details>
            </div>
          </Card>

          <Card>
            <SectionHeader icon={<span className="w-2.5 h-2.5 rounded-full inline-block bg-amber-500" />} title="Pedoman Editorial Singkat" />
            <details>
              <summary className="cursor-pointer select-none font-medium">Lihat pedoman</summary>
              <ol className="list-decimal ml-5 mt-2 text-sm space-y-1">
                <li>Verifikasi minimal 2 sumber untuk kutipan langsung.</li>
                <li>Sertakan tanggal & tautan sumber pada caption.</li>
                <li>Gunakan aset visual resmi atau berlisensi.</li>
              </ol>
            </details>
          </Card>
        </aside>
      </main>

      <footer className="max-w-7xl mx-auto px-3 sm:px-4 pb-10 text-xs opacity-70">
        Prototype UI — Terhubung ke /api/items (LIVE).
      </footer>
    </div>
  );
}
