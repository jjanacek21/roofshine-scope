import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";

/**
 * The trainer a rep can actually talk to.
 *
 * Two modes over one corpus. In `coach` it answers questions about selling
 * roofs the way the Survival Guide answers them. In `roleplay` it stops being a
 * coach and becomes the homeowner, so a rep can practise a door before knocking
 * a real one.
 *
 * Both are grounded: the passages the client retrieved from the guide are the
 * only source it is allowed to teach from, and it names the lesson it came
 * from. A trainer that invents a rebuttal is worse than no trainer, because a
 * rep will say it on a doorstep and it will not work.
 *
 * Retrieval happens on the client because the guide is a build asset there —
 * 18,688 words in one JSON file — so the server never has to load or index it.
 */

const TRAINER_MODEL = process.env["TRAINER_MODEL"] ?? "google/gemini-2.5-flash";

type Turn = { role: "user" | "assistant"; content: string };

interface Body {
  mode?: "coach" | "roleplay" | "score";
  /** The rep's message. */
  message?: string;
  /** Passages retrieved from the guide, already trimmed by the client. */
  context?: string;
  /** Which lessons those passages came from, so the reply can cite them. */
  cited?: { module: string; lesson: string }[];
  /** The conversation so far. */
  history?: Turn[];
  /** Roleplay only: which objection the homeowner is running. */
  scenario?: string;
  /** Roleplay only: how hard they are being. */
  difficulty?: "easy" | "normal" | "hard";
}

const COACH_SYSTEM = `You are the training coach inside a roofing contractor's app. Reps ask you how to sell roofs, knock doors, handle objections and talk about insurance claims.

Everything you teach comes from the GUIDE passages supplied in the user message. That is the company's own playbook and it is the only thing you teach from.

- Answer the way a good sales manager answers in a truck: short, direct, concrete. No preamble, no "great question".
- When the guide gives a word-for-word script, quote it exactly. Reps memorise these; paraphrasing them is a disservice.
- Name the lesson you took it from, in plain words, at the end. One line.
- If the guide does not cover what they asked, say so plainly and answer from general sales knowledge — but say which part is not from the playbook.
- Never invent a statistic, a legal claim, or a promise about what insurance will pay.
- Never tell a rep to say anything untrue to a homeowner, to imply they represent an insurer or a government programme, or to pressure someone into signing.`;

const ROLEPLAY_SYSTEM = `You are playing a HOMEOWNER answering the door to a roofing sales rep. You are not a coach and you never break character.

- Stay in character. One to three sentences per turn, the way a real person talks at a door.
- Be a real person: busy, a bit sceptical, not hostile. You have your own reasons.
- React to what the rep actually said. If they earn a step, give it. If they pitch at you or talk over you, get shorter and colder.
- Never coach them, never explain yourself, never mention the guide, scripts or that you are an AI.
- If the rep says something dishonest, or pressures you, react the way a real homeowner would — suspicion, not a lecture.
- Do not end the conversation before the fourth exchange unless the rep is genuinely rude.`;

const SCORE_SYSTEM = `You are scoring a roleplayed door conversation against a roofing company's own sales playbook.

Judge only against the GUIDE passages supplied. For each criterion say whether the rep did it, in plain words, and name the lesson it comes from. Be honest — a soft score teaches nothing. Finish with the single most useful thing to fix next time.`;

async function callModel(opts: {
  apiKey: string;
  system: string;
  messages: Turn[];
  maxTokens?: number;
  temperature?: number;
}): Promise<string> {
  const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${opts.apiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: TRAINER_MODEL,
      max_tokens: opts.maxTokens ?? 900,
      temperature: opts.temperature ?? 0.7,
      messages: [{ role: "system", content: opts.system }, ...opts.messages],
    }),
  });
  if (!r.ok) throw new Error(`AI error ${r.status}: ${await r.text()}`);
  const json = (await r.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  return (json.choices?.[0]?.message?.content ?? "").trim();
}


