"use client";

import React, { useEffect, useMemo, useState } from "react";
import type { EventItem, NewsItem, QuoteItem } from "./api/items/route";

// =============================
// Command Center Kemenhub — LIVE prototype (Next.js App Router)
// - TailwindCSS required
// - ASCII-only strings in JSX
// =============================

// Types (frontend)
type CombinedItem = EventItem | NewsItem | QuoteItem;

// Guards
function isEvent(x: CombinedItem): x is EventItem {
  return (x as EventItem).date !== undefined && (x as EventItem).attendedByMinister !== undefined;
}
function isNews(x: CombinedItem): x is NewsItem {
  return (x as NewsItem).publishedAt !== undefined && (x as NewsItem).source !== undefined;
}
function isQuote(x: CombinedItem): x is QuoteItem {
  return (x as QuoteItem).speaker !== undefined && (x as QuoteItem).context !== undefined;
}

// UI helpers
const classNames = (...c: Array<string | false | undefined>) => c.filter(Boolean).join(" ");
const formatDate = (iso: string) => new Date(iso).toLocaleString();

// Time-range map (hours)
const RANGE_TO_HOURS: Record<"24h" | "7d" | "30d" | "90d", number> = {
  "24h": 24,
  "7d": 24 * 7,
  "30d": 24 * 30,
  "90d": 24 * 90,
};

function SectionHeader({
  icon,
  title,
  right,
}: {
  icon?: React.ReactNode;
  title: string;
  right?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between mb-3">
      <div className="flex items-center gap-2">
        {icon}
        <h2 className="text-lg font-semibold">{title}</h2>
      </div>
      <div>{right}</div>
    </div>
  );
}

function Card({ children, dark }: { children: React.ReactNode; dark?: boolean }) {
  return (
    <div className={classNames("rounded-xl shadow-sm border p-4", dark ? "bg-slate-800/70 border-slate-700" : "bg-white border-slate-200")}>
      {children}
    </div>
  );
}

function Chip({
  children,
  active,
  onClick,
}: {
  children: React.ReactNode;
  active?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={classNames(
        "px-2 py-1 rounded-md text-xs border transition-colors",
        active ? "bg-indigo-600 text-white border-indigo-600" : "bg-white text-slate-700 border-slate-300 hover:bg-slate-50"
      )}
    >
      {children}
    </button>
  );
}

function StatBadge({ children }: { children: React.ReactNode }) {
  return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800 border border-amber-200">{children}</span>;
}

function Empty({ msg }: { msg: string }) {
  return <div className="text-center text-slate-500 border border-dashed rounded-xl p-6">{msg}</div>;
}

