"use client";
import React, { useMemo, useState } from "react";

// =============================
// Command Center Kemenhub — LIVE Dashboard (Next.js App Router)
// Tailwind CSS required. ASCII-only for ESLint friendliness.
// =============================

// -------- Types --------
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

// -------- UI helpers --------
const classNames = (...c: Array<string | false | undefined>) => c.filter(Boolean).join(" ");
const formatDate = (iso: string) => new Date(iso).toLocaleString();

function SectionHeader({ title, right }: { title: string; right?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between mb-3">
      <h2 className="text-base font-semibold">{title}</h2>
      {right}
    </div>
  );
}

function Card({ children, dark }: { children: React.ReactNode; dark?: boolean }) {
  return (
    <div
      className={classNames(
        "rounded-xl border p-4",
        dark ? "bg-slate-800/70 border-slate-700" : "bg-white border-slate-200"
      )}
    >
      {children}
    </div>
  );
}

function Empty({ msg }: { msg: string }) {
  return <div className="text-sm text-slate-500 border border-dashed rounded-lg p-4">{msg}</div>;
}

// -------- Clipboard fallback --------
async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {}
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.top = "-1000px";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    document.body.removeChild(ta);
    return true;
  } catch {
    return false;
  }
}

// -------- Main Component --------
export default function DashboardLive() {
  // Tabs & filters
  const [tab, setTab] = useState<"overview" | "events" | "news" | "quotes">("overview");
  const [timeFilter, setTimeFilter] = useState<"1" | "7" | "30" | "90">("7");
  const [autoFetch, setAutoFetch] = useState(false);
  const [darkMode, setDarkMode] = useState(false);

  // Data
  const [news, setNews] = useState<NewsItem[]>([]);
  const [events, setEvents] = useState<EventItem[]>([]);
  const [quotes, setQuotes] = useState<QuoteItem[]>([]);

  // UI state
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState("");
  const [caption, setCaption] = useState("");

  // Tag panel
  const [tagsOpen, setTagsOpen] = useState(false);
  const [tag, setTag] = useState<string>("All");

  // Aside panel (mobile)
  const [asideOpen, setAsideOpen] = useState(false);

  // Universe tag (dinamis dari LIVE data)
  const tagsUniverse = useMemo(() => {
    const set = new Set<string>(["All"]);
    news.forEach((n) => (n.entities || []).forEach((t) => set.add(t)));
    events.forEach((e) => (e.tags || []).forEach((t) => set.add(t)));
    quotes.forEach((q) => (q.tags || []).forEach((t) => set.add(t)));
    return Array.from(set);
  }, [news, events, quotes]);

  // Filtered views oleh Tag (client-side)
  const filteredNews = useMemo(
    () => (tag === "All" ? news : news.filter((n) => (n.entities || []).includes(tag))),
    [news, tag]
  );
  const filteredEvents = useMemo(
    () => (tag === "All" ? events : events.filter((e) => (e.tags || []).includes(tag))),
    [events, tag]
  );
  const filteredQuotes = useMemo(
    () => (tag === "All" ? quotes : quotes.filter((q) => (q.tags || []).includes(tag))),
    [quotes, tag]
  );

  async function fetchData() {
    setLoading(true);
    try {
      const res = await fetch(`/api/items?types=news,events,quotes&days=${timeFilter}`);
      const data: { news?: NewsItem[]; events?: EventItem[]; quotes?: QuoteItem[] } = await res.json();
      setNews(data.news || []);
      setEvents(data.events || []);
      setQuotes(data.quotes || []);
      // reset tag jika tidak ada lagi di universe
      setTag((prev) => (prev === "All" ? prev : tagsUniverse.includes(prev) ? prev : "All"));
    } catch {
      setToast("Gagal mengambil data. Coba lagi.");
      setTimeout(() => setToast(""), 2000);
    } finally {
      setLoading(false);
    }
  }

  function handleAutoFetchChange(next: boolean) {
    setAutoFetch(next);
    if (next) {
      void fetchData();
    }
  }

  function onChangeTimeRange(v: "1" | "7" | "30" | "90") {
    setTimeFilter(v);
    if (autoFetch) void fetchData();
  }

  function handleLinkClick(ev: React.MouseEvent<HTMLAnchorElement>, link: string) {
    if (link === "#") {
      ev.preventDefault();
      setToast("Sumber belum tersedia");
      setTimeout(() => setToast(""), 1500);
    }
  }

  function generateCaption() {
    const top: NewsItem | EventItem | undefined = filteredNews[0] || filteredEvents[0];
    if (!top) {
      setToast("Tidak ada item untuk dijadikan caption");
      setTimeout(() => setToast(""), 1500);
      return;
    }
    const title = (top as NewsItem).title || (top as EventItem).title;
    const info =
      (top as NewsItem).summary ||
      (top as EventItem).summary ||
      (top as NewsItem).source ||
      (top as EventItem).source ||
      "Info terbaru";
    setCaption(`Menhub: ${title} - ${info}. #Kemenhub #Transportasi`);
  }

  async function copyCaption() {
    if (!caption) return;
    const ok = await copyToClipboard(caption);
    setToast(ok ? "Caption disalin ke clipboard" : "Gagal menyalin. Pilih teks lalu Ctrl/Cmd+C.");
    setTimeout(() => setToast(""), 1800);
  }

  const TabBtn = ({ id, label }: { id: typeof tab; label: string }) => (
    <button
      onClick={() => setTab(id)}
      className={classNames(
        "px-3 py-2 rounded-full text-sm border transition-colors",
        tab === id
          ? "bg-indigo-600 text-white border-indigo-600 shadow-sm"
          : darkMode
          ? "bg-slate-800 text-slate-100 border-slate-600 hover:bg-slate-700"
          : "bg-white text-slate-700 border-slate-300 hover:bg-slate-50"
      )}
    >
      {label}
    </button>
  );

  return (
    <div
      className={classNames(
        "min-h-screen",
        darkMode
          ? "bg-gradient-to-br from-slate-800 via-slate-900 to-slate-700 text-slate-100"
          : "bg-gradient-to-br from-indigo-50 via-white to-amber-50 text-slate-900"
      )}
    >
      {/* Dark mode toggle */}
      <button
        onClick={() => setDarkMode(!darkMode)}
        className={classNames(
          "fixed bottom-4 left-4 z-50 px-3 py-2 rounded-lg border text-sm",
          darkMode
            ? "bg-slate-800 border-slate-600 text-slate-100 hover:bg-slate-700"
            : "bg-white/80 backdrop-blur border-slate-300 hover:bg-slate-100"
        )}
      >
        {darkMode ? "Light Mode" : "Dark Mode"}
      </button>

      {/* Header */}
      <header
        className={classNames(
          "sticky top-0 z-20 border-b backdrop-blur",
          darkMode ? "bg-slate-800/80 text-white border-slate-700" : "bg-white/80 text-slate-900 border-slate-200"
        )}
      >
        <div className="max-w-7xl mx-auto px-3 sm:px-4 py-2 sm:py-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div
              className={classNames(
                "w-9 h-9 rounded-xl grid place-items-center font-bold",
                darkMode ? "bg-indigo-500 text-white" : "bg-indigo-700 text-white"
              )}
            >
              CC
            </div>
            <div>
              <div className="font-semibold">Command Center Kemenhub</div>
              <div className="text-xs opacity-70">LIVE — Fetch manual/otomatis</div>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 items-center">
            <select
              className={classNames(
                "px-3 py-2 rounded-xl border focus:outline-none",
                darkMode ? "bg-slate-800 border-slate-600 text-slate-100 focus:ring-2 focus:ring-indigo-500" : "border-slate-300 focus:ring-2 focus:ring-indigo-600"
              )}
              value={timeFilter}
              onChange={(e) => onChangeTimeRange(e.target.value as "1" | "7" | "30" | "90")}
            >
              <option value="1">24 jam</option>
              <option value="7">7 hari</option>
              <option value="30">30 hari</option>
              <option value="90">90 hari</option>
            </select>
            <button
              onClick={() => void fetchData()}
              className={classNames(
                "px-3 py-2 rounded-xl",
                darkMode ? "bg-indigo-500 text-white hover:bg-indigo-600" : "bg-indigo-700 text-white hover:bg-indigo-800"
              )}
            >
              {loading ? "Loading..." : "Ambil Data (Fetch)"}
            </button>
            <label className="flex items-center gap-2 text-xs">
              <input
                type="checkbox"
                checked={autoFetch}
                onChange={(e) => handleAutoFetchChange(e.target.checked)}
              />
              Auto-fetch
            </label>

            {/* Info panel toggle (mobile) */}
            <button
              onClick={() => setAsideOpen(true)}
              className={classNames(
                "lg:hidden px-3 py-2 rounded-full text-sm border",
                darkMode ? "bg-slate-800 border-slate-600 text-slate-100" : "bg-white border-slate-300 hover:bg-slate-50"
              )}
            >
              Panel Info
            </button>
          </div>
        </div>
      </header>

      {/* Body */}
      <main className="max-w-7xl mx-auto px-3 sm:px-4 py-5 grid grid-cols-12 gap-4 sm:gap-6">
        {/* Left/Main */}
        <section className="col-span-12 lg:col-span-8 space-y-4 sm:space-y-6">
          {/* Filters row */}
          <Card dark={darkMode}>
            <div className="flex flex-col md:flex-row md:flex-wrap items-start md:items-center gap-3">
              <div className="font-medium">Filter:</div>
              <div className="flex items-center gap-2 w-full md:w-auto">
                <span className="opacity-80">Tag:</span>
                <div className="flex items-center gap-2">
                  <span
                    className={classNames(
                      "text-xs px-2 py-0.5 rounded-full border",
                      darkMode ? "bg-slate-700 border-slate-600" : "bg-slate-100 border-slate-200"
                    )}
                  >
                    {tag === "All" ? `All (${tagsUniverse.length - 1})` : tag}
                  </span>
                  <button
                    onClick={() => setTagsOpen(true)}
                    className={classNames(
                      "px-2 py-1 rounded-md text-xs border",
                      darkMode ? "bg-slate-800 border-slate-600" : "bg-white border-slate-300 hover:bg-slate-50"
                    )}
                  >
                    Kelola Tag
                  </button>
                </div>
              </div>
            </div>
          </Card>

          {/* Tabs */}
          <div className="flex flex-wrap gap-2">
            <TabBtn id="overview" label="Overview" />
            <TabBtn id="events" label="Events" />
            <TabBtn id="news" label="News" />
            <TabBtn id="quotes" label="Quotes" />
          </div>

          {/* Overview */}
          {tab === "overview" && (
            <div className="grid md:grid-cols-2 gap-4 sm:gap-6">
              <Card dark={darkMode}>
                <SectionHeader title="Events Terbaru (LIVE)" />
                <div className="space-y-4">
                  {filteredEvents.slice(0, 4).map((e) => (
                    <div key={e.id} className="flex gap-3">
                      <div className="w-20 text-xs opacity-70">{new Date(e.date).toLocaleDateString()}</div>
                      <div className="flex-1">
                        <div className="font-medium">{e.title}</div>
                        <div className="text-sm opacity-80">{e.location} - {e.source}</div>
                        {e.summary && <div className="text-sm mt-1 opacity-90">{e.summary}</div>}
                      </div>
                    </div>
                  ))}
                  {filteredEvents.length === 0 && <Empty msg="Tidak ada event dalam rentang ini." />}
                </div>
              </Card>

              <Card dark={darkMode}>
                <SectionHeader title="News Ringkas (LIVE)" />
                <div className="space-y-4">
                  {filteredNews.slice(0, 4).map((n) => (
                    <div key={n.id} className="flex gap-3">
                      <div className="w-20 text-xs opacity-70">{new Date(n.publishedAt).toLocaleDateString()}</div>
                      <div className="flex-1">
                        <div className="font-medium">{n.title}</div>
                        <div className="text-sm opacity-80">{n.source}</div>
                        {n.summary && <div className="text-sm mt-1 opacity-90">{n.summary}</div>}
                      </div>
                    </div>
                  ))}
                  {filteredNews.length === 0 && <Empty msg="Belum ada berita pada rentang ini." />}
                </div>
              </Card>

              <Card dark={darkMode}>
                <SectionHeader title="Quotes Terkini (LIVE)" />
                <div className="space-y-4">
                  {filteredQuotes.slice(0, 4).map((q) => (
                    <blockquote key={q.id} className={classNames("border-l-4 pl-3", darkMode ? "border-indigo-400/80" : "border-indigo-700/90")}>
                      <div className="italic">&quot;{q.text}&quot;</div>
                      <div className="text-sm opacity-80">- {q.speaker}</div>
                      <div className="text-xs opacity-70">{new Date(q.date).toLocaleDateString()} - {q.context}</div>
                    </blockquote>
                  ))}
                  {filteredQuotes.length === 0 && <Empty msg="Belum ada kutipan pada rentang ini." />}
                </div>
              </Card>

              <Card dark={darkMode}>
                <SectionHeader title="Generator Caption" />
                <div className="space-y-2">
                  <div className="text-sm opacity-80">Ambil item teratas dari News/Events (setelah filter) untuk membuat caption cepat.</div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={generateCaption}
                      className={classNames(
                        "px-3 py-2 rounded-xl",
                        darkMode ? "bg-indigo-500 text-white hover:bg-indigo-600" : "bg-indigo-700 text-white hover:bg-indigo-800"
                      )}
                    >
                      Generate
                    </button>
                    <button
                      onClick={() => void copyCaption()}
                      disabled={!caption}
                      className={classNames(
                        "px-3 py-2 rounded-xl border",
                        darkMode ? "border-slate-600 hover:bg-slate-800" : "border-slate-300 hover:bg-slate-50",
                        !caption && "opacity-50 cursor-not-allowed"
                      )}
                    >
                      Copy
                    </button>
                  </div>
                  <textarea
                    className={classNames(
                      "w-full h-28 p-3 rounded-xl border focus:outline-none",
                      darkMode ? "bg-slate-800 border-slate-600 text-slate-100 focus:ring-2 focus:ring-indigo-500" : "border-slate-300 focus:ring-2 focus:ring-indigo-600"
                    )}
                    value={caption}
                    onChange={(e) => setCaption(e.target.value)}
                  />
                </div>
              </Card>
            </div>
          )}

          {/* Events */}
          {tab === "events" && (
            <Card dark={darkMode}>
              <SectionHeader
                title="Daftar Events (LIVE)"
                right={<div className="text-sm opacity-80">{filteredEvents.length} item</div>}
              />
              <div
                className="divide-y"
                style={{ borderColor: darkMode ? "#334155" : "#e2e8f0" }}
              >
                {filteredEvents.map((e) => (
                  <div key={e.id} className="py-3 flex flex-col sm:flex-row sm:items-start gap-3 sm:gap-4">
                    <div className="sm:w-44 text-xs opacity-70">{formatDate(e.date)}</div>
                    <div className="flex-1">
                      <div className="font-medium">{e.title}</div>
                      <div className="text-sm opacity-80">{e.location} - {e.source}</div>
                      {e.summary && <div className="text-sm mt-1 opacity-90">{e.summary}</div>}
                      <div className="mt-2 flex flex-wrap gap-2">
                        {(e.tags || []).map((t) => (
                          <span key={t} className={classNames("px-2 py-0.5 rounded-full text-xs border", darkMode ? "bg-slate-700 border-slate-600" : "bg-slate-100 border-slate-200")}>{t}</span>
                        ))}
                      </div>
                    </div>
                    <div className="flex flex-row sm:flex-col gap-2 sm:items-end">
                      {e.attendedByMinister && (
                        <span className="text-[10px] uppercase tracking-wide bg-amber-500 text-white px-2 py-1 rounded">Menhub hadir</span>
                      )}
                      <a
                        href={e.link}
                        title={e.link === "#" ? "Sumber belum tersedia (dummy)" : "Buka sumber di tab baru"}
                        target={e.link === "#" ? undefined : "_blank"}
                        rel={e.link === "#" ? undefined : "noopener noreferrer"}
                        onClick={(ev) => handleLinkClick(ev, e.link)}
                        className={classNames("text-sm", darkMode ? "text-indigo-300 hover:underline" : "text-indigo-700 hover:underline")}
                      >
                        Buka sumber
                      </a>
                    </div>
                  </div>
                ))}
                {filteredEvents.length === 0 && <Empty msg="Tidak ada event." />}
              </div>
            </Card>
          )}

          {/* News */}
          {tab === "news" && (
            <Card dark={darkMode}>
              <SectionHeader
                title="Daftar News (LIVE)"
                right={<div className="text-sm opacity-80">{filteredNews.length} item</div>}
              />
              <div
                className="divide-y"
                style={{ borderColor: darkMode ? "#334155" : "#e2e8f0" }}
              >
                {filteredNews.map((n) => (
                  <div key={n.id} className="py-3 flex flex-col sm:flex-row sm:items-start gap-3 sm:gap-4">
                    <div className="sm:w-44 text-xs opacity-70">{formatDate(n.publishedAt)}</div>
                    <div className="flex-1">
                      <div className="font-medium">{n.title}</div>
                      <div className="text-sm opacity-80">{n.source}</div>
                      {n.summary && <div className="text-sm mt-1 opacity-90">{n.summary}</div>}
                      <div className="mt-2 flex flex-wrap gap-2">
                        {(n.entities || []).map((t) => (
                          <span key={t} className={classNames("px-2 py-0.5 rounded-full text-xs border", darkMode ? "bg-slate-700 border-slate-600" : "bg-slate-100 border-slate-200")}>{t}</span>
                        ))}
                      </div>
                    </div>
                    <div className="flex flex-row sm:flex-col gap-2 sm:items-end">
                      <a
                        href={n.link}
                        title={n.link === "#" ? "Sumber belum tersedia (dummy)" : "Buka sumber di tab baru"}
                        target={n.link === "#" ? undefined : "_blank"}
                        rel={n.link === "#" ? undefined : "noopener noreferrer"}
                        onClick={(ev) => handleLinkClick(ev, n.link)}
                        className={classNames("text-sm", darkMode ? "text-indigo-300 hover:underline" : "text-indigo-700 hover:underline")}
                      >
                        Buka sumber
                      </a>
                    </div>
                  </div>
                ))}
                {filteredNews.length === 0 && <Empty msg="Tidak ada news." />}
              </div>
            </Card>
          )}

          {/* Quotes */}
          {tab === "quotes" && (
            <Card dark={darkMode}>
              <SectionHeader
                title="Daftar Quotes (LIVE)"
                right={<div className="text-sm opacity-80">{filteredQuotes.length} item</div>}
              />
              <div className="grid md:grid-cols-2 gap-4">
                {filteredQuotes.map((q) => (
                  <Card key={q.id} dark={darkMode}>
                    <blockquote>
                      <div className="italic text-base md:text-lg">&quot;{q.text}&quot;</div>
                      <div className="text-sm opacity-80">- {q.speaker}</div>
                      <div className="text-xs opacity-70">{new Date(q.date).toLocaleDateString()} - {q.context}</div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {(q.tags || []).map((t) => (
                          <span key={t} className={classNames("px-2 py-0.5 rounded-full text-xs border", darkMode ? "bg-slate-700 border-slate-600" : "bg-slate-100 border-slate-200")}>{t}</span>
                        ))}
                        <a
                          href={q.link}
                          title={q.link === "#" ? "Sumber belum tersedia (dummy)" : "Buka sumber di tab baru"}
                          target={q.link === "#" ? undefined : "_blank"}
                          rel={q.link === "#" ? undefined : "noopener noreferrer"}
                          onClick={(ev) => handleLinkClick(ev, q.link)}
                          className={classNames("text-sm md:ml-auto", darkMode ? "text-indigo-300 hover:underline" : "text-indigo-700 hover:underline")}
                        >
                          Buka sumber
                        </a>
                      </div>
                    </blockquote>
                  </Card>
                ))}
                {filteredQuotes.length === 0 && <Empty msg="Belum ada kutipan." />}
              </div>
            </Card>
          )}
        </section>

        {/* Right / Aside */}
        <aside className="col-span-12 lg:col-span-4 space-y-4 sm:space-y-6 lg:sticky lg:top-20 self-start">
          <div className="hidden lg:block">
            <Card dark={darkMode}>
              <SectionHeader title="Status Ingestor" />
              <ul className="text-sm space-y-2">
                <li>Portal Berita: <span className="text-emerald-500 font-medium">OK</span> - barusan</li>
                <li>Agenda Resmi: <span className="text-amber-500 font-medium">Heuristik</span> - dari news</li>
                <li>Quotes: <span className="text-emerald-500 font-medium">OK</span> - berbasis konten</li>
              </ul>
            </Card>

            <Card dark={darkMode}>
              <SectionHeader title="Sumber (konfigurasi contoh)" />
              <div className="text-sm">
                <details open>
                  <summary className="cursor-pointer select-none font-medium">Resmi/Media</summary>
                  <ul className="list-disc ml-5 mt-1 space-y-1">
                    <li>Antara, Kompas, Tempo (RSS umum)</li>
                    <li>Tambahkan feed lain yang relevan</li>
                  </ul>
                </details>
                <details className="mt-2">
                  <summary className="cursor-pointer select-none font-medium">Agenda</summary>
                  <ul className="list-disc ml-5 mt-1 space-y-1">
                    <li>Heuristik dari berita (sementara)</li>
                    <li>Opsional: ICS Google Calendar Biro Humas</li>
                  </ul>
                </details>
              </div>
            </Card>

            <Card dark={darkMode}>
              <SectionHeader title="Pedoman Editorial Singkat" />
              <details>
                <summary className="cursor-pointer select-none font-medium">Lihat pedoman</summary>
                <ol className="list-decimal ml-5 mt-2 text-sm space-y-1">
                  <li>Verifikasi 2 sumber untuk kutipan langsung.</li>
                  <li>Sertakan tanggal dan tautan sumber pada caption.</li>
                  <li>Gunakan visual resmi atau berlisensi.</li>
                </ol>
              </details>
            </Card>
          </div>

          {/* Mobile slide-over */}
          {asideOpen && (
            <div className="lg:hidden fixed inset-0 z-30">
              <div className="absolute inset-0 bg-black/30" onClick={() => setAsideOpen(false)} />
              <div className={classNames("absolute right-0 top-0 h-full w-80 max-w-[85%] shadow-xl p-4 overflow-y-auto", darkMode ? "bg-slate-800" : "bg-white")}>
                <div className="flex items-center justify-between mb-3">
                  <div className="font-semibold">Panel Info</div>
                  <button onClick={() => setAsideOpen(false)} className="text-sm opacity-80">Tutup</button>
                </div>
                <Card dark={darkMode}>
                  <SectionHeader title="Status Ingestor" />
                  <ul className="text-sm space-y-2">
                    <li>Portal Berita: <span className="text-emerald-500 font-medium">OK</span> - barusan</li>
                    <li>Agenda Resmi: <span className="text-amber-500 font-medium">Heuristik</span> - dari news</li>
                    <li>Quotes: <span className="text-emerald-500 font-medium">OK</span> - berbasis konten</li>
                  </ul>
                </Card>
                <div className="h-3" />
                <Card dark={darkMode}>
                  <SectionHeader title="Sumber (konfigurasi contoh)" />
                  <div className="text-sm">
                    <details open>
                      <summary className="cursor-pointer select-none font-medium">Resmi/Media</summary>
                      <ul className="list-disc ml-5 mt-1 space-y-1">
                        <li>Antara, Kompas, Tempo (RSS umum)</li>
                        <li>Tambahkan feed lain yang relevan</li>
                      </ul>
                    </details>
                    <details className="mt-2">
                      <summary className="cursor-pointer select-none font-medium">Agenda</summary>
                      <ul className="list-disc ml-5 mt-1 space-y-1">
                        <li>Heuristik dari berita (sementara)</li>
                        <li>Opsional: ICS Google Calendar Biro Humas</li>
                      </ul>
                    </details>
                  </div>
                </Card>
                <div className="h-3" />
                <Card dark={darkMode}>
                  <SectionHeader title="Pedoman Editorial Singkat" />
                  <ol className="list-decimal ml-5 mt-2 text-sm space-y-1">
                    <li>Verifikasi 2 sumber untuk kutipan langsung.</li>
                    <li>Sertakan tanggal dan tautan sumber pada caption.</li>
                    <li>Gunakan visual resmi atau berlisensi.</li>
                  </ol>
                </Card>
              </div>
            </div>
          )}
        </aside>
      </main>

      {/* Tag Panel */}
      {tagsOpen && (
        <div className="fixed inset-0 z-40">
          <div className="absolute inset-0 bg-black/30" onClick={() => setTagsOpen(false)} />
          <div
            className={classNames(
              "absolute right-0 top-0 h-full w-96 max-w-[90%] shadow-2xl p-4 overflow-y-auto",
              darkMode ? "bg-slate-800" : "bg-white"
            )}
          >
            <div className="flex items-center justify-between mb-3">
              <div>
                <div className="font-semibold">Panel Tag</div>
                <div className="text-xs opacity-70">Pilih satu untuk filter atau reset ke All</div>
              </div>
              <button onClick={() => setTagsOpen(false)} className="text-sm opacity-80">Tutup</button>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {tagsUniverse.map((t) => (
                <button
                  key={t}
                  onClick={() => {
                    setTag(t);
                    setTagsOpen(false);
                  }}
                  className={classNames(
                    "px-3 py-2 rounded-xl border text-sm",
                    t === tag
                      ? darkMode
                        ? "bg-indigo-500 text-white border-indigo-500"
                        : "bg-indigo-600 text-white border-indigo-600"
                      : darkMode
                      ? "bg-slate-800 text-slate-100 border-slate-600 hover:bg-slate-700"
                      : "bg-white text-slate-700 border-slate-300 hover:bg-slate-50"
                  )}
                >
                  {t}
                </button>
              ))}
            </div>
            <div className="mt-4">
              <button
                onClick={() => {
                  setTag("All");
                  setTagsOpen(false);
                }}
                className={classNames(
                  "px-3 py-2 rounded-xl border text-sm",
                  darkMode ? "bg-slate-800 border-slate-600" : "bg-white border-slate-300 hover:bg-slate-50"
                )}
              >
                Reset ke All
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-4 right-4 z-50 text-sm px-4 py-3 rounded-lg shadow-lg text-white bg-slate-900">
          {toast}
        </div>
      )}

      <footer className="max-w-7xl mx-auto px-3 sm:px-4 pb-10 text-xs opacity-70">
        LIVE build — News dari RSS; Events hasil heuristik; Quotes diekstrak dari konten. Tambah ICS agenda resmi untuk akurasi maksimal.
      </footer>
    </div>
  );
}