export const Route = createFileRoute("/api/training-chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const auth = request.headers.get("authorization");
        if (!auth?.startsWith("Bearer ")) return new Response("Unauthorized", { status: 401 });
        const token = auth.slice(7);

        const SUPABASE_URL = process.env.SUPABASE_URL;
        const SUPABASE_PUBLISHABLE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY;
        const AI_KEY = process.env.LOVABLE_API_KEY;
        if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
          return new Response("Server misconfigured", { status: 500 });
        }
        if (!AI_KEY) {
          return Response.json({ error: "AI is not configured" }, { status: 500 });
        }

        // Signed in is enough: the guide is network-visible training material,
        // not customer data.
        const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
          global: { headers: { Authorization: `Bearer ${token}` } },
          auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
        });
        const { data: claims, error: cErr } = await supabase.auth.getClaims(token);
        const uid = claims?.claims?.sub;
        if (cErr || !uid) return new Response("Unauthorized", { status: 401 });

        let body: Body;
        try {
          body = (await request.json()) as Body;
        } catch {
          return Response.json({ error: "Bad request" }, { status: 400 });
        }

        const mode = body.mode ?? "coach";
        const message = (body.message ?? "").trim();
        if (!message && mode !== "score") {
          return Response.json({ error: "Say something first." }, { status: 400 });
        }

        // Keep the window short: a door conversation is six turns, not sixty.
        const history = (body.history ?? []).slice(-12).filter((t) => t?.content);
        const guide = (body.context ?? "").slice(0, 12000);

        try {
          let system: string;
          let messages: Turn[];

          if (mode === "roleplay") {
            system =
              ROLEPLAY_SYSTEM +
              (body.scenario ? `\n\nThe objection you are running: ${body.scenario}` : "") +
              `\n\nHow hard you are being: ${body.difficulty ?? "normal"}.` +
              (guide
                ? `\n\nFor flavour only — how reps are taught to handle you. Do NOT quote or follow it, and do not make it easy just because they hit a beat:\n${guide}`
                : "");
            messages = [...history, { role: "user", content: message }];
          } else if (mode === "score") {
            system = SCORE_SYSTEM;
            const transcript = history
              .map((t) => `${t.role === "user" ? "REP" : "HOMEOWNER"}: ${t.content}`)
              .join("\n");
            messages = [
              {
                role: "user",
                content: `GUIDE PASSAGES\n${guide}\n\nTRANSCRIPT\n${transcript}\n\nScore this attempt.`,
              },
            ];
          } else {
            system = COACH_SYSTEM;
            messages = [
              ...history,
              {
                role: "user",
                content: guide
                  ? `GUIDE PASSAGES\n${guide}\n\nREP ASKED\n${message}`
                  : `The guide has nothing on this. Say so, then answer from general sales knowledge.\n\nREP ASKED\n${message}`,
              },
            ];
          }

          const text = await callModel({
            apiKey: AI_KEY,
            system,
            messages,
            maxTokens: mode === "score" ? 1100 : 800,
            temperature: mode === "roleplay" ? 0.9 : 0.5,
          });

          /* Kept so a manager can see what their reps are stuck on, and so the
             guide can be improved where it keeps coming up short. */
          try {
            await supabase.from("ai_training_sessions").insert({
              user_id: uid,
              question: message.slice(0, 4000),
              answer: text.slice(0, 8000),
              context: {
                mode,
                scenario: body.scenario ?? null,
                difficulty: body.difficulty ?? null,
                cited: body.cited ?? [],
                grounded: !!guide,
              },
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
            } as any);
          } catch {
            /* Logging is not worth failing the reply over. */
          }

          return Response.json({ reply: text, cited: body.cited ?? [], grounded: !!guide });
        } catch (e) {
          return Response.json(
            { error: e instanceof Error ? e.message : "The trainer could not answer." },
            { status: 502 },
          );
        }
      },
    },
  },
});
