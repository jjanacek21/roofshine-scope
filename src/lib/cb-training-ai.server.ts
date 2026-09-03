/**
 * Server-only AI helpers for Company Training.
 * Course outlines, quiz generation, the in-lesson tutor and free-text grading.
 */

const GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";
const MODEL = "openai/gpt-5.6-sol";

export interface CbAiError {
  status: number;
  message: string;
}

async function call(messages: { role: string; content: string }[]): Promise<string> {
  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) throw new Error("AI is not configured for this app yet.");

  const res = await fetch(GATEWAY, {
    method: "POST",
    headers: { "content-type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ model: MODEL, messages }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    let message = body || res.statusText;
    try {
      const parsed = JSON.parse(body) as { error?: { message?: string }; message?: string };
      message = parsed.error?.message ?? parsed.message ?? message;
    } catch {
      /* keep raw body */
    }
    if (res.status === 429) throw new Error("The AI is rate limited right now — try again in a minute.");
    if (res.status === 402) throw new Error(message || "This workspace is out of AI credits.");
    if (res.status === 403) throw new Error(message || "AI is turned off for this workspace.");
    throw new Error(message || "The AI request failed.");
  }

  const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  const text = json.choices?.[0]?.message?.content ?? "";
  if (!text.trim()) throw new Error("The AI returned an empty response.");
  return text;
}

function extractJson<T>(raw: string): T {
  const trimmed = raw.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  try {
    return JSON.parse(trimmed) as T;
  } catch {
    const start = trimmed.search(/[[{]/);
    const endObj = trimmed.lastIndexOf("}");
    const endArr = trimmed.lastIndexOf("]");
    const end = Math.max(endObj, endArr);
    if (start >= 0 && end > start) return JSON.parse(trimmed.slice(start, end + 1)) as T;
    throw new Error("The AI did not return usable JSON.");
  }
}

/* ------------------------------------------------------------------ */

export interface AiOutlineLesson {
  title: string;
  kind: "article" | "video" | "quiz";
  body: string;
  minutes: number;
}
export interface AiOutlineModule {
  title: string;
  summary: string;
  lessons: AiOutlineLesson[];
}
export interface AiOutline {
  title: string;
  description: string;
  modules: AiOutlineModule[];
}

export async function generateOutline(input: {
  topic: string;
  audience?: string;
  source?: string;
  moduleCount?: number;
}): Promise<AiOutline> {
  const system = `You design short, practical training courses for field crews at a roofing and storm-restoration contractor.
Write for someone reading on a phone between appointments: plain language, short paragraphs, concrete steps and real objections.
No fluff, no corporate filler, no promises about insurance approval.
Keep each lesson body between 120 and 300 words, formatted as markdown with short headings and bullets.
Reply with ONE JSON object and nothing else:
{"title":"","description":"","modules":[{"title":"","summary":"","lessons":[{"title":"","kind":"article|video|quiz","body":"","minutes":5}]}]}`;

  const user = [
    `Topic: ${input.topic}`,
    input.audience ? `Audience: ${input.audience}` : "Audience: field sales reps and crew leads",
    `Modules: ${input.moduleCount ?? 4}`,
    input.source ? `Base the course on this source material:\n${input.source.slice(0, 12000)}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");

  return extractJson<AiOutline>(await call([
    { role: "system", content: system },
    { role: "user", content: user },
  ]));
}

/* ------------------------------------------------------------------ */

export interface AiQuizQuestion {
  prompt: string;
  kind: "choice" | "text";
  options: string[];
  correct_index: number | null;
  model_answer: string | null;
}

export async function generateQuiz(input: {
  material: string;
  count?: number;
  difficulty?: "easy" | "standard" | "hard";
  includeText?: boolean;
}): Promise<AiQuizQuestion[]> {
  const system = `You write quizzes that check whether a field rep actually understood training material.
Questions must be answerable from the supplied material only. No trick questions, no trivia.
Difficulty "easy" checks recall, "standard" checks application, "hard" checks judgement in a messy real situation.
For kind "choice" give exactly 4 options and a correct_index. For kind "text" give a model_answer of 1-3 sentences and set options to [] and correct_index to null.
Reply with ONE JSON array and nothing else:
[{"prompt":"","kind":"choice","options":["","","",""],"correct_index":0,"model_answer":null}]`;

  const user = [
    `Number of questions: ${input.count ?? 6}`,
    `Difficulty: ${input.difficulty ?? "standard"}`,
    input.includeText ? "Include 1-2 free-text questions." : "All questions multiple choice.",
    `Material:\n${input.material.slice(0, 14000)}`,
  ].join("\n");

  const out = extractJson<AiQuizQuestion[]>(await call([
    { role: "system", content: system },
    { role: "user", content: user },
  ]));
  return Array.isArray(out) ? out : [];
}

/* ------------------------------------------------------------------ */

export async function tutorReply(input: {
  material: string;
  courseTitle: string;
  history: { role: "user" | "assistant"; content: string }[];
  question: string;
}): Promise<string> {
  const system = `You are the in-course tutor for "${input.courseTitle}".
Answer ONLY from the course material below. If the answer is not in it, say so plainly and suggest what to ask the trainer.
Be short — 2 to 5 sentences unless asked to go deeper. Talk like a seasoned crew lead, not a textbook.

COURSE MATERIAL:
${input.material.slice(0, 16000)}`;

  return call([
    { role: "system", content: system },
    ...input.history.slice(-8).map((m) => ({ role: m.role, content: m.content })),
    { role: "user", content: input.question },
  ]);
}

/* ------------------------------------------------------------------ */

export interface AiGrade {
  index: number;
  score: number;
  feedback: string;
  follow_up: string | null;
}

export async function gradeAnswers(input: {
  items: { prompt: string; model_answer: string | null; answer: string }[];
  material?: string;
}): Promise<AiGrade[]> {
  const system = `You grade short written answers from field reps in a training quiz.
Score 0 to 100 for each answer based on whether it captures the substance of the model answer. Wording does not matter, meaning does.
Feedback is one or two sentences, direct and useful — say what was missing.
follow_up is one probing question when the answer was partly right, otherwise null.
Reply with ONE JSON array and nothing else:
[{"index":0,"score":80,"feedback":"","follow_up":null}]`;

  const user = [
    input.material ? `Course material:\n${input.material.slice(0, 8000)}\n` : "",
    ...input.items.map(
      (it, i) =>
        `#${i}\nQuestion: ${it.prompt}\nModel answer: ${it.model_answer ?? "(none supplied)"}\nRep answer: ${it.answer}`,
    ),
  ].join("\n\n");

  const out = extractJson<AiGrade[]>(await call([
    { role: "system", content: system },
    { role: "user", content: user },
  ]));
  return Array.isArray(out) ? out : [];
}
