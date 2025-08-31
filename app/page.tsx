"use client";
import React, { useMemo, useState } from "react";

// =============================
// Command Center Kemenhub - Prototype UI (Next.js/App Router)
// Tailwind CSS required. ASCII-only to satisfy ESLint/react rules.
// =============================

// --- Sample seed data (mock) ---
const NOW = new Date();
const daysAgo = (n: number) => {
  const d = new Date(NOW);
  d.setDate(d.getDate() - n);
  return d;
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

type NewsItem = {
  id: string;
  title: string;
  source: string;
  publishedAt: string;
  link: string;
  summary?: string;
  entities?: string[];
  note?: string;
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

// Union helper to avoid any
type CombinedItem = EventItem | NewsItem | QuoteItem;

const sampleEvents: EventItem[] = [
  {
    id: "evt-001",
    title: "Rapat Koordinasi Keselamatan Pelayaran",
    date: daysAgo(0).toISOString(),
    location: "Kemenhub, Jakarta",
    attendedByMinister: true,
    source: "dephub.go.id",
    tags: ["Keselamatan", "Laut"],
    summary:
      "Menhub memimpin rakor dan menekankan zero accident di jalur pelayaran utama.",
    link: "#",
  },
  {
    id: "evt-002",
    title: "Peresmian Terminal Tipe A",
    date: daysAgo(2).toISOString(),
    location: "Makassar, Sulsel",
    attendedByMinister: true,
    source: "IG @kemenhub151",
    tags: ["Darat", "Infrastruktur"],
    summary:
      "Peresmian terminal baru untuk meningkatkan konektivitas antarkota di Sulawesi.",
    link: "https://www.dephub.go.id/",
  },
  {
    id: "evt-003",
    title: "Diskusi Publik: Green Transportation",
    date: daysAgo(5).toISOString(),
    location: "Bandung, Jabar",
    attendedByMinister: false,
    source: "Siarkanews",
    tags: ["Green", "Kebijakan"],
    summary:
      "Staf ahli Kemenhub mewakili Menhub membahas roadmap transportasi rendah emisi.",
    link: "#",
  },
];

const sampleNews: NewsItem[] = [
  {
    id: "news-101",
    title:
      "Menhub Dorong Integrasi Moda untuk Kurangi Kemacetan di Metropolitan",
    source: "Antara",
    publishedAt: daysAgo(0).toISOString(),
    link: "https://www.antaranews.com/",
    summary:
      "Dalam keterangan pers, Menhub menyoroti pentingnya integrasi antarmoda dan tiket terusan.",
    entities: ["Menteri Perhubungan", "Integrasi Moda", "Kemacetan"],
  },
  {
    id: "news-102",
    title: "Kemenhub Keluarkan Aturan Baru Keselamatan Penerbangan",
    source: "Kompas",
    publishedAt: daysAgo(1).toISOString(),
    link: "#",
    summary:
      "Regulasi baru menekankan audit berkala dan peningkatan pelatihan bagi maskapai.",
    entities: ["Kemenhub", "Penerbangan", "Regulasi"],
  },
  {
    id: "news-103",
    title: "Uji Coba Bus Listrik di 3 Kota Besar Diperluas",
    source: "Tempo",
    publishedAt: daysAgo(4).toISOString(),
    link: "#",
    summary:
      "Pilot project bus listrik memasuki fase pengembangan infrastruktur pengisian daya.",
    entities: ["Bus Listrik", "Perkotaan", "Emisi"],
  },
];

const sampleQuotes: QuoteItem[] = [
  {
    id: "q-01",
    text:
      "Keselamatan adalah prioritas utama - tidak boleh ada kompromi di darat, laut, maupun udara.",
    speaker: "Menteri Perhubungan",
    date: daysAgo(0).toISOString(),
    context:
      "Pernyataan di rapat koordinasi keselamatan pelayaran, Jakarta.",
    link: "#",
    tags: ["Keselamatan", "Kebijakan"],
  },
  {
    id: "q-02",
    text:
      "Integrasi antarmoda bukan pilihan, melainkan kebutuhan kota-kota besar Indonesia.",
    speaker: "Menteri Perhubungan",
    date: daysAgo(1).toISOString(),
    context:
      "Keterangan pers mengenai integrasi moda di wilayah metropolitan.",
    link: "https://www.dephub.go.id/",
    tags: ["Integrasi Moda", "Perkotaan"],
  },
  {
    id: "q-03",
    text:
      "Transisi ke transportasi rendah emisi harus disertai skema pendanaan yang berkelanjutan.",
    speaker: "Menteri Perhubungan",
    date: daysAgo(6).toISOString(),
    context: "Diskusi publik tentang green transportation.",
    link: "#",
    tags: ["Green", "Pendanaan"],
  },
];

// Utilities
const formatDate = (iso: string) => new Date(iso).toLocaleString();
const classNames = (...c: Array<string | false | undefined>) =>
  c.filter(Boolean).join(" ");

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
        active
          ? "bg-indigo-600 text-white border-indigo-600"
          : "bg-white text-slate-700 border-slate-300 hover:bg-slate-50"
      )}
    >
      {children}
    </button>
  );
}

