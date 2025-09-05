'use client';
import React, { useMemo, useState } from "react";
import useSWR from "swr";
import type { EventItem, NewsItem, QuoteItem } from "./api/items/route";

const fetcher = (url: string) => fetch(url).then((res) => res.json());
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

function StatBadge({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800 border border-amber-200">
      {children}
    </span>
  );
}

export default function DashboardPrototype() {
  const [darkMode, setDarkMode] = useState(false);
  const [timeFilter, setTimeFilter] = useState<"24h" | "7d" | "30d" | "90d">(
    "24h"
  );
  const [debugMode, setDebugMode] = useState(false);
  const [tab, setTab] = useState<"overview" | "events" | "news" | "quotes">(
    "overview"
  );

  const hoursMap: Record<string, number> = {
    "24h": 24,
    "7d": 24 * 7,
    "30d": 24 * 30,
    "90d": 24 * 90,
  };
  const hours = hoursMap[timeFilter] ?? 24;

  const { data, error, isLoading, mutate } = useSWR(
    `/api/items?hours=${hours}&types=news,events,quotes&debug=${
      debugMode ? "1" : "0"
    }`,
    fetcher,
    { revalidateOnFocus: false }
  );

  const news: NewsItem[] = data?.news ?? [];
  const events: EventItem[] = data?.events ?? [];
  const quotes: QuoteItem[] = data?.quotes ?? [];

  // Tag universe dari news.entities, events.tags, quotes.tags
  const tagUniverse = useMemo(() => {
    const s = new Set<string>();
    for (const n of news) (n.entities || []).forEach((t) => s.add(t));
    for (const e of events) (e.tags || []).forEach((t) => s.add(t));
    for (const q of quotes) (q.tags || []).forEach((t) => s.add(t));
    return Array.from(s).sort();
  }, [news, events, quotes]);

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
          ? "bg-slate-900 text-slate-100"
          : "bg-gradient-to-br from-indigo-50 via-white to-amber-50 text-slate-900"
      )}
    >
      {/* Topbar */}
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
              <div className="text-xs opacity-70">Internal - LIVE</div>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 items-center">
            <select
              className={classNames(
                "px-3 py-2 rounded-xl border focus:outline-none",
                darkMode
                  ? "bg-slate-800 border-slate-600 text-slate-100 focus:ring-2 focus:ring-indigo-500"
                  : "border-slate-300 focus:ring-2 focus:ring-indigo-600"
              )}
              value={timeFilter}
              onChange={(e) =>
                setTimeFilter(e.target.value as "24h" | "7d" | "30d" | "90d")
              }
              title="Rentang waktu data"
            >
              <option value="24h">24 jam</option>
              <option value="7d">7 hari</option>
              <option value="30d">30 hari</option>
              <option value="90d">90 hari</option>
            </select>

            <button
              onClick={() => setDebugMode(!debugMode)}
              className={classNames(
                "px-3 py-2 rounded-xl border",
                debugMode
                  ? darkMode
                    ? "bg-emerald-600 border-emerald-600 text-white"
                    : "bg-emerald-600 border-emerald-600 text-white"
                  : darkMode
                  ? "bg-slate-800 border-slate-600 text-slate-100 hover:bg-slate-700"
                  : "bg-white border-slate-300 hover:bg-slate-50"
              )}
              title="Debug ON akan menayangkan semua berita transport (tanpa filter Menhub). OFF = hanya yang terkait Menhub."
            >
              {debugMode ? "Debug ON" : "Filter Menhub"}
            </button>

            <button
              onClick={() => void mutate()}
              className={classNames(
                "px-3 py-2 rounded-xl border",
                darkMode
                  ? "bg-slate-800 border-slate-600 text-slate-100 hover:bg-slate-700"
                  : "bg-white border-slate-300 hover:bg-slate-50"
              )}
              title="Ambil data dari internet sekarang"
            >
              Ambil Data
            </button>

            <button
              onClick={() => setDarkMode(!darkMode)}
              className={classNames(
                "px-3 py-2 rounded-xl border",
                darkMode
                  ? "bg-slate-800 border-slate-600 text-slate-100 hover:bg-slate-700"
                  : "bg-white border-slate-300 hover:bg-slate-50"
              )}
            >
              {darkMode ? "Light" : "Dark"}
            </button>

            {/* Tabs */}
            <div className="flex flex-wrap gap-2">
              <TabButton id="overview" label="Overview" />
              <TabButton id="events" label="Events" />
              <TabButton id="news" label="News" />
              <TabButton id="quotes" label="Quotes" />
            </div>
          </div>
        </div>
      </header>

      {/* Body */}
      <main className="max-w-7xl mx-auto px-3 sm:px-4 py-5 grid grid-cols-12 gap-4 sm:gap-6">
        {/* Left/Main */}
        <section className="col-span-12 lg:col-span-8 space-y-4 sm:space-y-6">
          {/* Summary bar */}
          <Card dark={darkMode}>
            <div className="flex flex-wrap gap-3 items-center">
              <div className="font-medium">Ringkasan:</div>
              <StatBadge>{events.length} Events</StatBadge>
              <StatBadge>{news.length} News</StatBadge>
              <StatBadge>{quotes.length} Quotes</StatBadge>
              {tagUniverse.length > 0 && (
                <span className="text-xs opacity-70">
                  Tags: {tagUniverse.slice(0, 8).join(", ")}
                  {tagUniverse.length > 8 ? " …" : ""}
                </span>
              )}
            </div>
          </Card>

          {error && (
            <Card dark={darkMode}>
              <div className="text-red-500">
                Gagal mengambil data. Coba klik &quot;Ambil Data&quot; lagi.
              </div>
            </Card>
          )}
          {isLoading && (
            <Card dark={darkMode}>
              <div className="text-slate-500">Memuat data…</div>
            </Card>
          )}

          {/* Overview */}
          {tab === "overview" && (
            <div className="grid md:grid-cols-2 gap-4 sm:gap-6">
              <Card dark={darkMode}>
                <SectionHeader
                  title="Events Terbaru (LIVE)"
                  icon={
                    <span
                      className={classNames(
                        "w-2.5 h-2.5 rounded-full inline-block",
                        darkMode ? "bg-indigo-400" : "bg-indigo-700"
                      )}
                    />
                  }
                />
                {events.length === 0 && <Empty msg="Tidak ada event." />}
                <ul className="space-y-3">
                  {events.slice(0, 6).map((e) => (
                    <li key={e.id}>
                      <div className="font-medium">{e.title}</div>
                      <div className="text-xs opacity-70">
                        {formatDate(e.date)} — {e.source}
                      </div>
                      {e.tags?.length ? (
                        <div className="mt-1 flex flex-wrap gap-1">
                          {e.tags.map((t) => (
                            <span
                              key={t}
                              className={classNames(
                                "px-2 py-0.5 rounded-full text-[11px] border",
                                darkMode
                                  ? "bg-slate-700 border-slate-600"
                                  : "bg-slate-100 border-slate-200"
                              )}
                            >
                              {t}
                            </span>
                          ))}
                        </div>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </Card>

              <Card dark={darkMode}>
                <SectionHeader
                  title="News Ringkas (LIVE)"
                  icon={
                    <span
                      className={classNames(
                        "w-2.5 h-2.5 rounded-full inline-block",
                        darkMode ? "bg-indigo-400" : "bg-indigo-700"
                      )}
                    />
                  }
                />
                {news.length === 0 && <Empty msg="Tidak ada berita." />}
                <ul className="space-y-3">
                  {news.slice(0, 6).map((n) => (
                    <li key={n.id}>
                      <div className="font-medium">{n.title}</div>
                      <div className="text-xs opacity-70">
                        {formatDate(n.publishedAt)} — {n.source}
                      </div>
                      {n.entities?.length ? (
                        <div className="mt-1 flex flex-wrap gap-1">
                          {n.entities.map((t) => (
                            <span
                              key={t}
                              className={classNames(
                                "px-2 py-0.5 rounded-full text-[11px] border",
                                darkMode
                                  ? "bg-slate-700 border-slate-600"
                                  : "bg-slate-100 border-slate-200"
                              )}
                            >
                              {t}
                            </span>
                          ))}
                        </div>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </Card>

              <Card dark={darkMode}>
                <SectionHeader
                  title="Quotes Terkini (LIVE)"
                  icon={
                    <span
                      className={classNames(
                        "w-2.5 h-2.5 rounded-full inline-block",
                        darkMode ? "bg-indigo-400" : "bg-indigo-700"
                      )}
                    />
                  }
                />
                {quotes.length === 0 && <Empty msg="Tidak ada kutipan." />}
                <ul className="space-y-3">
                  {quotes.slice(0, 6).map((q) => (
                    <li key={q.id}>
                      <blockquote className="italic">
                        &quot;{q.text}&quot;
                      </blockquote>
                      <div className="text-xs opacity-70">
                        {q.speaker} — {formatDate(q.date)}
                      </div>
                      {q.tags?.length ? (
                        <div className="mt-1 flex flex-wrap gap-1">
                          {q.tags.map((t) => (
                            <span
                              key={t}
                              className={classNames(
                                "px-2 py-0.5 rounded-full text-[11px] border",
                                darkMode
                                  ? "bg-slate-700 border-slate-600"
                                  : "bg-slate-100 border-slate-200"
                              )}
                            >
                              {t}
                            </span>
                          ))}
                        </div>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </Card>
            </div>
          )}

          {/* Events tab */}
          {tab === "events" && (
            <Card dark={darkMode}>
              <SectionHeader
                title="Daftar Events (LIVE)"
                icon={<span className="w-2.5 h-2.5 rounded-full inline-block bg-indigo-600" />}
                right={<StatBadge>{events.length} item</StatBadge>}
              />
              <div
                className="divide-y"
                style={{ borderColor: darkMode ? "#334155" : "#e2e8f0" }}
              >
                {events.map((e) => (
                  <div
                    key={e.id}
                    className="py-3 flex flex-col sm:flex-row sm:items-start gap-3 sm:gap-4"
                  >
                    <div className="sm:w-48 text-xs opacity-70">
                      {formatDate(e.date)}
                    </div>
                    <div className="flex-1">
                      <div className="font-medium">{e.title}</div>
                      <div className="text-sm opacity-80">{e.source}</div>
                      <div className="text-sm mt-1 opacity-90">{e.summary}</div>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {(e.tags || []).map((t) => (
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
                        target="_blank"
                        rel="noopener noreferrer"
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
                {events.length === 0 && <Empty msg="Tidak ada event." />}
              </div>
            </Card>
          )}

          {/* News tab */}
          {tab === "news" && (
            <Card dark={darkMode}>
              <SectionHeader
                title="Berita Terbaru (LIVE)"
                icon={<span className="w-2.5 h-2.5 rounded-full inline-block bg-indigo-600" />}
                right={<StatBadge>{news.length} item</StatBadge>}
              />
              <div
                className="divide-y"
                style={{ borderColor: darkMode ? "#334155" : "#e2e8f0" }}
              >
                {news.map((n) => (
                  <div
                    key={n.id}
                    className="py-3 flex flex-col sm:flex-row sm:items-start gap-3 sm:gap-4"
                  >
                    <div className="sm:w-48 text-xs opacity-70">
                      {formatDate(n.publishedAt)}
                    </div>
                    <div className="flex-1">
                      <div className="font-medium">{n.title}</div>
                      <div className="text-sm opacity-80">{n.source}</div>
                      <div className="text-sm mt-1 opacity-90">{n.summary}</div>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {(n.entities || []).map((t) => (
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
                      <a
                        href={n.link}
                        target="_blank"
                        rel="noopener noreferrer"
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
                {news.length === 0 && <Empty msg="Tidak ada berita." />}
              </div>
            </Card>
          )}

          {/* Quotes tab */}
          {tab === "quotes" && (
            <Card dark={darkMode}>
              <SectionHeader
                title="Kutipan Penting (LIVE)"
                icon={<span className="w-2.5 h-2.5 rounded-full inline-block bg-indigo-600" />}
                right={<StatBadge>{quotes.length} item</StatBadge>}
              />
              <div className="grid md:grid-cols-2 gap-4">
                {quotes.map((q) => (
                  <Card key={q.id} dark={darkMode}>
                    <blockquote>
                      <div className="italic text-base md:text-lg">
                        &quot;{q.text}&quot;
                      </div>
                      <div className="text-sm opacity-80">{q.speaker}</div>
                      <div className="text-xs opacity-70">
                        {formatDate(q.date)} — {q.context}
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {(q.tags || []).map((t) => (
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
                          target="_blank"
                          rel="noopener noreferrer"
                          className={classNames(
                            "text-sm md:ml-auto",
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
                {quotes.length === 0 && <Empty msg="Tidak ada kutipan." />}
              </div>
            </Card>
          )}
        </section>

        {/* Right/Aside */}
        <aside className="col-span-12 lg:col-span-4 space-y-4 sm:space-y-6 lg:sticky lg:top-20 self-start">
          <Card dark={darkMode}>
            <SectionHeader
              title="Status Ingestor"
              icon={
                <span
                  className={classNames(
                    "w-2.5 h-2.5 rounded-full inline-block",
                    darkMode ? "bg-amber-400" : "bg-amber-500"
                  )}
                />
              }
            />
            <ul className="text-sm space-y-2">
              <li>
                Agenda/News Feeds:{" "}
                <span className="text-emerald-500 font-medium">OK</span> — cache{" "}
                {Math.floor((300 / 60))} menit
              </li>
              <li>
                Mode pengambilan:{" "}
                <span className="font-medium">
                  {debugMode ? "Debug (semua transport)" : "Filter Menhub"}
                </span>
              </li>
              <li>
                Rentang: <span className="font-medium">{timeFilter}</span>
              </li>
              <li>
                Terakhir ambil:{" "}
                <button
                  onClick={() => void mutate()}
                  className={classNames(
                    "px-2 py-1 rounded-md text-xs border",
                    darkMode
                      ? "bg-slate-800 border-slate-600"
                      : "bg-white border-slate-300 hover:bg-slate-50"
                  )}
                >
                  Ambil Data Sekarang
                </button>
              </li>
            </ul>
          </Card>

          <Card dark={darkMode}>
            <SectionHeader
              title="Sumber (konfigurasi contoh)"
              icon={
                <span
                  className={classNames(
                    "w-2.5 h-2.5 rounded-full inline-block",
                    darkMode ? "bg-amber-400" : "bg-amber-500"
                  )}
                />
              }
            />
            <div className="text-sm">
              <details open>
                <summary className="cursor-pointer select-none font-medium">
                  Resmi / Terpercaya
                </summary>
                <ul className="list-disc ml-5 mt-1 space-y-1">
                  <li>Antara Nasional (RSS)</li>
                  <li>Kompas News (RSS)</li>
                  <li>Tempo Nasional (RSS)</li>
                  <li>Bisnis Nasional (RSS)</li>
                  <li className="opacity-80">
                    Tambah: Portal/IG/Twitter Kemenhub bila ada RSS/API
                  </li>
                </ul>
              </details>
              <details className="mt-2">
                <summary className="cursor-pointer select-none font-medium">
                  Tag &amp; Deteksi
                </summary>
                <ul className="list-disc ml-5 mt-1 space-y-1">
                  <li>Deteksi aktor: Menhub/Kemenhub/Dudy Purwagandhi</li>
                  <li>Deteksi domain: Darat/Rel/Laut/Udara/Green/Integrasi</li>
                  <li>Heuristik event: peresmian, kunjungan, rapat, dst.</li>
                </ul>
              </details>
            </div>
          </Card>

          <Card dark={darkMode}>
            <SectionHeader
              title="Pedoman Editorial Singkat"
              icon={
                <span
                  className={classNames(
                    "w-2.5 h-2.5 rounded-full inline-block",
                    darkMode ? "bg-amber-400" : "bg-amber-500"
                  )}
                />
              }
            />
            <details>
              <summary className="cursor-pointer select-none font-medium">
                Lihat pedoman
              </summary>
              <ol className="list-decimal ml-5 mt-2 text-sm space-y-1">
                <li>
                  Minimal 2 sumber untuk kutipan langsung (cek tautan sumber).
                </li>
                <li>
                  Tulis tanggal &amp; sumber pada caption. Hindari clickbait.
                </li>
                <li>Gunakan foto/visual resmi atau berlisensi.</li>
                <li>
                  Jika Debug ON dipakai saat riset, aktifkan kembali Filter Menhub
                  sebelum publikasi.
                </li>
              </ol>
            </details>
          </Card>
        </aside>
      </main>

      <footer className="max-w-7xl mx-auto px-3 sm:px-4 pb-10 text-xs opacity-70">
        Prototype LIVE — Data via RSS. Integrasi agenda resmi bisa ditambah.
      </footer>
    </div>
  );
}
