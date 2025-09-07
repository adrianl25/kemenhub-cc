'use client';
import React, { useEffect, useMemo, useState } from "react";
import type { ApiPayload, EventItem, NewsItem } from "./api/items/route";

// UI helpers
const classNames = (...c: Array<string | false | undefined>) => c.filter(Boolean).join(" ");
const formatDT = (iso: string) =>
  new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });

function SectionHeader({
  dotClass,
  title,
  right,
}: { dotClass: string; title: string; right?: React.ReactNode }) {
  return (
    <div className="mb-3 flex items-center justify-between">
      <div className="flex items-center gap-2">
        <span className={classNames("inline-block h-2.5 w-2.5 rounded-full", dotClass)} />
        <h2 className="text-lg font-semibold">{title}</h2>
      </div>
      <div>{right}</div>
    </div>
  );
}
function Card({ children }: { children: React.ReactNode }) {
  return <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">{children}</div>;
}
function StatBadge({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
      {children}
    </span>
  );
}
function Empty({ msg }: { msg: string }) {
  return <div className="rounded-xl border border-dashed p-6 text-center text-slate-500">{msg}</div>;
}

export default function Dashboard() {
  const [range, setRange] = useState<"24h" | "7d" | "30d" | "90d">("7d");
  const [query, setQuery] = useState("");
  const [onlyMenhub, setOnlyMenhub] = useState(true);
  const [auto, setAuto] = useState(true);
  const [status, setStatus] = useState<"idle" | "loading" | "ok" | "error">("idle");
  const [data, setData] = useState<ApiPayload | null>(null);
  const [caption, setCaption] = useState("");

  const minDate = useMemo(() => {
    const d = new Date();
    const map: Record<"24h" | "7d" | "30d" | "90d", number> = {
      "24h": 1, "7d": 7, "30d": 30, "90d": 90
    };
    d.setDate(d.getDate() - map[range]);
    return d;
  }, [range]);

  const fetchNow = async () => {
    setStatus("loading");
    try {
      const res = await fetch(`/api/items?range=${range}`, { cache: "no-store" });
      const json = (await res.json()) as ApiPayload;
      setData(json);
      setStatus("ok");
    } catch {
      setStatus("error");
    }
  };

  useEffect(() => {
    if (auto) fetchNow();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range]);

  const liveEvents = useMemo(() => {
    const all = data?.events ?? [];
    return all
      .filter((e) => new Date(e.date) >= minDate)
      .filter((e) =>
        onlyMenhub ? e.attendedByMinister || /menhub|menteri perhubungan|dudy/gi.test(e.title) : true
      )
      .filter((e) =>
        query ? `${e.title} ${e.summary} ${e.source}`.toLowerCase().includes(query.toLowerCase()) : true
      )
      .sort((a, b) => +new Date(b.date) - +new Date(a.date));
  }, [data, minDate, onlyMenhub, query]);

  const liveNews = useMemo(() => {
    const all = data?.news ?? [];
    return all
      .filter((n) => new Date(n.publishedAt) >= minDate)
      .filter((n) =>
        onlyMenhub
          ? /menhub|menteri perhubungan|kemenhub|dudy/gi.test(`${n.title} ${n.summary}`)
          : true
      )
      .filter((n) =>
        query ? `${n.title} ${n.summary} ${n.source}`.toLowerCase().includes(query.toLowerCase()) : true
      )
      .sort((a, b) => +new Date(b.publishedAt) - +new Date(a.publishedAt));
  }, [data, minDate, onlyMenhub, query]);

  const liveQuotes = useMemo(() => {
    const all = data?.quotes ?? [];
    return all
      .filter((q) => new Date(q.date) >= minDate)
      .filter((q) =>
        onlyMenhub ? /dudy|menhub|menteri perhubungan/gi.test(`${q.speaker} ${q.text}`) : true
      )
      .filter((q) =>
        query ? `${q.text} ${q.context}`.toLowerCase().includes(query.toLowerCase()) : true
      )
      .sort((a, b) => +new Date(b.date) - +new Date(a.date));
  }, [data, minDate, onlyMenhub, query]);

  const generateCaption = () => {
    const top: NewsItem | EventItem | undefined = liveNews[0] ?? liveEvents[0];
    if (!top) {
      setCaption("Belum ada item untuk caption.");
      return;
    }
    const title = "title" in top ? top.title : "Pembaruan";
    const info = ("summary" in top ? top.summary : "") || ("source" in top ? top.source : "");
    setCaption(`Menhub: ${title} — ${info} #Kemenhub #Transportasi`);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-amber-50 text-slate-900">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-3 py-3">
          <div className="flex items-center gap-3">
            <div className="grid h-9 w-9 place-items-center rounded-xl bg-indigo-700 font-bold text-white">CC</div>
            <div>
              <div className="font-semibold">Command Center Kemenhub</div>
              <div className="text-xs opacity-70">Internal — LIVE</div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <input
              placeholder="Cari event/berita/quote"
              className="w-64 rounded-xl border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-600"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <select
              className="rounded-xl border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-600"
              value={range}
              onChange={(e) => setRange(e.target.value as typeof range)}
            >
              <option value="24h">24 jam</option>
              <option value="7d">7 hari</option>
              <option value="30d">30 hari</option>
              <option value="90d">90 hari</option>
            </select>
            <button
              onClick={() => setOnlyMenhub((v) => !v)}
              className={classNames(
                "rounded-full border px-3 py-2 text-sm",
                onlyMenhub ? "border-indigo-600 bg-indigo-600 text-white" : "border-slate-300 bg-white"
              )}
              title="Filter hanya yang terkait Menhub"
            >
              Hanya Menhub: {onlyMenhub ? "ON" : "OFF"}
            </button>
            <button
              onClick={fetchNow}
              className="rounded-xl bg-indigo-700 px-3 py-2 text-white hover:bg-indigo-800"
            >
              Ambil Data Sekarang
            </button>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={auto} onChange={(e) => setAuto(e.target.checked)} />
              Auto fetch saat ganti rentang
            </label>
          </div>
        </div>
      </header>

      {/* Status */}
      <div className="mx-auto max-w-7xl px-3 py-3">
        <Card>
          <div className="flex items-center gap-3 text-sm">
            <div>Status:</div>
            {status === "loading" && <StatBadge>Memuat…</StatBadge>}
            {status === "ok" && <StatBadge>OK</StatBadge>}
            {status === "error" && <StatBadge>Gagal mengambil data</StatBadge>}
            {data?.meta?.generatedAt && <StatBadge>Update: {formatDT(data.meta.generatedAt)}</StatBadge>}
          </div>
        </Card>
      </div>

      {/* Main */}
      <main className="mx-auto grid max-w-7xl grid-cols-12 gap-4 px-3 pb-10">
        <section className="col-span-12 space-y-4 lg:col-span-8">
          {/* Events */}
          <Card>
            <SectionHeader dotClass="bg-indigo-700" title="Events Terbaru (LIVE)" right={<div className="text-sm">{liveEvents.length} item</div>} />
            <div className="divide-y" style={{ borderColor: "#e2e8f0" }}>
              {liveEvents.length === 0 && <Empty msg="Tidak ada event pada rentang ini." />}
              {liveEvents.map((e) => (
                <div key={e.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-start sm:gap-4">
                  <div className="sm:w-48 text-xs opacity-70">{formatDT(e.date)}</div>
                  <div className="flex-1">
                    <div className="font-medium">{e.title}</div>
                    <div className="text-sm opacity-80">{e.source}</div>
                    <div className="mt-1 text-sm opacity-90">{e.summary}</div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {e.tags.map((t) => (
                        <span key={t} className="rounded-full border bg-slate-100 px-2 py-0.5 text-xs">
                          {t}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="flex flex-row items-start gap-2 sm:flex-col sm:items-end">
                    {e.attendedByMinister && (
                      <span className="rounded bg-amber-500 px-2 py-1 text-[10px] uppercase tracking-wide text-white">
                        Menhub hadir
                      </span>
                    )}
                    <a href={e.link} target="_blank" rel="noopener noreferrer" className="text-sm text-indigo-700 hover:underline">
                      Buka sumber
                    </a>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {/* News */}
          <Card>
            <SectionHeader dotClass="bg-indigo-700" title="News Ringkas (LIVE)" right={<div className="text-sm">{liveNews.length} item</div>} />
            <div className="divide-y" style={{ borderColor: "#e2e8f0" }}>
              {liveNews.length === 0 && <Empty msg="Belum ada berita pada rentang ini." />}
              {liveNews.map((n) => (
                <div key={n.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-start sm:gap-4">
                  <div className="sm:w-48 text-xs opacity-70">{formatDT(n.publishedAt)}</div>
                  <div className="flex-1">
                    <div className="font-medium">{n.title}</div>
                    <div className="text-sm opacity-80">{n.source}</div>
                    <div className="mt-1 text-sm opacity-90">{n.summary}</div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {n.entities.map((t) => (
                        <span key={t} className="rounded-full border bg-slate-100 px-2 py-0.5 text-xs">
                          {t}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-start sm:items-end">
                    <a href={n.link} target="_blank" rel="noopener noreferrer" className="text-sm text-indigo-700 hover:underline">
                      Buka sumber
                    </a>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {/* Quotes */}
          <Card>
            <SectionHeader dotClass="bg-indigo-700" title="Quotes Terkini (LIVE)" right={<div className="text-sm">{(data?.quotes ?? []).length} item</div>} />
            <div className="grid gap-4 md:grid-cols-2">
              {liveQuotes.length === 0 && <Empty msg="Belum ada kutipan pada rentang ini." />}
              {liveQuotes.map((q) => (
                <Card key={q.id}>
                  <blockquote>
                    <div className="text-base italic md:text-lg">&quot;{q.text}&quot;</div>
                    <div className="text-sm opacity-80">- {q.speaker}</div>
                    <div className="text-xs opacity-70">{formatDT(q.date)} — {q.context}</div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {q.tags.map((t) => (
                        <span key={t} className="rounded-full border bg-slate-100 px-2 py-0.5 text-xs">
                          {t}
                        </span>
                      ))}
                      <a href={q.link} target="_blank" rel="noopener noreferrer" className="ml-auto text-sm text-indigo-700 hover:underline">
                        Buka sumber
                      </a>
                    </div>
                  </blockquote>
                </Card>
              ))}
            </div>
          </Card>

          {/* Caption */}
          <Card>
            <SectionHeader dotClass="bg-amber-500" title="Generator Caption" />
            <div className="flex flex-wrap items-center gap-2">
              <button onClick={generateCaption} className="rounded-xl bg-indigo-700 px-3 py-2 text-white hover:bg-indigo-800">
                Generate
              </button>
              <button
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(caption);
                    alert("Caption disalin.");
                  } catch {
                    alert("Gagal menyalin. Salin manual.");
                  }
                }}
                className="rounded-xl border border-slate-300 px-3 py-2"
              >
                Copy
              </button>
            </div>
            <textarea
              className="mt-2 h-28 w-full rounded-xl border border-slate-300 p-3 focus:outline-none focus:ring-2 focus:ring-indigo-600"
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
            />
          </Card>
        </section>

        {/* Aside */}
        <aside className="col-span-12 space-y-4 lg:col-span-4">
          <Card>
            <SectionHeader dotClass="bg-amber-500" title="Status Ingestor" />
            <ul className="space-y-1 text-sm">
              <li>
                News/Quotes:{" "}
                <span className="font-medium text-emerald-600">
                  {status === "ok" ? "LIVE" : status === "loading" ? "Memuat" : "—"}
                </span>
              </li>
              <li>
                Events:{" "}
                <span className="font-medium text-emerald-600">
                  {status === "ok" ? "LIVE" : "—"}
                </span>
              </li>
              <li>Rentang aktif: {range}</li>
            </ul>
          </Card>

          <Card>
            <SectionHeader dotClass="bg-amber-500" title="Sumber (konfigurasi contoh)" />
            <div className="text-sm">
              <details open>
                <summary className="cursor-pointer select-none font-medium">Resmi</summary>
                <ul className="ml-5 mt-1 list-disc space-y-1">
                  <li>Portal Kemenhub (agenda & siaran pers)</li>
                  <li>Akun media sosial resmi</li>
                  <li>Dokumen publik (PDF/RSS bila tersedia)</li>
                </ul>
              </details>
              <details className="mt-2">
                <summary className="cursor-pointer select-none font-medium">Media Terpercaya</summary>
                <ul className="ml-5 mt-1 list-disc space-y-1">
                  <li>Antara, Kompas, Tempo, Detik, dll</li>
                </ul>
              </details>
            </div>
          </Card>

          <Card>
            <SectionHeader dotClass="bg-amber-500" title="Pedoman Editorial Singkat" />
            <details>
              <summary className="cursor-pointer select-none font-medium">Lihat pedoman</summary>
              <ol className="ml-5 mt-2 list-decimal space-y-1 text-sm">
                <li>Verifikasi 2 sumber untuk kutipan langsung.</li>
                <li>Sertakan tanggal & tautan sumber pada caption.</li>
                <li>Gunakan visual resmi atau berlisensi.</li>
              </ol>
            </details>
          </Card>
        </aside>
      </main>

      <footer className="mx-auto max-w-7xl px-3 pb-10 text-xs opacity-70">
        Prototype UI — Terhubung ke endpoint <code>/api/items</code> (LIVE).
      </footer>
    </div>
  );
}