function StatBadge({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800 border border-amber-200">
      {children}
    </span>
  );
}

function Card({ children, dark }: { children: React.ReactNode; dark?: boolean }) {
  return (
    <div
      className={classNames(
        "rounded-xl shadow-sm border p-4",
        dark ? "bg-slate-800/70 border-slate-700" : "bg-white border-slate-200"
      )}
    >
      {children}
    </div>
  );
}

function Empty({ msg }: { msg: string }) {
  return (
    <div className="text-center text-slate-500 border border-dashed rounded-xl p-6">
      {msg}
    </div>
  );
}

// Filters
function getMinDate(key: "24h" | "7d" | "30d" | "90d") {
  const d = new Date();
  const map: Record<string, number> = { "24h": 1, "7d": 7, "30d": 30, "90d": 90 };
  d.setDate(d.getDate() - (map[key] ?? 7));
  return d;
}

function filterEvents(
  data: EventItem[],
  {
    minDate,
    onlyMinister,
    tag,
    query,
  }: { minDate: Date; onlyMinister: boolean; tag: string; query: string }
) {
  return data
    .filter((e) => new Date(e.date) >= minDate)
    .filter((e) => (onlyMinister ? e.attendedByMinister : true))
    .filter((e) => (tag === "All" ? true : (e.tags || []).includes(tag)))
    .filter((e) => {
      if (!query) return true;
      const hay = [
        e.title,
        e.location,
        e.summary,
        e.source,
        ...(e.tags || []),
      ]
        .join(" ")
        .toLowerCase();
      return hay.includes(query.toLowerCase());
    })
    .sort((a, b) => +new Date(b.date) - +new Date(a.date));
}

function filterNews(
  data: NewsItem[],
  { minDate, tag, query }: { minDate: Date; tag: string; query: string }
) {
  return data
    .filter((n) => new Date(n.publishedAt) >= minDate)
    .filter((n) => (tag === "All" ? true : (n.entities || []).includes(tag)))
    .filter((n) => {
      if (!query) return true;
      const hay = [n.title, n.summary, n.source, ...(n.entities || [])]
        .join(" ")
        .toLowerCase();
      return hay.includes(query.toLowerCase());
    })
    .sort((a, b) => +new Date(b.publishedAt) - +new Date(a.publishedAt));
}

function filterQuotes(
  data: QuoteItem[],
  { minDate, tag, query }: { minDate: Date; tag: string; query: string }
) {
  return data
    .filter((q) => new Date(q.date) >= minDate)
    .filter((q) => (tag === "All" ? true : (q.tags || []).includes(tag)))
    .filter((q) => {
      if (!query) return true;
      const hay = [q.text, q.context, q.speaker, ...(q.tags || [])]
        .join(" ")
        .toLowerCase();
      return hay.includes(query.toLowerCase());
    })
    .sort((a, b) => +new Date(b.date) - +new Date(a.date));
}

