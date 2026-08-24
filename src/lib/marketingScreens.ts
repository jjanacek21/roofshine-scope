import manifest from "../../public/marketing/manifest.json";

export type ScreenShape = "phone" | "paper";

export type Screen = {
  key: string;
  src: string;
  title: string;
  caption: string;
  category: string;
  shape: ScreenShape;
};

const raw = manifest as unknown as {
  categories: Record<string, string>;
  screens: Record<
    string,
    { src: string; title: string; caption: string; category: string; shape: string }
  >;
};

export const CATEGORY_LABELS: Record<string, string> = raw.categories;

export const SCREENS: Screen[] = Object.entries(raw.screens).map(([key, s]) => ({
  key,
  src: s.src,
  title: s.title,
  caption: s.caption,
  category: s.category,
  shape: (s.shape === "paper" ? "paper" : "phone") as ScreenShape,
}));

const BY_KEY = new Map(SCREENS.map((s) => [s.key, s]));

export function screen(key: string): Screen {
  const s = BY_KEY.get(key);
  if (!s) throw new Error(`Unknown marketing screen: ${key}`);
  return s;
}

export function screens(keys: string[]): Screen[] {
  return keys.map(screen);
}

/** Category order used by the gallery filter chips. */
export const CATEGORY_ORDER = [
  "measurement",
  "review",
  "takeoff",
  "photos",
  "report",
  "estimate",
  "presentation",
  "authorization",
  "carrier",
];
