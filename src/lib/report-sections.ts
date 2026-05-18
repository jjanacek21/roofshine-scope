export type BuiltInSectionType =
  | "cover"
  | "executive"
  | "damage"
  | "measurement"
  | "investment"
  | "documentation"
  | "photos"
  | "options"
  | "terms"
  | "footer";

export type CustomSectionType =
  | "rich_text"
  | "image"
  | "flyer"
  | "infographic"
  | "cover_letter"
  | "cover_photo"
  | "uploaded_doc"
  | "embedded_video"
  | "divider";

export type SectionType = BuiltInSectionType | CustomSectionType;

export type ReportSection = {
  id: string;
  type: SectionType;
  title: string;
  visible: boolean;
  props: {
    // rich_text / cover_letter
    text?: string;
    // image / flyer / infographic / cover_photo / uploaded_doc / embedded_video
    assetId?: string;
    storagePath?: string;
    bucket?: string;
    mimeType?: string;
    posterStoragePath?: string;
    fallbackUrl?: string;
    // generation metadata
    aiPrompt?: string;
    aiStyle?: string;
  };
};

export const BUILT_IN_LABEL: Record<BuiltInSectionType, string> = {
  cover: "Cover",
  executive: "Executive Summary",
  damage: "Damage Summary",
  measurement: "Measurement Report",
  investment: "Investment",
  documentation: "Photo Documentation",
  photos: "Photos",
  options: "Your Options",
  terms: "Terms & Authorization",
  footer: "Footer",
};

export const CUSTOM_LABEL: Record<CustomSectionType, string> = {
  rich_text: "Rich Text",
  image: "Image",
  flyer: "AI Flyer",
  infographic: "AI Infographic",
  cover_letter: "AI Cover Letter",
  cover_photo: "AI Cover Photo",
  uploaded_doc: "Uploaded Document",
  embedded_video: "Embedded Video",
  divider: "Divider",
};

export function defaultSections(): ReportSection[] {
  const mk = (type: BuiltInSectionType): ReportSection => ({
    id: crypto.randomUUID(),
    type,
    title: BUILT_IN_LABEL[type],
    visible: true,
    props: {},
  });
  return [
    mk("cover"),
    mk("executive"),
    mk("damage"),
    mk("measurement"),
    mk("investment"),
    mk("documentation"),
    mk("options"),
    mk("terms"),
    mk("footer"),
  ];
}

export function newSection(type: SectionType, partial: Partial<ReportSection> = {}): ReportSection {
  const label =
    (BUILT_IN_LABEL as Record<string, string>)[type] ??
    (CUSTOM_LABEL as Record<string, string>)[type] ??
    "Section";
  return {
    id: crypto.randomUUID(),
    type,
    title: label,
    visible: true,
    props: {},
    ...partial,
  };
}