// Clipboard helper
async function copyToClipboard(text: string) {
  try {
    if (navigator && navigator.clipboard && navigator.clipboard.writeText) {
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

export default function DashboardPrototype() {
  const [tab, setTab] = useState<"overview" | "events" | "news" | "quotes">(
    "overview"
  );
  const [query, setQuery] = useState("");
  const [tag, setTag] = useState("All");
  const [timeFilter, setTimeFilter] = useState<"24h" | "7d" | "30d" | "90d">(
    "7d"
  );
  const [onlyMinister, setOnlyMinister] = useState(true);
  const [caption, setCaption] = useState("");
  const [toast, setToast] = useState("");
  const [asideOpen, setAsideOpen] = useState(false);
  const [tagsOpen, setTagsOpen] = useState(false);
  const [darkMode, setDarkMode] = useState(false);

  // ===== LIVE data states =====
  const [liveNews, setLiveNews] = useState<NewsItem[]>([]);
  const [liveEvents, setLiveEvents] = useState<EventItem[]>([]);
  const [liveQuotes, setLiveQuotes] = useState<QuoteItem[]>([]);
  const [dataMode, setDataMode] = useState<"LIVE" | "MOCK">("MOCK");
  const [lastSync, setLastSync] = useState<string>("");

  // Ambil data LIVE dari /api/items (news aktif; events/quotes kosong dulu)
  React.useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await fetch("/api/items?types=news,events,quotes");
        if (!res.ok) throw new Error("bad status");
        const json = await res.json();
        if (!mounted) return;

        if (Array.isArray(json.news) && json.news.length) setLiveNews(json.news as NewsItem[]);
        if (Array.isArray(json.events) && json.events.length) setLiveEvents(json.events as EventItem[]);
        if (Array.isArray(json.quotes) && json.quotes.length) setLiveQuotes(json.quotes as QuoteItem[]);

        if (
          (json.news?.length ?? 0) +
            (json.events?.length ?? 0) +
            (json.quotes?.length ?? 0) >
          0
        ) {
          setDataMode("LIVE");
          setLastSync(
            new Date().toLocaleString("id-ID", { timeZone: "Asia/Jakarta" })
          );
        } else {
          setDataMode("MOCK");
        }
      } catch {
        if (!mounted) return;
        setDataMode("MOCK");
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const minDate = useMemo(() => getMinDate(timeFilter), [timeFilter]);

  const tagsUniverse = useMemo(() => {
    const set = new Set<string>(["All"]);
    const all: CombinedItem[] = [
      ...(liveEvents.length ? liveEvents : sampleEvents),
      ...(liveNews.length ? liveNews : sampleNews),
      ...(liveQuotes.length ? liveQuotes : sampleQuotes),
    ];
    all.forEach((it) => {
      if ("tags" in it && Array.isArray((it as EventItem | QuoteItem).tags)) {
        (it as EventItem | QuoteItem).tags!.forEach((t) => set.add(t));
      }
      if ("entities" in (it as NewsItem) && Array.isArray((it as NewsItem).entities)) {
        (it as NewsItem).entities!.forEach((t) => set.add(t));
      }
    });
    return [...set];
  }, [liveEvents, liveNews, liveQuotes]);

  // ===== Pakai LIVE bila ada, fallback mock =====
  const filteredEvents = useMemo(
    () =>
      filterEvents(liveEvents.length ? liveEvents : sampleEvents, {
        minDate,
        onlyMinister,
        tag,
        query,
      }),
    [minDate, onlyMinister, tag, query, liveEvents]
  );
  const filteredNews = useMemo(
    () =>
      filterNews(liveNews.length ? liveNews : sampleNews, {
        minDate,
        tag,
        query,
      }),
    [minDate, tag, query, liveNews]
  );
  const filteredQuotes = useMemo(
    () =>
      filterQuotes(liveQuotes.length ? liveQuotes : sampleQuotes, {
        minDate,
        tag,
        query,
      }),
    [minDate, tag, query, liveQuotes]
  );

  const handleGenerateCaption = () => {
    const top: EventItem | NewsItem | undefined =
      (filteredNews[0] as NewsItem | undefined) ||
      (filteredEvents[0] as EventItem | undefined);
    if (!top) {
      setToast("Tidak ada item untuk dijadikan caption");
      setTimeout(() => setToast(""), 1800);
      return;
    }
    const title = top.title ?? "Pembaruan kegiatan hari ini";
    const info =
      "summary" in top && top.summary
        ? top.summary
        : "source" in top
        ? (top as NewsItem).source
        : "Info terbaru";
    const base = `Menhub: ${title} - ${info}. #Kemenhub #Transportasi`;
    setCaption(base);
    setToast("Caption dibuat");
    setTimeout(() => setToast(""), 1500);
  };

  const handleCopy = async () => {
    if (!caption) return;
    const ok = await copyToClipboard(caption);
    if (ok) {
      setToast("Caption disalin ke clipboard");
    } else {
      setToast("Gagal menyalin clipboard. Pilih teks lalu Ctrl/Cmd+C.");
    }
    setTimeout(() => setToast(""), 1800);
  };

  const handleLinkClick = (
    ev: React.MouseEvent<HTMLAnchorElement>,
    link: string
  ) => {
    if (link === "#") {
      ev.preventDefault();
      setToast("Sumber belum tersedia");
      setTimeout(() => setToast(""), 1500);
    }
  };

  const TabButton = ({
    id,
    label,
  }: {
    id: "overview" | "events" | "news" | "quotes";
    label: string;
  }) => (
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

      <header
        className={classNames(
          "sticky top-0 z-20 border-b backdrop-blur",
          darkMode
            ? "bg-slate-800/80 text-white border-slate-700"
            : "bg-white/80 text-slate-900 border-slate-200"
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
              <div className="text-xs opacity-70">
                Internal - Prototype UI
                {/* Badge status data */}
                <span
                  className={
                    "ml-2 px-2 py-0.5 rounded-full text-[10px] uppercase tracking-wide border " +
                    (dataMode === "LIVE"
                      ? darkMode
                        ? "bg-emerald-900/40 border-emerald-500 text-emerald-300"
                        : "bg-emerald-50 border-emerald-600 text-emerald-700"
                      : darkMode
                      ? "bg-slate-700 border-slate-500 text-slate-200"
                      : "bg-slate-100 border-slate-400 text-slate-700")
                  }
                >
                  Data: {dataMode}
                  {lastSync ? ` • Last sync ${lastSync}` : ""}
                </span>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 items-center">
            <input
              className={classNames(
                "min-w-[140px] sm:min-w-[220px] md:min-w-[260px] w-full sm:w-auto px-3 py-2 rounded-xl border focus:outline-none",
                darkMode
                  ? "bg-slate-800 border-slate-600 text-slate-100 focus:ring-2 focus:ring-indigo-500"
                  : "border-slate-300 focus:ring-2 focus:ring-indigo-600"
              )}
              placeholder="Cari event, berita, quote"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <select
              className={classNames(
                "px-3 py-2 rounded-xl border focus:outline-none",
                darkMode
                  ? "bg-slate-800 border-slate-600 text-slate-100 focus:ring-2 focus:ring-indigo-500"
                  : "border-slate-300 focus:ring-2 focus:ring-indigo-600"
              )}
              value={timeFilter}
              onChange={(e) =>
                setTimeFilter(
                  e.target.value as "24h" | "7d" | "30d" | "90d"
                )
              }
            >
              <option value="24h">24 jam</option>
              <option value="7d">7 hari</option>
              <option value="30d">30 hari</option>
              <option value="90d">90 hari</option>
            </select>
            <div className="flex flex-wrap gap-2">
              <TabButton id="overview" label="Overview" />
              <TabButton id="events" label="Events" />
              <TabButton id="news" label="News" />
              <TabButton id="quotes" label="Quotes" />
              <button
                onClick={() => setAsideOpen(true)}
                className={classNames(
                  "lg:hidden px-3 py-2 rounded-full text-sm border",
                  darkMode
                    ? "bg-slate-800 border-slate-600 text-slate-100"
                    : "bg-white border-slate-300 hover:bg-slate-50"
                )}
              >
                Panel Info
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-3 sm:px-4 py-5 grid grid-cols-12 gap-4 sm:gap-6">
        <section className="col-span-12 lg:col-span-8 space-y-4 sm:space-y-6">
          <Card dark={darkMode}>
            <div className="flex flex-col md:flex-row md:flex-wrap items-start md:items-center gap-3">
              <div className="font-medium">Filter:</div>
              <Chip active={onlyMinister} onClick={() => setOnlyMinister(!onlyMinister)}>
                Hanya acara dihadiri Menhub {onlyMinister ? "(on)" : "(off)"}
              </Chip>
              <div className="flex items-center gap-2 w-full md:w-auto">
                <span className="opacity-80">Tag:</span>
                <div className="flex items-center gap-2">
                  <span
                    className={classNames(
                      "text-xs px-2 py-0.5 rounded-full border",
                      darkMode
                        ? "bg-slate-700 border-slate-600"
                        : "bg-slate-100 border-slate-200"
                    )}
                  >
                    {tag === "All" ? `All (${tagsUniverse.length - 1})` : tag}
                  </span>
                  <button
                    onClick={() => setTagsOpen(true)}
                    className={classNames(
                      "px-2 py-1 rounded-md text-xs border",
                      darkMode
                        ? "bg-slate-800 border-slate-600"
                        : "bg-white border-slate-300 hover:bg-slate-50"
                    )}
                  >
                    Kelola Tag
                  </button>
                </div>
              </div>
            </div>
          </Card>

          {tab === "overview" && (
            <div className="grid md:grid-cols-2 gap-4 sm:gap-6">
              <Card dark={darkMode}>
                <SectionHeader
                  icon={
                    <span
                      className={classNames(
                        "w-2.5 h-2.5 rounded-full inline-block",
                        darkMode ? "bg-indigo-400" : "bg-indigo-700"
                      )}
                    />
                  }
                  title="Events Terbaru"
                  right={
                    <button
                      className={classNames(
                        "text-sm underline-offset-2",
                        darkMode
                          ? "text-indigo-300 hover:underline"
                          : "text-indigo-700 hover:underline"
                      )}
                      onClick={() => setTab("events")}
                    >
                      Lihat semua
                    </button>
                  }
                />
                <div className="space-y-4">
                  {filteredEvents.slice(0, 4).map((e) => (
                    <div key={e.id} className="flex gap-3">
                      <div className="w-14 text-xs opacity-70">
                        {new Date(e.date).toLocaleDateString()}
                      </div>
                      <div className="flex-1">
                        <div className="font-medium">{e.title}</div>
                        <div className="text-sm opacity-80">
                          {e.location} - {e.source}
                        </div>
                        <div className="text-sm mt-1 opacity-90">{e.summary}</div>
                      </div>
                    </div>
                  ))}
                  {filteredEvents.length === 0 && (
                    <Empty msg="Tidak ada event dalam rentang waktu ini." />
                  )}
                </div>
              </Card>

              <Card dark={darkMode}>
                <SectionHeader
                  icon={
                    <span
                      className={classNames(
                        "w-2.5 h-2.5 rounded-full inline-block",
                        darkMode ? "bg-indigo-400" : "bg-indigo-700"
                      )}
                    />
                  }
                  title="News Ringkas"
                  right={
                    <button
                      className={classNames(
                        "text-sm underline-offset-2",
                        darkMode
                          ? "text-indigo-300 hover:underline"
                          : "text-indigo-700 hover:underline"
                      )}
                      onClick={() => setTab("news")}
                    >
                      Lihat semua
                    </button>
                  }
                />
                <div className="space-y-4">
                  {filteredNews.slice(0, 4).map((n) => (
                    <div key={n.id} className="flex gap-3">
                      <div className="w-14 text-xs opacity-70">
                        {new Date(n.publishedAt).toLocaleDateString()}
                      </div>
                      <div className="flex-1">
                        <div className="font-medium">{n.title}</div>
                        <div className="text-sm opacity-80">{n.source}</div>
                        <div className="text-sm mt-1 opacity-90">{n.summary}</div>
                      </div>
                    </div>
                  ))}
                  {filteredNews.length === 0 && (
                    <Empty msg="Belum ada berita pada rentang ini." />
                  )}
                </div>
              </Card>

              <Card dark={darkMode}>
                <SectionHeader
                  icon={
                    <span
                      className={classNames(
                        "w-2.5 h-2.5 rounded-full inline-block",
                        darkMode ? "bg-indigo-400" : "bg-indigo-700"
                      )}
                    />
                  }
                  title="Quotes Terkini"
                  right={
                    <button
                      className={classNames(
                        "text-sm underline-offset-2",
                        darkMode
                          ? "text-indigo-300 hover:underline"
                          : "text-indigo-700 hover:underline"
                      )}
                      onClick={() => setTab("quotes")}
                    >
                      Lihat semua
                    </button>
                  }
                />
                <div className="space-y-4">
                  {filteredQuotes.slice(0, 4).map((q) => (
                    <blockquote
                      key={q.id}
                      className={classNames(
                        "border-l-4 pl-3",
                        darkMode ? "border-indigo-400/80" : "border-indigo-700/90"
                      )}
                    >
                      <div className="italic">&quot;{q.text}&quot;</div>
                      <div className="text-sm opacity-80">- {q.speaker}</div>
                      <div className="text-xs opacity-70">
                        {new Date(q.date).toLocaleDateString()} - {q.context}
                      </div>
                    </blockquote>
                  ))}
                  {filteredQuotes.length === 0 && (
                    <Empty msg="Belum ada kutipan pada rentang ini." />
                  )}
                </div>
              </Card>

              <Card dark={darkMode}>
                <SectionHeader
                  icon={
                    <span
                      className={classNames(
                        "w-2.5 h-2.5 rounded-full inline-block",
                        darkMode ? "bg-amber-400" : "bg-amber-500"
                      )}
                    />
                  }
                  title="Generator Caption (Manual Stub)"
                />
                <div className="space-y-2">
                  <div className="text-sm opacity-80">
                    Ambil item teratas dari News atau Events setelah filter, lalu buat
                    caption cepat.
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={handleGenerateCaption}
                      className={classNames(
                        "px-3 py-2 rounded-xl",
                        darkMode
                          ? "bg-indigo-500 text-white hover:bg-indigo-600"
                          : "bg-indigo-700 text-white hover:bg-indigo-800"
                      )}
                    >
                      Generate
                    </button>
                    <button
                      onClick={handleCopy}
                      disabled={!caption}
                      className={classNames(
                        "px-3 py-2 rounded-xl border",
                        darkMode
                          ? "border-slate-600 hover:bg-slate-800"
                          : "border-slate-300 hover:bg-slate-50",
                        !caption && "opacity-50 cursor-not-allowed"
                      )}
                    >
                      Copy
                    </button>
                    {caption && <StatBadge>Siap diposting</StatBadge>}
                  </div>
                  <textarea
                    className={classNames(
                      "w-full h-28 p-3 rounded-xl border focus:outline-none",
                      darkMode
                        ? "bg-slate-800 border-slate-600 text-slate-100 focus:ring-2 focus:ring-indigo-500"
                        : "border-slate-300 focus:ring-2 focus:ring-indigo-600"
                    )}
                    value={caption}
                    onChange={(e) => setCaption(e.target.value)}
                  />
                  {toast && <div className="text-sm opacity-90">{toast}</div>}
                </div>
              </Card>
            </div>
          )}

          {tab === "events" && (
            <Card dark={darkMode}>
              <SectionHeader
                icon={
                  <span
                    className={classNames(
                      "w-2.5 h-2.5 rounded-full inline-block",
                      darkMode ? "bg-indigo-400" : "bg-indigo-700"
                    )}
                  />
                }
                title="Daftar Events"
                right={
                  <div className="text-sm flex items-center gap-2">
                    <StatBadge>{filteredEvents.length} item</StatBadge>
                  </div>
                }
              />
              <div
                className="divide-y"
                style={{ borderColor: darkMode ? "#334155" : "#e2e8f0" }}
              >
                {filteredEvents.map((e) => (
                  <div
                    key={e.id}
                    className="py-3 flex flex-col sm:flex-row sm:items-start gap-3 sm:gap-4"
                  >
                    <div className="sm:w-40 text-xs opacity-70">
                      {formatDate(e.date)}
                    </div>
                    <div className="flex-1">
                      <div className="font-medium">{e.title}</div>
                      <div className="text-sm opacity-80">
                        {e.location} - {e.source}
                      </div>
                      <div className="text-sm mt-1 opacity-90">{e.summary}</div>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {e.tags?.map((t) => (
                          <span
                            key={t}
                            className={classNames(
                              "px-2 py-0.5 rounded-full text-xs border",
                              darkMode
                                ? "bg-slate-700 border-slate-600"
                                : "bg-slate-100 border-slate-200"
                            )}
                          >
                            {t}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className="flex flex-row sm:flex-col gap-2 sm:items-end">
                      {e.attendedByMinister && (
                        <span className="text-[10px] uppercase tracking-wide bg-amber-500 text-white px-2 py-1 rounded">
                          Menhub hadir
                        </span>
                      )}
                      <a
                        href={e.link}
                        title={
                          e.link === "#"
                            ? "Sumber belum tersedia (dummy)"
                            : "Buka sumber di tab baru"
                        }
                        target={e.link === "#" ? undefined : "_blank"}
                        rel={e.link === "#" ? undefined : "noopener noreferrer"}
                        onClick={(ev) => handleLinkClick(ev, e.link)}
                        className={classNames(
                          "text-sm",
                          darkMode
                            ? "text-indigo-300 hover:underline"
                            : "text-indigo-700 hover:underline"
                        )}
                      >
                        Buka sumber
                      </a>
                    </div>
                  </div>
                ))}
                {filteredEvents.length === 0 && (
                  <Empty msg="Tidak ada event ditemukan." />
                )}
              </div>
            </Card>
          )}

          {tab === "news" && (
            <Card dark={darkMode}>
              <SectionHeader
                icon={
                  <span
                    className={classNames(
                      "w-2.5 h-2.5 rounded-full inline-block",
                      darkMode ? "bg-indigo-400" : "bg-indigo-700"
                    )}
                  />
                }
                title="Berita Terbaru"
                right={
                  <div className="text-sm flex items-center gap-2">
                    <StatBadge>{filteredNews.length} item</StatBadge>
                  </div>
                }
              />
              <div
                className="divide-y"
                style={{ borderColor: darkMode ? "#334155" : "#e2e8f0" }}
              >
                {filteredNews.map((n) => (
                  <div
                    key={n.id}
                    className="py-3 flex flex-col sm:flex-row sm:items-start gap-3 sm:gap-4"
                  >
                    <div className="sm:w-40 text-xs opacity-70">
                      {formatDate(n.publishedAt)}
                    </div>
                    <div className="flex-1">
                      <div className="font-medium">{n.title}</div>
                      <div className="text-sm opacity-80">{n.source}</div>
                      <div className="text-sm mt-1 opacity-90">{n.summary}</div>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {n.entities?.map((t) => (
                          <span
                            key={t}
                            className={classNames(
                              "px-2 py-0.5 rounded-full text-xs border",
                              darkMode
                                ? "bg-slate-700 border-slate-600"
                                : "bg-slate-100 border-slate-200"
                            )}
                          >
                            {t}
                          </span>
                        ))}
                        {n.note && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] border bg-amber-50 border-amber-300 text-amber-700">
                            {n.note}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-row sm:flex-col gap-2 sm:items-end">
                      <a
                        href={n.link}
                        title={
                          n.link === "#"
                            ? "Sumber belum tersedia (dummy)"
                            : "Buka sumber di tab baru"
                        }
                        target={n.link === "#" ? undefined : "_blank"}
                        rel={n.link === "#" ? undefined : "noopener noreferrer"}
                        onClick={(ev) => handleLinkClick(ev, n.link)}
                        className={classNames(
                          "text-sm",
                          darkMode
                            ? "text-indigo-300 hover:underline"
                            : "text-indigo-700 hover:underline"
                        )}
                      >
                        Buka sumber
                      </a>
                    </div>
                  </div>
                ))}
                {filteredNews.length === 0 && (
                  <Empty msg="Belum ada berita ditemukan." />
                )}
              </div>
            </Card>
          )}

          {tab === "quotes" && (
            <Card dark={darkMode}>
              <SectionHeader
                icon={
                  <span
                    className={classNames(
                      "w-2.5 h-2.5 rounded-full inline-block",
                      darkMode ? "bg-indigo-400" : "bg-indigo-700"
                    )}
                  />
                }
                title="Kutipan Penting"
                right={
                  <div className="text-sm flex items-center gap-2">
                    <StatBadge>{filteredQuotes.length} item</StatBadge>
                  </div>
                }
              />
              <div className="grid md:grid-cols-2 gap-4">
                {filteredQuotes.map((q) => (
                  <Card key={q.id} dark={darkMode}>
                    <blockquote>
                      <div className="italic text-base md:text-lg">&quot;{q.text}&quot;</div>
                      <div className="text-sm opacity-80">- {q.speaker}</div>
                      <div className="text-xs opacity-70">
                        {new Date(q.date).toLocaleDateString()} - {q.context}
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {q.tags?.map((t) => (
                          <span
                            key={t}
                            className={classNames(
                              "px-2 py-0.5 rounded-full text-xs border",
                              darkMode
                                ? "bg-slate-700 border-slate-600"
                                : "bg-slate-100 border-slate-200"
                            )}
                          >
                            {t}
                          </span>
                        ))}
                        <a
                          href={q.link}
                          title={
                            q.link === "#"
                              ? "Sumber belum tersedia (dummy)"
                              : "Buka sumber di tab baru"
                          }
                          target={q.link === "#" ? undefined : "_blank"}
                          rel={q.link === "#" ? undefined : "noopener noreferrer"}
                          onClick={(ev) => handleLinkClick(ev, q.link)}
                          className={classNames(
                            "text-sm ml-auto",
                            darkMode
                              ? "text-indigo-300 hover:underline"
                              : "text-indigo-700 hover:underline"
                          )}
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

        <aside className="col-span-12 lg:col-span-4 space-y-4 sm:space-y-6 lg:sticky lg:top-20 self-start">
          <div className="hidden lg:block">
            <Card dark={darkMode}>
              <SectionHeader
                icon={
                  <span
                    className={classNames(
                      "w-2.5 h-2.5 rounded-full inline-block",
                      darkMode ? "bg-amber-400" : "bg-amber-500"
                    )}
                  />
                }
                title="Status Ingestor"
              />
              <ul className="text-sm space-y-2">
                <li>
                  Agenda Resmi: <span className="text-emerald-500 font-medium">OK</span> - 30 menit lalu
                </li>
                <li>
                  Media Sosial: <span className="text-emerald-500 font-medium">OK</span> - 28 menit lalu
                </li>
                <li>
                  Portal Berita: <span className="text-amber-500 font-medium">Terjadwal</span> - 10 menit lagi
                </li>
              </ul>
            </Card>

            <Card dark={darkMode}>
              <SectionHeader
                icon={
                  <span
                    className={classNames(
                      "w-2.5 h-2.5 rounded-full inline-block",
                      darkMode ? "bg-amber-400" : "bg-amber-500"
                    )}
                  />
                }
                title="Sumber (konfigurasi contoh)"
              />
              <div className="text-sm">
                <details open>
                  <summary className="cursor-pointer select-none font-medium">
                    Resmi
                  </summary>
                  <ul className="list-disc ml-5 mt-1 space-y-1">
                    <li>Portal Kemenhub (agenda dan siaran pers)</li>
                    <li>Akun media sosial resmi</li>
                    <li>Dokumen publik (PDF/RSS bila tersedia)</li>
                  </ul>
                </details>
                <details className="mt-2">
                  <summary className="cursor-pointer select-none font-medium">
                    Media Terpercaya
                  </summary>
                  <ul className="list-disc ml-5 mt-1 space-y-1">
                    <li>Antara, Kompas, Tempo, Bisnis, Detik, dan lainnya</li>
                  </ul>
                </details>
              </div>
            </Card>

            <Card dark={darkMode}>
              <SectionHeader
                icon={
                  <span
                    className={classNames(
                      "w-2.5 h-2.5 rounded-full inline-block",
                      darkMode ? "bg-amber-400" : "bg-amber-500"
                    )}
                  />
                }
                title="Pedoman Editorial Singkat"
              />
              <details>
                <summary className="cursor-pointer select-none font-medium">
                  Lihat pedoman
                </summary>
                <ol className="list-decimal ml-5 mt-2 text-sm space-y-1">
                  <li>Verifikasi 2 sumber untuk kutipan langsung.</li>
                  <li>Sertakan tanggal dan tautan sumber pada caption.</li>
                  <li>Gunakan foto atau visual resmi atau berlisensi.</li>
                </ol>
              </details>
            </Card>
          </div>

          {asideOpen && (
            <div className="lg:hidden fixed inset-0 z-30">
              <div
                className="absolute inset-0 bg-black/30"
                onClick={() => setAsideOpen(false)}
              />
              <div
                className={classNames(
                  "absolute right-0 top-0 h-full w-80 max-w-[85%] shadow-xl p-4 overflow-y-auto",
                  darkMode ? "bg-slate-800" : "bg-white"
                )}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="font-semibold">Panel Info</div>
                  <button onClick={() => setAsideOpen(false)} className="text-sm opacity-80">
                    Tutup
                  </button>
                </div>
                <Card dark={darkMode}>
                  <SectionHeader
                    icon={
                      <span
                        className={classNames(
                          "w-2.5 h-2.5 rounded-full inline-block",
                          darkMode ? "bg-amber-400" : "bg-amber-500"
                        )}
                      />
                    }
                    title="Status Ingestor"
                  />
                  <ul className="text-sm space-y-2">
                    <li>
                      Agenda Resmi: <span className="text-emerald-500 font-medium">OK</span> - 30 menit lalu
                    </li>
                    <li>
                      Media Sosial: <span className="text-emerald-500 font-medium">OK</span> - 28 menit lalu
                    </li>
                    <li>
                      Portal Berita: <span className="text-amber-500 font-medium">Terjadwal</span> - 10 menit lagi
                    </li>
                  </ul>
                </Card>
                <div className="h-3" />
                <Card dark={darkMode}>
                  <SectionHeader
                    icon={
                      <span
                        className={classNames(
                          "w-2.5 h-2.5 rounded-full inline-block",
                          darkMode ? "bg-amber-400" : "bg-amber-500"
                        )}
                      />
                    }
                    title="Sumber (konfigurasi contoh)"
                  />
                  <div className="text-sm">
                    <details open>
                      <summary className="cursor-pointer select-none font-medium">
                        Resmi
                      </summary>
                      <ul className="list-disc ml-5 mt-1 space-y-1">
                        <li>Portal Kemenhub (agenda dan siaran pers)</li>
                        <li>Akun media sosial resmi</li>
                        <li>Dokumen publik (PDF/RSS bila tersedia)</li>
                      </ul>
                    </details>
                    <details className="mt-2">
                      <summary className="cursor-pointer select-none font-medium">
                        Media Terpercaya
                      </summary>
                      <ul className="list-disc ml-5 mt-1 space-y-1">
                        <li>Antara, Kompas, Tempo, Bisnis, Detik, dan lainnya</li>
                      </ul>
                    </details>
                  </div>
                </Card>
                <div className="h-3" />
                <Card dark={darkMode}>
                  <SectionHeader
                    icon={
                      <span
                        className={classNames(
                          "w-2.5 h-2.5 rounded-full inline-block",
                          darkMode ? "bg-amber-400" : "bg-amber-500"
                        )}
                      />
                    }
                    title="Pedoman Editorial Singkat"
                  />
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

      {/* Simple toast (single) */}
      {toast && (
        <div className="fixed bottom-4 right-4 z-50 text-sm px-4 py-3 rounded-lg shadow-lg text-white bg-slate-900">
          {toast}
        </div>
      )}

      <footer className="max-w-7xl mx-auto px-3 sm:px-4 pb-10 text-xs opacity-70">
        Data Mode: {dataMode}
        {lastSync ? ` • Last sync ${lastSync} WIB` : ""} — News LIVE via RSS. (Events & Quotes mock sementara)
      </footer>
    </div>
  );
}
