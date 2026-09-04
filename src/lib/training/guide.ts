/**
 * The Survival Guide, as something the app can reason over.
 *
 * The guide shipped as a 182KB static HTML page behind an iframe: readable by a
 * person, opaque to everything else. This is the same content parsed into its
 * own structure — 15 modules, 125 lessons, 118 word-for-word scripts, 18,688
 * words — so a lesson can be searched, quoted and cited.
 *
 * It lives as a build asset rather than database rows on purpose. It is
 * reference material that changes when someone rewrites the guide, not per
 * company and not per rep, so version control is the right home for it: no
 * migration to run, no RLS to get wrong, and the copy the app answers from is
 * always the copy in the repo. Progress, enrolments and company-authored
 * courses are the things that vary, and those are database rows.
 */

export interface GuideLesson {
  id: string;
  title: string;
  body: string;
  /** Word-for-word talk tracks, kept apart from the explanation around them. */
  scripts: string[];
  /** Label/value pairs the guide sets out as facts. */
  facts: [string, string][];
  words: number;
}

export interface GuideModule {
  id: string;
  title: string;
  subtitle: string;
  lessons: GuideLesson[];
}

export interface Guide {
  title: string;
  source: string;
  modules: GuideModule[];
}

let cache: Guide | null = null;
let inflight: Promise<Guide> | null = null;

/** Loaded once per session and kept — it is 165KB and never changes at runtime. */
export async function loadGuide(): Promise<Guide> {
  if (cache) return cache;
  if (inflight) return inflight;
  inflight = fetch("/training/survival-guide.json")
    .then(async (r) => {
      if (!r.ok) throw new Error(`Could not load the Survival Guide (${r.status}).`);
      cache = (await r.json()) as Guide;
      return cache;
    })
    .finally(() => {
      inflight = null;
    });
  return inflight;
}

export function flatten(g: Guide): (GuideLesson & { moduleId: string; moduleTitle: string })[] {
  return g.modules.flatMap((m) =>
    m.lessons.map((l) => ({ ...l, moduleId: m.id, moduleTitle: m.title })),
  );
}

/* ── search ───────────────────────────────────────────────────────────────
   18,688 words is small enough that scoring every lesson on every keystroke
   costs less than a network round trip, so there is no index to build and
   nothing to keep in sync. */

const STOP = new Set([
  "the","a","an","and","or","but","if","of","to","in","on","at","for","with","is","are","was",
  "be","been","it","this","that","these","those","i","you","he","she","they","we","my","your",
  "do","does","did","how","what","when","where","why","who","can","should","would","could","me",
  "about","from","as","by","so","not","no","yes","get","got","tell","say","said",
]);

const tokens = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9' ]+/g, " ").split(/\s+/).filter((w) => w.length > 2 && !STOP.has(w));

export interface Hit {
  lesson: GuideLesson;
  moduleId: string;
  moduleTitle: string;
  score: number;
  /** The sentence that matched, for showing why this came back. */
  snippet: string;
}

/**
 * Rank lessons against a question.
 *
 * A title match counts for much more than a body match: the guide's own titles
 * are the vocabulary a rep uses ("I got denied", "The Three Tens"), so a hit
 * there almost always means the right card.
 */
export function search(g: Guide, query: string, limit = 6): Hit[] {
  const q = tokens(query);
  if (!q.length) return [];
  const out: Hit[] = [];

  for (const m of g.modules) {
    for (const l of m.lessons) {
      const title = l.title.toLowerCase();
      const body = l.body.toLowerCase();
      let score = 0;
      for (const t of q) {
        if (title.includes(t)) score += 6;
        const n = body.split(t).length - 1;
        if (n) score += Math.min(n, 4);
      }
      // A whole-phrase hit is worth more than the same words scattered around.
      const phrase = query.toLowerCase().trim();
      if (phrase.length > 8 && body.includes(phrase)) score += 10;
      if (score <= 0) continue;

      const first = q.find((t) => body.includes(t));
      let snippet = "";
      if (first) {
        const i = body.indexOf(first);
        snippet = l.body.slice(Math.max(0, i - 70), i + 170).trim();
      }
      out.push({ lesson: l, moduleId: m.id, moduleTitle: m.title, score, snippet });
    }
  }
  return out.sort((a, b) => b.score - a.score).slice(0, limit);
}

/** Every objection bucket the guide defines, for picking a roleplay scenario. */
export function objectionBuckets(g: Guide): GuideLesson[] {
  const m = g.modules.find((x) => /rebuttal/i.test(x.title));
  if (!m) return [];
  return m.lessons.filter((l) => /bucket|"|“|'/i.test(l.title) || l.scripts.length > 0);
}

/** A compact outline, small enough to hand a model as orientation. */
export function outline(g: Guide): string {
  return g.modules
    .map((m) => `${m.title}\n${m.lessons.map((l) => `  - ${l.title}`).join("\n")}`)
    .join("\n\n");
}

/** The passages a model should answer from, trimmed to a sane budget. */
export function contextFor(g: Guide, query: string, maxChars = 9000): { text: string; cited: Hit[] } {
  const hits = search(g, query, 8);
  const parts: string[] = [];
  const cited: Hit[] = [];
  let used = 0;
  for (const h of hits) {
    const block =
      `### ${h.moduleTitle} → ${h.lesson.title}\n${h.lesson.body}` +
      (h.lesson.scripts.length ? `\n\nSCRIPTS:\n${h.lesson.scripts.join("\n---\n")}` : "");
    if (used + block.length > maxChars) break;
    parts.push(block);
    cited.push(h);
    used += block.length;
  }
  return { text: parts.join("\n\n"), cited };
}
