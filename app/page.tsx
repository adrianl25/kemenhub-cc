'use client';
import React, { useMemo, useState } from "react";

import type { EventItem, NewsItem, QuoteItem } from "./api/items/route";

// ===== UI helpers =====
const cn = (...c: Array<string | false | undefined>) => c.filter(Boolean).join(" ");
const formatDate = (iso: string) => new Date(iso).toLocaleString();
const formatDateOnly = (iso: string) => new Date(iso).toLocaleDateString();

type ApiData = {
  ok: boolean;
  meta?: { range: string; generatedAt: string; kept: { news: number; events: number; quotes: number; total: number } };
  data?: { news: NewsItem[]; events: EventItem[]; quotes: QuoteItem[] };
  error?: string;
};

// ===== Small components =====
function Card({ children, dark }: { children: React.ReactNode; dark?: boolean }) {
  return (
    <div className={cn("rounded-xl shadow-sm border p-4", dark ? "bg-slate-800/70 border-slate-700" : "bg-white border-slate-200")}>
      {children}
    </div>
  );
}
function SectionHeader({ dotClass, title, right }: { dotClass: string; title: string; right?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between mb-3">
      <div className="flex items-center gap-2">
        <span className={cn("w-2.5 h-2.5 rounded-full inline-block", dotClass)} />
        <h2 className="text-lg font-semibold">{title}</h2>
      </div>
      {right}
    </div>
  );
}
function StatBadge({ children }: { children: React.ReactNode }) {
  return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800 border border-amber-200">{children}</span>;
}
function Empty({ msg }: { msg: string }) {
  return <div className="text-center text-slate-500 border border-dashed rounded-xl p-6">{msg}</div>;
}