// =============================
// PAGE
// =============================
export default function Dashboard() {
  const [tab, setTab] = useState<"overview" | "events" | "news" | "quotes">("overview");
  const [darkMode, setDarkMode] = useState(false);

  const [query, setQuery] = useState("");
  const [tag, setTag] = useState("All");
  const [timeFilter, setTimeFilter] = useState<"24h" | "7d" | "30d" | "90d">("24h");

  // Live data
  const [itemsNews, setItemsNews] = useState<NewsItem[]>([]);
  const [itemsEvents, setItemsEvents] = useState<EventItem[]>([]);
  const [itemsQuotes, setItemsQuotes] = useState<QuoteItem[]>([]);

  // Controls
  const [onlyMinister, setOnlyMinister] = useState(true);
  const [caption, setCaption] = useState("");
  const [toast, setToast] = useState("");
  const [asideOpen, setAsideOpen] = useState(false);
  const [tagsOpen, setTagsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [autoFetch, setAutoFetch] = useState(true);

  // =============================
  // FETCH LIVE DATA
  // =============================
  const doFetch = async (hours: number) => {
    setLoading(true);
    try {
      const q = new URLSearchParams({ hours: String(hours), types: "news,events,quotes" });
      const res = await fetch(`/api/items?${q.toString()}`, { cache: "no-store" });
      if (!res.ok) throw new Error("Bad response");
      const data = (await res.json()) as { news: NewsItem[]; events: EventItem[]; quotes: QuoteItem[] };

      setItemsNews(Array.isArray(data.news) ? data.news : []);
      setItemsEvents(Array.isArray(data.events) ? data.events : []);
      setItemsQuotes(Array.isArray(data.quotes) ? data.quotes : []);

      setToast("Data diperbarui");
      setTimeout(() => setToast(""), 1200);
    } catch {
      setToast("Gagal mengambil data. Coba lagi.");
      setTimeout(() => setToast(""), 1600);
    } finally {
      setLoading(false);
    }
  };

  // Auto fetch saat pertama load & saat rentang waktu berubah (bila autoFetch aktif)
  useEffect(() => {
    if (autoFetch) {
      void doFetch(RANGE_TO_HOURS[timeFilter]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeFilter, autoFetch]);

  // =============================
  // FILTERING (client-side)
  // =============================
  const tagsUniverse = useMemo(() => {
    const set = new Set<string>(["All"]);
    itemsEvents.forEach((e) => e.tags.forEach((t) => set.add(t)));
    itemsNews.forEach((n) => n.entities.forEach((en) => set.add(en)));
    itemsQuotes.forEach((q) => q.tags.forEach((t) => set.add(t)));
    return [...set];
  }, [itemsEvents, itemsNews, itemsQuotes]);

  const filteredEvents = useMemo(() => {
    return itemsEvents
      .filter((e) => (onlyMinister ? e.attendedByMinister : true))
      .filter((e) => (tag === "All" ? true : e.tags.includes(tag)))
      .filter((e) => {
        if (!query) return true;
        const hay = [e.title, e.location, e.summary, e.source, ...e.tags].join(" ").toLowerCase();
        return hay.includes(query.toLowerCase());
      });
  }, [itemsEvents, onlyMinister, tag, query]);

  const filteredNews = useMemo(() => {
    return itemsNews
      .filter((n) => (tag === "All" ? true : n.entities.includes(tag)))
      .filter((n) => {
        if (!query) return true;
        const hay = [n.title, n.summary, n.source, ...n.entities].join(" ").toLowerCase();
        return hay.includes(query.toLowerCase());
      });
  }, [itemsNews, tag, query]);

  const filteredQuotes = useMemo(() => {
    return itemsQuotes
      .filter((q) => (tag === "All" ? true : q.tags.includes(tag)))
      .filter((q) => {
        if (!query) return true;
        const hay = [q.text, q.context, q.speaker, ...q.tags].join(" ").toLowerCase();
        return hay.includes(query.toLowerCase());
      });
  }, [itemsQuotes, tag, query]);

  // =============================
  // Actions
  // =============================
  const copyToClipboard = async (text: string) => {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
        return true;
      }
    } catch {
      // ignore
    }
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
  };

  // === FIXED: caption generator type-safe (tanpa A || B pada union) ===
  const handleGenerateCaption = () => {
    let top: CombinedItem | undefined = undefined;
    if (filteredNews.length > 0) top = filteredNews[0];
    else if (filteredEvents.length > 0) top = filteredEvents[0];

    if (!top) {
      setToast("Tidak ada item untuk dijadikan caption");
      setTimeout(() => setToast(""), 1600);
      return;
    }

    const title = isNews(top) ? top.title : isEvent(top) ? top.title : "Pembaruan";
    const info = isNews(top) ? top.summary || top.source || "" : isEvent(top) ? top.summary || top.source || "" : "";
    const base = `Menhub: ${title} - ${info}. #Kemenhub #Transportasi`;
    setCaption(base.trim());
    setToast("Caption dibuat");
    setTimeout(() => setToast(""), 1200);
  };

  const handleCopy = async () => {
    if (!caption) return;
    const ok = await copyToClipboard(caption);
    setToast(ok ? "Caption disalin ke clipboard" : "Gagal menyalin clipboard. Pilih teks lalu Ctrl/Cmd+C.");
    setTimeout(() => setToast(""), 1600);
  };

  const handleLinkClick = (ev: React.MouseEvent<HTMLAnchorElement>, link: string) => {
    if (link === "#") {
      ev.preventDefault();
      setToast("Sumber belum tersedia");
      setTimeout(() => setToast(""), 1200);
    }
  };

  const TabButton = ({ id, label }: { id: "overview" | "events" | "news" | "quotes"; label: string }) => (
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
    <div className={classNames("min-h-screen", darkMode ? "bg-gradient-to-br from-slate-800 via-slate-900 to-slate-700 text-slate-100" : "bg-gradient-to-br from-indigo-50 via-white to-amber-50 text-slate-900")}>
      {/* Theme toggle */}
      <button
        onClick={() => setDarkMode(!darkMode)}
        className={classNames(
          "fixed bottom-4 left-4 z-50 px-3 py-2 rounded-lg border text-sm",
          darkMode ? "bg-slate-800 border-slate-600 text-slate-100 hover:bg-slate-700" : "bg-white/80 backdrop-blur border-slate-300 hover:bg-slate-100"
        )}
      >
        {darkMode ? "Light Mode" : "Dark Mode"}
      </button>

      {/* Header */}
      <header className={classNames("sticky top-0 z-20 border-b backdrop-blur", darkMode ? "bg-slate-800/80 text-white border-slate-700" : "bg-white/80 text-slate-900 border-slate-200")}>
        <div className="max-w-7xl mx-auto px-3 sm:px-4 py-2 sm:py-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className={classNames("w-9 h-9 rounded-xl grid place-items-center font-bold", darkMode ? "bg-indigo-500 text-white" : "bg-indigo-700 text-white")}>CC</div>
            <div>
              <div className="font-semibold">Command Center Kemenhub</div>
              <div className="text-xs opacity-70">LIVE data — prototype</div>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 items-center">
            <input
              className={classNames(
                "min-w-[140px] sm:min-w-[220px] md:min-w-[260px] w-full sm:w-auto px-3 py-2 rounded-xl border focus:outline-none",
                darkMode ? "bg-slate-800 border-slate-600 text-slate-100 focus:ring-2 focus:ring-indigo-500" : "border-slate-300 focus:ring-2 focus:ring-indigo-600"
              )}
              placeholder="Cari event, berita, quote"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <select
              className={classNames("px-3 py-2 rounded-xl border focus:outline-none", darkMode ? "bg-slate-800 border-slate-600 text-slate-100 focus:ring-2 focus:ring-indigo-500" : "border-slate-300 focus:ring-2 focus:ring-indigo-600")}
              value={timeFilter}
              onChange={(e) => setTimeFilter(e.target.value as "24h" | "7d" | "30d" | "90d")}
            >
              <option value="24h">24 jam</option>
              <option value="7d">7 hari</option>
              <option value="30d">30 hari</option>
              <option value="90d">90 hari</option>
            </select>

            {/* Fetch controls */}
            <div className="flex items-center gap-2">
              <Chip active={autoFetch} onClick={() => setAutoFetch(!autoFetch)}>
                Auto Fetch {autoFetch ? "(on)" : "(off)"}
              </Chip>
              <button
                disabled={loading}
                onClick={() => doFetch(RANGE_TO_HOURS[timeFilter])}
                className={classNames(
                  "px-3 py-2 rounded-xl text-sm",
                  loading
                    ? "bg-slate-300 text-slate-600 cursor-wait"
                    : darkMode
                    ? "bg-indigo-500 text-white hover:bg-indigo-600"
                    : "bg-indigo-700 text-white hover:bg-indigo-800"
                )}
              >
                {loading ? "Memuat..." : "Ambil Data Sekarang"}
              </button>
            </div>

            {/* Tabs */}
            <div className="flex flex-wrap gap-2">
              <TabButton id="overview" label="Overview" />
              <TabButton id="events" label="Events" />
              <TabButton id="news" label="News" />
              <TabButton id="quotes" label="Quotes" />
              <button
                onClick={() => setAsideOpen(true)}
                className={classNames("lg:hidden px-3 py-2 rounded-full text-sm border", darkMode ? "bg-slate-800 border-slate-600 text-slate-100" : "bg-white border-slate-300 hover:bg-slate-50")}
              >
                Panel Info
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Body */}
      <main className="max-w-7xl mx-auto px-3 sm:px-4 py-5 grid grid-cols-12 gap-4 sm:gap-6">
        {/* Main */}
        <section className="col-span-12 lg:col-span-8 space-y-4 sm:space-y-6">
          {/* Filters row */}
          <Card dark={darkMode}>
            <div className="flex flex-col md:flex-row md:flex-wrap items-start md:items-center gap-3">
              <div className="font-medium">Filter:</div>
              <Chip active={onlyMinister} onClick={() => setOnlyMinister(!onlyMinister)}>
                Hanya acara dihadiri Menhub {onlyMinister ? "(on)" : "(off)"}
              </Chip>
              <div className="flex items-center gap-2 w-full md:w-auto">
                <span className="opacity-80">Tag:</span>
                <div className="flex items-center gap-2">
                  <span className={classNames("text-xs px-2 py-0.5 rounded-full border", darkMode ? "bg-slate-700 border-slate-600" : "bg-slate-100 border-slate-200")}>
                    {tag === "All" ? `All (${tagsUniverse.length - 1})` : tag}
                  </span>
                  <button
                    onClick={() => setTagsOpen(true)}
                    className={classNames("px-2 py-1 rounded-md text-xs border", darkMode ? "bg-slate-800 border-slate-600" : "bg-white border-slate-300 hover:bg-slate-50")}
                  >
                    Kelola Tag
                  </button>
                </div>
              </div>
            </div>
          </Card>

          {/* Overview */}
          {tab === "overview" && (
            <div className="grid md:grid-cols-2 gap-4 sm:gap-6">
              {/* Events */}
              <Card dark={darkMode}>
                <SectionHeader
                  icon={<span className={classNames("w-2.5 h-2.5 rounded-full inline-block", darkMode ? "bg-indigo-400" : "bg-indigo-700")} />}
                  title="Events Terbaru (LIVE)"
                  right={
                    <button
                      className={classNames("text-sm underline-offset-2", darkMode ? "text-indigo-300 hover:underline" : "text-indigo-700 hover:underline")}
                      onClick={() => setTab("events")}
                    >
                      Lihat semua
                    </button>
                  }
                />
                <div className="space-y-4">
                  {filteredEvents.slice(0, 4).map((e) => (
                    <div key={e.id} className="flex gap-3">
                      <div className="w-14 text-xs opacity-70">{new Date(e.date).toLocaleDateString()}</div>
                      <div className="flex-1">
                        <div className="font-medium">{e.title}</div>
                        <div className="text-sm opacity-80">{e.location ? `${e.location} - ${e.source}` : e.source}</div>
                        <div className="text-sm mt-1 opacity-90">{e.summary}</div>
                      </div>
                    </div>
                  ))}
                  {filteredEvents.length === 0 && <Empty msg="Belum ada event (coba rentang waktu lebih panjang atau klik Ambil Data Sekarang)." />}
                </div>
              </Card>

              {/* News */}
              <Card dark={darkMode}>
                <SectionHeader
                  icon={<span className={classNames("w-2.5 h-2.5 rounded-full inline-block", darkMode ? "bg-indigo-400" : "bg-indigo-700")} />}
                  title="News Ringkas (LIVE)"
                  right={
                    <button
                      className={classNames("text-sm underline-offset-2", darkMode ? "text-indigo-300 hover:underline" : "text-indigo-700 hover:underline")}
                      onClick={() => setTab("news")}
                    >
                      Lihat semua
                    </button>
                  }
                />
                <div className="space-y-4">
                  {filteredNews.slice(0, 4).map((n) => (
                    <div key={n.id} className="flex gap-3">
                      <div className="w-14 text-xs opacity-70">{new Date(n.publishedAt).toLocaleDateString()}</div>
                      <div className="flex-1">
                        <div className="font-medium">{n.title}</div>
                        <div className="text-sm opacity-80">{n.source}</div>
                        <div className="text-sm mt-1 opacity-90">{n.summary}</div>
                      </div>
                    </div>
                  ))}
                  {filteredNews.length === 0 && <Empty msg="Belum ada news (coba rentang waktu lebih panjang atau klik Ambil Data Sekarang)." />}
                </div>
              </Card>

              {/* Quotes */}
              <Card dark={darkMode}>
                <SectionHeader
                  icon={<span className={classNames("w-2.5 h-2.5 rounded-full inline-block", darkMode ? "bg-indigo-400" : "bg-indigo-700")} />}
                  title="Quotes Terkini (LIVE)"
                  right={
                    <button
                      className={classNames("text-sm underline-offset-2", darkMode ? "text-indigo-300 hover:underline" : "text-indigo-700 hover:underline")}
                      onClick={() => setTab("quotes")}
                    >
                      Lihat semua
                    </button>
                  }
                />
                <div className="space-y-4">
                  {filteredQuotes.slice(0, 4).map((q) => (
                    <blockquote key={q.id} className={classNames("border-l-4 pl-3", darkMode ? "border-indigo-400/80" : "border-indigo-700/90")}>
                      <div className="italic">&quot;{q.text}&quot;</div>
                      <div className="text-sm opacity-80">- {q.speaker}</div>
                      <div className="text-xs opacity-70">{new Date(q.date).toLocaleDateString()} - {q.context}</div>
                    </blockquote>
                  ))}
                  {filteredQuotes.length === 0 && <Empty msg="Belum ada kutipan (tergantung isi berita, klik Ambil Data Sekarang)." />}
                </div>
              </Card>

              {/* Caption generator */}
              <Card dark={darkMode}>
                <SectionHeader icon={<span className={classNames("w-2.5 h-2.5 rounded-full inline-block", darkMode ? "bg-amber-400" : "bg-amber-500")} />} title="Generator Caption" />
                <div className="space-y-2">
                  <div className="text-sm opacity-80">Ambil item teratas dari News/Events setelah filter, lalu buat caption cepat.</div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={handleGenerateCaption}
                      className={classNames("px-3 py-2 rounded-xl", darkMode ? "bg-indigo-500 text-white hover:bg-indigo-600" : "bg-indigo-700 text-white hover:bg-indigo-800")}
                    >
                      Generate
                    </button>
                    <button
                      onClick={handleCopy}
                      disabled={!caption}
                      className={classNames("px-3 py-2 rounded-xl border", darkMode ? "border-slate-600 hover:bg-slate-800" : "border-slate-300 hover:bg-slate-50", !caption && "opacity-50 cursor-not-allowed")}
                    >
                      Copy
                    </button>
                    {caption && <StatBadge>Siap diposting</StatBadge>}
                  </div>
                  <textarea
                    className={classNames("w-full h-28 p-3 rounded-xl border focus:outline-none", darkMode ? "bg-slate-800 border-slate-600 text-slate-100 focus:ring-2 focus:ring-indigo-500" : "border-slate-300 focus:ring-2 focus:ring-indigo-600")}
                    value={caption}
                    onChange={(e) => setCaption(e.target.value)}
                  />
                  {toast && <div className="text-sm opacity-90">{toast}</div>}
                </div>
              </Card>
            </div>
          )}

          {/* Events tab */}
          {tab === "events" && (
            <Card dark={darkMode}>
              <SectionHeader
                icon={<span className={classNames("w-2.5 h-2.5 rounded-full inline-block", darkMode ? "bg-indigo-400" : "bg-indigo-700")} />}
                title="Daftar Events (LIVE)"
                right={<div className="text-sm flex items-center gap-2"><StatBadge>{filteredEvents.length} item</StatBadge></div>}
              />
              <div className="divide-y" style={{ borderColor: darkMode ? "#334155" : "#e2e8f0" }}>
                {filteredEvents.map((e) => (
                  <div key={e.id} className="py-3 flex flex-col sm:flex-row sm:items-start gap-3 sm:gap-4">
                    <div className="sm:w-40 text-xs opacity-70">{formatDate(e.date)}</div>
                    <div className="flex-1">
                      <div className="font-medium">{e.title}</div>
                      <div className="text-sm opacity-80">{e.location ? `${e.location} - ${e.source}` : e.source}</div>
                      <div className="text-sm mt-1 opacity-90">{e.summary}</div>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {e.tags.map((t) => (
                          <span key={t} className={classNames("px-2 py-0.5 rounded-full text-xs border", darkMode ? "bg-slate-700 border-slate-600" : "bg-slate-100 border-slate-200")}>{t}</span>
                        ))}
                      </div>
                    </div>
                    <div className="flex flex-row sm:flex-col gap-2 sm:items-end">
                      {e.attendedByMinister && <span className="text-[10px] uppercase tracking-wide bg-amber-500 text-white px-2 py-1 rounded">Menhub hadir</span>}
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
                {filteredEvents.length === 0 && <Empty msg="Tidak ada event ditemukan untuk filter saat ini." />}
              </div>
            </Card>
          )}

          {/* News tab */}
          {tab === "news" && (
            <Card dark={darkMode}>
              <SectionHeader
                icon={<span className={classNames("w-2.5 h-2.5 rounded-full inline-block", darkMode ? "bg-indigo-400" : "bg-indigo-700")} />}
                title="Berita Terbaru (LIVE)"
                right={<div className="text-sm flex items-center gap-2"><StatBadge>{filteredNews.length} item</StatBadge></div>}
              />
              <div className="divide-y" style={{ borderColor: darkMode ? "#334155" : "#e2e8f0" }}>
                {filteredNews.map((n) => (
                  <div key={n.id} className="py-3 flex flex-col sm:flex-row sm:items-start gap-3 sm:gap-4">
                    <div className="sm:w-40 text-xs opacity-70">{formatDate(n.publishedAt)}</div>
                    <div className="flex-1">
                      <div className="font-medium">{n.title}</div>
                      <div className="text-sm opacity-80">{n.source}</div>
                      <div className="text-sm mt-1 opacity-90">{n.summary}</div>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {n.entities.map((t) => (
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
                {filteredNews.length === 0 && <Empty msg="Belum ada berita ditemukan untuk filter saat ini." />}
              </div>
            </Card>
          )}

          {/* Quotes tab */}
          {tab === "quotes" && (
            <Card dark={darkMode}>
              <SectionHeader
                icon={<span className={classNames("w-2.5 h-2.5 rounded-full inline-block", darkMode ? "bg-indigo-400" : "bg-indigo-700")} />}
                title="Kutipan Penting (LIVE)"
                right={<div className="text-sm flex items-center gap-2"><StatBadge>{filteredQuotes.length} item</StatBadge></div>}
              />
              <div className="grid md:grid-cols-2 gap-4">
                {filteredQuotes.map((q) => (
                  <Card key={q.id} dark={darkMode}>
                    <blockquote>
                      <div className="italic text-base md:text-lg">&quot;{q.text}&quot;</div>
                      <div className="text-sm opacity-80">- {q.speaker}</div>
                      <div className="text-xs opacity-70">{new Date(q.date).toLocaleDateString()} - {q.context}</div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {q.tags.map((t) => (
                          <span key={t} className={classNames("px-2 py-0.5 rounded-full text-xs border", darkMode ? "bg-slate-700 border-slate-600" : "bg-slate-100 border-slate-200")}>{t}</span>
                        ))}
                        <a
                          href={q.link}
                          title={q.link === "#" ? "Sumber belum tersedia (dummy)" : "Buka sumber di tab baru"}
                          target={q.link === "#" ? undefined : "_blank"}
                          rel={q.link === "#" ? undefined : "noopener noreferrer"}
                          onClick={(ev) => handleLinkClick(ev, q.link)}
                          className={classNames("text-sm ml-auto", darkMode ? "text-indigo-300 hover:underline" : "text-indigo-700 hover:underline")}
                        >
                          Buka sumber
                        </a>
                      </div>
                    </blockquote>
                  </Card>
                ))}
                {filteredQuotes.length === 0 && <Empty msg="Belum ada kutipan pada rentang/filter ini." />}
              </div>
            </Card>
          )}
        </section>

        {/* Aside */}
        <aside className="col-span-12 lg:col-span-4 space-y-4 sm:space-y-6 lg:sticky lg:top-20 self-start">
          <div className="hidden lg:block">
            <Card dark={darkMode}>
              <SectionHeader icon={<span className={classNames("w-2.5 h-2.5 rounded-full inline-block", darkMode ? "bg-amber-400" : "bg-amber-500")} />} title="Status Ingestor" />
              <ul className="text-sm space-y-2">
                <li>Portal Berita: <span className="text-emerald-500 font-medium">{loading ? "Memuat" : "OK"}</span> {loading ? "" : "- terakhir saat fetch"}</li>
                <li>Filter Waktu: <span className="font-medium">{timeFilter}</span></li>
                <li>Auto Fetch: <span className="font-medium">{autoFetch ? "ON" : "OFF"}</span></li>
              </ul>
            </Card>

            <Card dark={darkMode}>
              <SectionHeader icon={<span className={classNames("w-2.5 h-2.5 rounded-full inline-block", darkMode ? "bg-amber-400" : "bg-amber-500")} />} title="Sumber (contoh)" />
              <div className="text-sm">
                <ul className="list-disc ml-5 mt-1 space-y-1">
                  <li>Antara Nasional (RSS)</li>
                  <li>Kompas (RSS)</li>
                  <li>Tempo Nasional (RSS)</li>
                  <li>Bisnis.com Nasional (RSS)</li>
                  <li>(Tambahkan RSS resmi Kemenhub jika tersedia)</li>
                </ul>
              </div>
            </Card>

            <Card dark={darkMode}>
              <SectionHeader icon={<span className={classNames("w-2.5 h-2.5 rounded-full inline-block", darkMode ? "bg-amber-400" : "bg-amber-500")} />} title="Pedoman Editorial Singkat" />
              <details>
                <summary className="cursor-pointer select-none font-medium">Lihat pedoman</summary>
                <ol className="list-decimal ml-5 mt-2 text-sm space-y-1">
                  <li>Verifikasi silang minimal 2 sumber untuk kutipan langsung.</li>
                  <li>Sertakan tanggal & tautan sumber pada caption.</li>
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
                  <SectionHeader icon={<span className={classNames("w-2.5 h-2.5 rounded-full inline-block", darkMode ? "bg-amber-400" : "bg-amber-500")} />} title="Status Ingestor" />
                  <ul className="text-sm space-y-2">
                    <li>Portal Berita: <span className="text-emerald-500 font-medium">{loading ? "Memuat" : "OK"}</span></li>
                    <li>Filter Waktu: <span className="font-medium">{timeFilter}</span></li>
                    <li>Auto Fetch: <span className="font-medium">{autoFetch ? "ON" : "OFF"}</span></li>
                  </ul>
                </Card>
                <div className="h-3" />
                <Card dark={darkMode}>
                  <SectionHeader icon={<span className={classNames("w-2.5 h-2.5 rounded-full inline-block", darkMode ? "bg-amber-400" : "bg-amber-500")} />} title="Sumber (contoh)" />
                  <ul className="list-disc ml-5 mt-1 space-y-1 text-sm">
                    <li>Antara Nasional (RSS)</li>
                    <li>Kompas (RSS)</li>
                    <li>Tempo Nasional (RSS)</li>
                    <li>Bisnis.com Nasional (RSS)</li>
                    <li>(Tambahkan RSS resmi Kemenhub jika tersedia)</li>
                  </ul>
                </Card>
                <div className="h-3" />
                <Card dark={darkMode}>
                  <SectionHeader icon={<span className={classNames("w-2.5 h-2.5 rounded-full inline-block", darkMode ? "bg-amber-400" : "bg-amber-500")} />} title="Pedoman Editorial Singkat" />
                  <ol className="list-decimal ml-5 mt-2 text-sm space-y-1">
                    <li>Verifikasi 2 sumber untuk kutipan langsung.</li>
                    <li>Sertakan tanggal dan tautan sumber pada caption.</li>
                    <li>Gunakan foto atau visual resmi atau berlisensi.</li>
                  </ol>
                </Card>
              </div>
            </div>
          )}
        </aside>
      </main>

      {/* Panel Tags */}
      {tagsOpen && (
        <div className="fixed inset-0 z-40">
          <div className="absolute inset-0 bg-black/30" onClick={() => setTagsOpen(false)} />
          <div className={classNames("absolute right-0 top-0 h-full w-96 max-w-[90%] shadow-2xl p-4 overflow-y-auto", darkMode ? "bg-slate-800" : "bg-white")}>
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
                className={classNames("px-3 py-2 rounded-xl border text-sm", darkMode ? "bg-slate-800 border-slate-600" : "bg-white border-slate-300 hover:bg-slate-50")}
              >
                Reset ke All
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && <div className="fixed bottom-4 right-4 z-50 text-sm px-4 py-3 rounded-lg shadow-lg text-white bg-slate-900">{toast}</div>}

      <footer className="max-w-7xl mx-auto px-3 sm:px-4 pb-10 text-xs opacity-70">Prototype LIVE — data berasal dari RSS media yang menyebut Menhub/Kemenhub. Tambahkan RSS resmi Kemenhub untuk hasil lebih kaya.</footer>
    </div>
  );
}
