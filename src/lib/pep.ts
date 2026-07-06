// Shared PEP domain constants and helpers (client-safe).

export type Subject = "mathematics" | "language_arts" | "science" | "social_studies";
export type PepComponent = "AT" | "CBT" | "PT";
export type Band = "beginning" | "developing" | "proficient" | "highly_proficient";
export type QuestionType =
  | "mc" | "multi" | "tf" | "numeric" | "matching" | "ordering" | "short_text" | "pt_scenario";

export const SUBJECTS: { key: Subject; label: string; emoji: string }[] = [
  { key: "mathematics", label: "Mathematics", emoji: "🧮" },
  { key: "language_arts", label: "Language Arts", emoji: "📚" },
  { key: "science", label: "Science", emoji: "🔬" },
  { key: "social_studies", label: "Social Studies", emoji: "🌍" },
];

export const COMPONENTS: { key: PepComponent; label: string; blurb: string }[] = [
  { key: "AT", label: "Ability Test", blurb: "Reasoning puzzles — verbal, number, and pattern." },
  { key: "CBT", label: "Curriculum Test", blurb: "What you learn in class, by subject and grade." },
  { key: "PT", label: "Performance Task", blurb: "Real-world scenarios where you plan and explain." },
];

export const BAND_LABEL: Record<Band, string> = {
  beginning: "Beginning",
  developing: "Developing",
  proficient: "Proficient",
  highly_proficient: "Highly Proficient",
};

export const BAND_MESSAGE: Record<Band, string> = {
  beginning: "You're starting out — keep going, every try helps!",
  developing: "You're getting stronger. A little more practice will do it.",
  proficient: "Great work — you've got this topic!",
  highly_proficient: "Superstar! You're mastering this.",
};

export function scoreToBand(pct: number): Band {
  if (pct >= 85) return "highly_proficient";
  if (pct >= 70) return "proficient";
  if (pct >= 50) return "developing";
  return "beginning";
}
