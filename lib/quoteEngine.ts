// lib/quoteEngine.ts

export type QuoteItem = {
  id: string;
  text: string;
  speaker?: string;
  date?: string;
  context?: string;
  link: string;
  tags?: string[];
};

/**
 * Ekstrak kutipan dari sebuah teks (content / snippet) dengan pola tanda kutip umum.
 * Hanya mengembalikan kutipan asli yang ditemukan (tidak mengarang).
 */
export function extractQuotesFromText(
  text: string,
  opts: {
    link: string;
    context?: string;
    date?: string;
    defaultSpeaker?: string;
    maxQuotes?: number;
    extraTags?: string[];
  }
): QuoteItem[] {
  const {
    link,
    context,
    date,
    defaultSpeaker,
    maxQuotes = 3,
    extraTags = [],
  } = opts;

  const src = (text ?? "").trim();
  if (!src) return [];

  // Pola tanda kutip yang sering dipakai media Indonesia
  const patterns = [
    /“([^”]{12,300})”/g, // kutip melengkung
    /"([^"]{12,300})"/g,  // kutip lurus
    /‘([^’]{12,300})’/g,  // single curly
    /'([^']{12,300})'/g,  // single straight
  ];

  const found: string[] = [];
  for (const re of patterns) {
    let m: RegExpExecArray | null;
    while ((m = re.exec(src)) !== null) {
      const q = m[1].trim();
      // Hindari paragraf terlalu umum (bukan kalimat)
      if (q.split(/\s+/).length >= 3) found.push(q);
      if (found.length >= maxQuotes) break;
    }
    if (found.length >= maxQuotes) break;
  }

  // Unik + rapikan titik di akhir
  const unique = Array.from(new Set(found)).map((s) =>
    s.replace(/\s+([,.!?;:])\s*$/u, "$1").trim()
  );

  return unique.slice(0, maxQuotes).map((q, i) => ({
    id: `q-${hashId(`${link}-${i}-${q.slice(0, 16)}`)}`,
    text: q,
    speaker: defaultSpeaker, // biarkan undefined kalau tidak ada
    date,
    context,
    link,
    tags: ["Kutipan", ...extraTags],
  }));
}

/** Hash ringan untuk id */
export function hashId(input: string): string {
  let h = 0;
  for (let i = 0; i < input.length; i++) {
    h = (h << 5) - h + input.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h).toString(36);
}