// ===== MAIN PAGE =====
export default function Dashboard() {
  const [range, setRange] = useState<"24h" | "7d" | "30d" | "90d">("7d");
  const [onlyMinister, setOnlyMinister] = useState(true);
  const [query, setQuery] = useState("");
  const [caption, setCaption] = useState("");
  const [toast, setToast] = useState("");
  const [darkMode, setDarkMode] = useState(false);
  const [loading, setLoading] = useState(false);
  const [api, setApi] = useState<ApiData>({ ok: true, data: { news: [], events: [], quotes: [] } });

  const items = api.data || { news: [] as NewsItem[], events: [] as EventItem[], quotes: [] as QuoteItem[] };

  // Tag universe dari isi (supaya panel Tag tidak kosong)
  const tagUniverse = useMemo(() => {
    const tags = new Set<string>(["All"]);
    items.events.forEach((e) => e.tags.forEach((t) => tags.add(t)));
    items.quotes.forEach((q) => q.tags.forEach((t) => tags.add(t)));
    items.news.forEach((n) => n.entities.forEach((t) => tags.add(t)));
    return Array.from(tags);
  }, [items]);

  const [tag, setTag] = useState<string>("All");

  const filteredEvents = useMemo(() => {
    return items.events
      .filter((e) => (onlyMinister ? e.attendedByMinister : true))
      .filter((e) => (tag === "All" ? true : e.tags.includes(tag)))
      .filter((e) => {
        if (!query) return true;
        const hay = [e.title, e.summary || "", e.location, e.source, e.tags.join(" ")].join(" ").toLowerCase();
        return hay.includes(query.toLowerCase());
      });
  }, [items.events, onlyMinister, tag, query]);

  const filteredNews = useMemo(() => {
    return items.news
      .filter((n) => (tag === "All" ? true : n.entities.includes(tag)))
      .filter((n) => {
        if (!query) return true;
        const hay = [n.title, n.summary || "", n.source, n.entities.join(" ")].join(" ").toLowerCase();
        return hay.includes(query.toLowerCase());
      });
  }, [items.news, tag, query]);

  const filteredQuotes = useMemo(() => {
    return items.quotes
      .filter((q) => (tag === "All" ? true : q.tags.includes(tag)))
      .filter((q) => {
        if (!query) return true;
        const hay = [q.text, q.speaker, q.context || "", q.tags.join(" ")].join(" ").toLowerCase();
        return hay.includes(query.toLowerCase());
      });
  }, [items.quotes, tag, query]);

  async function fetchLive(manualToast = true) {
    try {
      setLoading(true);
      setToast(manualToast ? "Mengambil data..." : "");
      const res = await fetch(`/api/items?range=${range}`);
      const json: ApiData = await res.json();
      setApi(json);
      if (!json.ok) {
        setToast("Gagal mengambil data");
      } else {
        setToast("OK");
      }
    } catch {
      setToast("Gagal mengambil data");
    } finally {
      setLoading(false);
      setTimeout(() => setToast(""), 1800);
    }
  }

  function handleGenerateCaption() {
    const top: NewsItem | EventItem | undefined = filteredNews[0] || filteredEvents[0];
    if (!top) {
      setToast("Tidak ada item untuk dijadikan caption");
      setTimeout(() => setToast(""), 1800);
      return;
    }
    const title = "publishedAt" in top ? top.title : top.title;
    const info = "publishedAt" in top ? (top.summary || top.source) : (top.summary || top.source);
    const base = `Menhub: ${title} - ${info}. #Kemenhub #Transportasi`;
    setCaption(base);
  }

  async function handleCopy() {
    if (!caption) return;
    try {
      await navigator.clipboard.writeText(caption);
      setToast("Caption disalin");
    } catch {
      setToast("Gagal menyalin. Seleksi teks lalu Ctrl/Cmd+C.");
    } finally {
      setTimeout(() => setToast(""), 1800);
    }
  }

  // auto fetch saat pertama tampil
  React.useEffect(() => {
    fetchLive(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className={cn("min-h-screen", darkMode ? "bg-gradient-to-br from-slate-800 via-slate-900 to-slate-700 text-slate-100" : "bg-amber-50/40 text-slate-900")}>
      <header className={cn("sticky top-0 z-20 border-b backdrop-blur", darkMode ? "bg-slate-800/80 text-white border-slate-700" : "bg-white/80 text-slate-900 border-slate-200")}>
        <div className="max-w-7xl mx-auto px-3 sm:px-4 py-2 sm:py-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className={cn("w-9 h-9 rounded-xl grid place-items-center font-bold", darkMode ? "bg-indigo-500 text-white" : "bg-indigo-700 text-white")}>CC</div>
            <div>
              <div className="font-semibold">Command Center Kemenhub</div>
              <div className="text-xs opacity-70">Internal — LIVE</div>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 items-center">
            <input
              className={cn(
                "min-w-[200px] w-full sm:w-[320px] px-3 py-2 rounded-xl border focus:outline-none",
                darkMode ? "bg-slate-800 border-slate-600 text-slate-100 focus:ring-2 focus:ring-indigo-500" : "border-slate-300 focus:ring-2 focus:ring-indigo-600"
              )}
              placeholder="Cari event/berita/quote"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <select
              className={cn("px-3 py-2 rounded-xl border focus:outline-none", darkMode ? "bg-slate-800 border-slate-600 text-slate-100 focus:ring-2 focus:ring-indigo-500" : "border-slate-300 focus:ring-2 focus:ring-indigo-600")}
              value={range}
              onChange={(e) => setRange(e.target.value as typeof range)}
            >
              <option value="24h">24 jam</option>
              <option value="7d">7 hari</option>
              <option value="30d">30 hari</option>
              <option value="90d">90 hari</option>
            </select>

            <button
              onClick={() => setOnlyMinister(!onlyMinister)}
              className={cn(
                "px-3 py-2 rounded-full text-sm border",
                darkMode ? "bg-slate-800 border-slate-600 text-slate-100" : "bg-white border-slate-300 hover:bg-slate-50"
              )}
              title="Toggle hanya acara dihadiri Menhub"
            >
              Hanya Menhub: {onlyMinister ? "ON" : "OFF"}
            </button>

            <button
              onClick={() => fetchLive(true)}
              className={cn("px-3 py-2 rounded-xl", darkMode ? "bg-indigo-500 text-white hover:bg-indigo-600" : "bg-indigo-700 text-white hover:bg-indigo-800")}
              disabled={loading}
            >
              Ambil Data Sekarang
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-3 sm:px-4 py-5 grid grid-cols-12 gap-4 sm:gap-6">
        <section className="col-span-12 lg:col-span-8 space-y-4 sm:space-y-6">
          <Card dark={darkMode}>
            <SectionHeader
              dotClass={darkMode ? "bg-indigo-400" : "bg-indigo-700"}
              title="Events Terbaru (LIVE)"
              right={<div className="text-sm flex items-center gap-2"><StatBadge>{filteredEvents.length} item</StatBadge></div>}
            />
            <div className="space-y-4">
              {filteredEvents.length === 0 && <Empty msg="Tidak ada event pada rentang ini." />}
              {filteredEvents.map((e) => (
                <div key={e.id} className="flex gap-3">
                  <div className="w-36 text-xs opacity-70">{formatDate(e.date)}</div>
                  <div className="flex-1">
                    <div className="font-medium">{e.title}</div>
                    <div className="text-sm opacity-80">{e.location} — {e.source}</div>
                    {e.summary && <div className="text-sm mt-1 opacity-90">{e.summary}</div>}
                    <div className="mt-2 flex flex-wrap gap-2">
                      {e.tags.map((t) => (
                        <span key={t} className={cn("px-2 py-0.5 rounded-full text-xs border", darkMode ? "bg-slate-700 border-slate-600" : "bg-slate-100 border-slate-200")}>{t}</span>
                      ))}
                      {e.attendedByMinister && <span className="text-[10px] uppercase tracking-wide bg-amber-500 text-white px-2 py-1 rounded">Menhub hadir</span>}
                    </div>
                    <a
                      className={cn("text-sm underline-offset-2", darkMode ? "text-indigo-300 hover:underline" : "text-indigo-700 hover:underline")}
                      href={e.link}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Buka sumber
                    </a>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Card dark={darkMode}>
            <SectionHeader
              dotClass={darkMode ? "bg-indigo-400" : "bg-indigo-700"}
              title="News Ringkas (LIVE)"
              right={<div className="text-sm flex items-center gap-2"><StatBadge>{filteredNews.length} item</StatBadge></div>}
            />
            <div className="space-y-4">
              {filteredNews.length === 0 && <Empty msg="Belum ada berita pada rentang ini." />}
              {filteredNews.map((n) => (
                <div key={n.id} className="flex gap-3">
                  <div className="w-36 text-xs opacity-70">{formatDate(n.publishedAt)}</div>
                  <div className="flex-1">
                    <div className="font-medium">{n.title}</div>
                    <div className="text-sm opacity-80">{n.source}</div>
                    {n.summary && <div className="text-sm mt-1 opacity-90">{n.summary}</div>}
                    <div className="mt-2 flex flex-wrap gap-2">
                      {n.entities.map((t) => (
                        <span key={t} className={cn("px-2 py-0.5 rounded-full text-xs border", darkMode ? "bg-slate-700 border-slate-600" : "bg-slate-100 border-slate-200")}>{t}</span>
                      ))}
                    </div>
                    <a
                      className={cn("text-sm underline-offset-2", darkMode ? "text-indigo-300 hover:underline" : "text-indigo-700 hover:underline")}
                      href={n.link}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Buka sumber
                    </a>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Card dark={darkMode}>
            <SectionHeader
              dotClass={darkMode ? "bg-indigo-400" : "bg-indigo-700"}
              title="Quotes Terkini (LIVE)"
              right={<div className="text-sm flex items-center gap-2"><StatBadge>{filteredQuotes.length} item</StatBadge></div>}
            />
            <div className="space-y-4">
              {filteredQuotes.length === 0 && <Empty msg="Belum ada kutipan pada rentang ini." />}
              {filteredQuotes.map((q) => (
                <blockquote key={q.id} className={cn("border-l-4 pl-3", darkMode ? "border-indigo-400/80" : "border-indigo-700/90")}>
                  <div className="italic">&quot;{q.text}&quot;</div>
                  <div className="text-sm opacity-80">- {q.speaker}</div>
                  <div className="text-xs opacity-70">{formatDateOnly(q.date)} — {q.context}</div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {q.tags.map((t) => (
                      <span key={t} className={cn("px-2 py-0.5 rounded-full text-xs border", darkMode ? "bg-slate-700 border-slate-600" : "bg-slate-100 border-slate-200")}>{t}</span>
                    ))}
                    <a
                      className={cn("text-sm ml-auto underline-offset-2", darkMode ? "text-indigo-300 hover:underline" : "text-indigo-700 hover:underline")}
                      href={q.link}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Buka sumber
                    </a>
                  </div>
                </blockquote>
              ))}
            </div>
          </Card>

          <Card dark={darkMode}>
            <SectionHeader dotClass={darkMode ? "bg-amber-400" : "bg-amber-500"} title="Generator Caption" />
            <div className="space-y-2">
              <div className="text-sm opacity-80">Ambil item teratas dari News/Events (setelah filter) untuk caption cepat.</div>
              <div className="flex gap-2">
                <button
                  onClick={handleGenerateCaption}
                  className={cn("px-3 py-2 rounded-xl", darkMode ? "bg-indigo-500 text-white hover:bg-indigo-600" : "bg-indigo-700 text-white hover:bg-indigo-800")}
                >
                  Generate
                </button>
                <button
                  onClick={handleCopy}
                  disabled={!caption}
                  className={cn("px-3 py-2 rounded-xl border", darkMode ? "border-slate-600 hover:bg-slate-800" : "border-slate-300 hover:bg-slate-50", !caption && "opacity-50 cursor-not-allowed")}
                >
                  Copy
                </button>
              </div>
              <textarea
                className={cn("w-full h-28 p-3 rounded-xl border focus:outline-none", darkMode ? "bg-slate-800 border-slate-600 text-slate-100 focus:ring-2 focus:ring-indigo-500" : "border-slate-300 focus:ring-2 focus:ring-indigo-600")}
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
              />
            </div>
          </Card>
        </section>

        <aside className="col-span-12 lg:col-span-4 space-y-4 sm:space-y-6 lg:sticky lg:top-20 self-start">
          <Card dark={darkMode}>
            <SectionHeader dotClass={darkMode ? "bg-amber-400" : "bg-amber-500"} title="Status Ingestor" />
            <ul className="text-sm space-y-2">
              <li>News/Quotes: <span className="text-emerald-600 font-medium">LIVE</span></li>
              <li>Events: <span className="text-emerald-600 font-medium">LIVE</span></li>
              <li>Rentang aktif: {range}</li>
            </ul>
            <div className="mt-2 flex flex-wrap gap-2">
              {loading && <StatBadge>Memuat…</StatBadge>}
              {api.meta?.generatedAt && <StatBadge>Update: {new Date(api.meta.generatedAt).toLocaleString()}</StatBadge>}
              <StatBadge>{tagUniverse.length - 1} tag</StatBadge>
            </div>
          </Card>

          <Card dark={darkMode}>
            <SectionHeader dotClass={darkMode ? "bg-amber-400" : "bg-amber-500"} title="Sumber (konfigurasi contoh)" />
            <div className="text-sm">
              <details open>
                <summary className="cursor-pointer select-none font-medium">Resmi</summary>
                <ul className="list-disc ml-5 mt-1 space-y-1">
                  <li>Portal Kemenhub (agenda & siaran pers)</li>
                  <li>Akun media sosial resmi</li>
                  <li>Dokumen publik (PDF/RSS bila tersedia)</li>
                </ul>
              </details>
              <details className="mt-2">
                <summary className="cursor-pointer select-none font-medium">Media Terpercaya</summary>
                <ul className="list-disc ml-5 mt-1 space-y-1">
                  <li>Antara, Kompas, Tempo, Bisnis, Detik, dan lainnya</li>
                </ul>
              </details>
            </div>
          </Card>

          <Card dark={darkMode}>
            <SectionHeader dotClass={darkMode ? "bg-amber-400" : "bg-amber-500"} title="Pedoman Editorial Singkat" />
            <details>
              <summary className="cursor-pointer select-none font-medium">Lihat pedoman</summary>
              <ol className="list-decimal ml-5 mt-2 text-sm space-y-1">
                <li>Verifikasi 2 sumber untuk kutipan langsung.</li>
                <li>Sertakan tanggal dan tautan sumber pada caption.</li>
                <li>Gunakan foto/visual resmi atau berlisensi.</li>
              </ol>
            </details>
          </Card>
        </aside>
      </main>

      {toast && <div className="fixed bottom-4 right-4 z-50 text-sm px-4 py-3 rounded-lg shadow-lg text-white bg-slate-900">{toast}</div>}
      <footer className="max-w-7xl mx-auto px-3 sm:px-4 pb-10 text-xs opacity-70">Prototype UI — Terhubung ke endpoint /api/items (LIVE).</footer>
    </div>
  );
}
