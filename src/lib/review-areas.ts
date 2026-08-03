// Client-safe constants shared by the App Tester console and the admin inbox.

export const REVIEW_AREAS = [
  { value: "general", label: "General / whole app" },
  { value: "auth", label: "Sign up & sign in" },
  { value: "student_dashboard", label: "Student dashboard" },
  { value: "practice", label: "Practice mode" },
  { value: "exam", label: "Mock exam engine" },
  { value: "results", label: "Results & proficiency bands" },
  { value: "parent", label: "Parent area" },
  { value: "teacher", label: "Teacher area (classes & assignments)" },
  { value: "content", label: "Question bank & content" },
  { value: "answer_keys", label: "Answer keys & marking" },
  { value: "admin", label: "Admin tools" },
  { value: "performance", label: "Speed & reliability" },
] as const;

export type ReviewArea = (typeof REVIEW_AREAS)[number]["value"];

export const REVIEW_CATEGORIES = [
  { value: "content", label: "Content error" },
  { value: "answer_key", label: "Wrong / missing answer key" },
  { value: "wording", label: "Wording or grammar" },
  { value: "curriculum_alignment", label: "Curriculum alignment (MOEY)" },
  { value: "layout", label: "Layout or alignment" },
  { value: "bug", label: "Bug / does not work" },
  { value: "accessibility", label: "Accessibility / readability" },
  { value: "suggestion", label: "Improvement suggestion" },
] as const;

export const REVIEW_SEVERITIES = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "blocker", label: "Blocker" },
] as const;

export const REVIEW_STATUSES = [
  { value: "open", label: "Open" },
  { value: "acknowledged", label: "Acknowledged" },
  { value: "in_progress", label: "In progress" },
  { value: "fixed", label: "Fixed" },
  { value: "wont_fix", label: "Won't fix" },
] as const;

export const areaLabel = (v: string) => REVIEW_AREAS.find((a) => a.value === v)?.label ?? v;
export const categoryLabel = (v: string) => REVIEW_CATEGORIES.find((a) => a.value === v)?.label ?? v;
export const statusLabel = (v: string) => REVIEW_STATUSES.find((a) => a.value === v)?.label ?? v;

export const severityClass = (v: string) =>
  v === "blocker"
    ? "bg-destructive/15 text-destructive"
    : v === "high"
      ? "bg-primary/15 text-primary"
      : v === "medium"
        ? "bg-secondary text-secondary-foreground"
        : "bg-muted text-muted-foreground";

export const statusClass = (v: string) =>
  v === "fixed"
    ? "bg-primary/15 text-primary"
    : v === "in_progress"
      ? "bg-secondary text-secondary-foreground"
      : v === "wont_fix"
        ? "bg-muted text-muted-foreground"
        : "bg-accent text-accent-foreground";
