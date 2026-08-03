// Shared answer-key grading. Pure functions — safe on client and server.
// Used by practice, exam grading, and the admin Answer Key Review screen so a
// typed student answer is judged identically everywhere.

export type QType =
  | "mc" | "multi" | "tf" | "numeric" | "short_text" | "pt_scenario" | "matching" | "ordering";

export type AnswerKey = {
  /** index (or indexes) of the correct option for mc / tf / multi */
  correct?: number | number[];
  /** canonical single value (numeric target, or canonical text answer) */
  value?: number | string;
  values?: Array<number | string>;
  /** numeric tolerance (absolute) */
  tolerance?: number;
  /** accepted typed answers (any exact-ish match = correct) */
  accepted?: string[];
  /** legacy alias */
  accepts?: string[];
  /** keyword rubric for explanation-style answers */
  keywords?: string[];
  /** how many keywords must appear (defaults to 60% of the list) */
  min_keywords?: number;
  case_sensitive?: boolean;
} | null | undefined;

export type GradeStatus = "correct" | "partial" | "incorrect" | "unscored";

export type GradeResult = {
  status: GradeStatus;
  /** 0..1 */
  score: number | null;
  correct: boolean | null;
  /** human explanation of the decision, shown in the admin reviewer */
  reason: string;
  /** which accepted answer / keywords matched */
  matched?: string[];
};

const NUMBER_WORDS: Record<string, string> = {
  zero: "0", one: "1", two: "2", three: "3", four: "4", five: "5", six: "6",
  seven: "7", eight: "8", nine: "9", ten: "10", eleven: "11", twelve: "12",
  thirteen: "13", fourteen: "14", fifteen: "15", sixteen: "16", seventeen: "17",
  eighteen: "18", nineteen: "19", twenty: "20", thirty: "30", forty: "40",
  fifty: "50", sixty: "60", seventy: "70", eighty: "80", ninety: "90",
  hundred: "100", thousand: "1000",
};

/** Lowercase, de-accent, drop punctuation/filler so "Vendor A." === "vendor a" */
export function normalizeText(raw: unknown, caseSensitive = false): string {
  let s = String(raw ?? "");
  s = s.normalize("NFKD").replace(/[\u0300-\u036f]/g, "");
  if (!caseSensitive) s = s.toLowerCase();
  s = s.replace(/[\u2018\u2019\u201b]/g, "'").replace(/[\u201c\u201d]/g, '"');
  s = s.replace(/[^\p{L}\p{N}\s./%'-]/gu, " ");
  s = s.replace(/\s+/g, " ").trim();
  s = s.replace(/^(the|a|an)\s+/, "");
  s = s.replace(/[.\s]+$/, "");
  s = s
    .split(" ")
    .map((w) => NUMBER_WORDS[w] ?? w)
    .join(" ");
  return s;
}

/** Parse "3/4", "1,200", "45%", "$12.50", " 7 " into a number (or null). */
export function parseNumberish(raw: unknown): number | null {
  const s = String(raw ?? "").replace(/[,\s$]/g, "").replace(/%$/, "");
  if (!s) return null;
  const frac = s.match(/^(-?\d+(?:\.\d+)?)\/(\d+(?:\.\d+)?)$/);
  if (frac) {
    const d = Number(frac[2]);
    if (d === 0) return null;
    return Number(frac[1]) / d;
  }
  const mixed = s.match(/^(-?\d+)-(\d+)\/(\d+)$/);
  if (mixed) {
    const d = Number(mixed[3]);
    if (d === 0) return null;
    return Number(mixed[1]) + Number(mixed[2]) / d;
  }
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  const m = a.length, n = b.length;
  if (!m || !n) return m || n;
  let prev = Array.from({ length: n + 1 }, (_, i) => i);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) {
      cur[j] = Math.min(
        prev[j]! + 1,
        cur[j - 1]! + 1,
        prev[j - 1]! + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
    prev = cur;
  }
  return prev[n]!;
}

/** Typo-tolerant equality: longer answers allow more slips. */
export function looseEquals(a: string, b: string): boolean {
  if (!a || !b) return false;
  if (a === b) return true;
  const na = parseNumberish(a), nb = parseNumberish(b);
  if (na !== null && nb !== null) return Math.abs(na - nb) < 1e-9;

  // Compare token by token so a spelling slip is forgiven but a genuinely
  // different short token ("vendor a" vs "vendor b") is never a match.
  const ta = a.split(" "), tb = b.split(" ");
  if (ta.length !== tb.length) return false;
  let slips = 0;
  for (let i = 0; i < tb.length; i++) {
    const x = ta[i]!, y = tb[i]!;
    if (x === y) continue;
    const nx = parseNumberish(x), ny = parseNumberish(y);
    if (nx !== null && ny !== null) {
      if (Math.abs(nx - ny) < 1e-9) continue;
      return false;
    }
    // Short or numeric-bearing tokens must match exactly.
    if (y.length <= 3 || /\d/.test(y) || /\d/.test(x)) return false;
    const budget = y.length >= 8 ? 2 : 1;
    if (levenshtein(x, y) > budget) return false;
    slips += 1;
    if (slips > 2) return false;
  }
  return true;
}


function acceptedList(key: NonNullable<AnswerKey>): string[] {
  const out: string[] = [];
  for (const v of [...(key.accepted ?? []), ...(key.accepts ?? [])]) {
    if (v !== null && v !== undefined && String(v).trim() !== "") out.push(String(v));
  }
  if (typeof key.value === "string" && key.value.trim()) out.push(key.value);
  if (typeof key.value === "number") out.push(String(key.value));
  for (const v of key.values ?? []) out.push(String(v));
  return Array.from(new Set(out));
}

export function correctIndexes(key: AnswerKey): number[] {
  if (!key || typeof key !== "object") return [];
  const raw = key.correct ?? key.values ?? key.value;
  if (Array.isArray(raw)) return raw.map((v) => Number(v)).filter((n) => Number.isFinite(n));
  const n = Number(raw);
  return Number.isFinite(n) ? [n] : [];
}

/**
 * Coerce any stored answer_key shape (bare index, letter, option text, array,
 * {value}/{answer}/{index}/{indices}) into the canonical AnswerKey the grader reads.
 */
export function normalizeAnswerKey(type: QType, raw: unknown, options: string[] = []): AnswerKey {
  if (raw === null || raw === undefined || raw === "") return null;
  const objective = ["mc", "tf", "multi", "matching", "ordering"].includes(type);
  const opts = options.length ? options : type === "tf" ? ["True", "False"] : [];
  const toIndex = (v: unknown): number | null => {
    if (typeof v === "number" && Number.isFinite(v)) return v;
    const s = normalizeText(v);
    if (/^[a-h]$/.test(s)) return s.charCodeAt(0) - 97;
    if (/^\d+$/.test(s)) return Number(s);
    const i = opts.findIndex((o) => normalizeText(o) === s);
    return i >= 0 ? i : null;
  };

  if (objective) {
    let candidates: unknown[] = [];
    if (Array.isArray(raw)) candidates = raw;
    else if (typeof raw === "object") {
      const o = raw as any;
      const c = o.correct ?? o.indices ?? o.index ?? o.values ?? o.value ?? o.answer;
      candidates = Array.isArray(c) ? c : c === undefined ? [] : [c];
    } else candidates = [raw];
    const idx = candidates.map(toIndex).filter((n): n is number => n !== null);
    if (!idx.length) return null;
    return type === "mc" || type === "tf" ? { correct: idx[0]! } : { correct: idx };
  }

  if (typeof raw === "object" && !Array.isArray(raw)) {
    const o = raw as any;
    if (o.value !== undefined || o.accepted || o.accepts || o.keywords || o.values) return o as AnswerKey;
    if (o.correct !== undefined) {
      return type === "numeric"
        ? { value: o.correct, tolerance: o.tolerance }
        : { accepted: (Array.isArray(o.correct) ? o.correct : [o.correct]).map(String) };
    }
    return o as AnswerKey;
  }

  const list = (Array.isArray(raw) ? raw : [raw]).filter((v) => v !== null && v !== undefined && String(v).trim() !== "");
  if (!list.length) return null;
  return type === "numeric" ? { value: list[0] as any } : { accepted: list.map(String) };
}


/** True when the key has enough information to auto-grade this question type. */
export function keyIsUsable(type: QType, key: AnswerKey): boolean {
  if (!key || typeof key !== "object") return false;
  switch (type) {
    case "mc":
    case "tf":
    case "multi":
    case "matching":
    case "ordering":
      return correctIndexes(key).length > 0;
    case "numeric":
      return parseNumberish(key.value ?? (key as any).correct) !== null;
    case "short_text":
      return acceptedList(key).length > 0 || (key.keywords ?? []).length > 0;
    case "pt_scenario":
      return (key.keywords ?? []).length > 0;
    default:
      return false;
  }
}

/**
 * Grade a single response. Never throws.
 * `score` is a 0..1 fraction; `status: "unscored"` means the key can't decide
 * (blank answer or missing key) and a human/AI pass is needed.
 */
export function gradeAnswer(type: QType, key: AnswerKey, response: unknown): GradeResult {
  const blank =
    response === null ||
    response === undefined ||
    (typeof response === "string" && response.trim() === "") ||
    (Array.isArray(response) && response.length === 0);

  if (!key || !keyIsUsable(type, key)) {
    return { status: "unscored", score: null, correct: null, reason: "No usable answer key yet." };
  }
  if (blank) {
    return { status: "incorrect", score: 0, correct: false, reason: "No answer given." };
  }

  const k = key as NonNullable<AnswerKey>;

  if (type === "mc" || type === "tf") {
    const want = correctIndexes(k);
    const got = Number(response);
    const ok = want.includes(got);
    return {
      status: ok ? "correct" : "incorrect",
      score: ok ? 1 : 0,
      correct: ok,
      reason: ok ? "Chose the keyed option." : `Keyed option is ${want.map((i) => String.fromCharCode(65 + i)).join("/")}.`,
    };
  }

  if (type === "multi" || type === "matching" || type === "ordering") {
    const want = correctIndexes(k);
    const got = (Array.isArray(response) ? response : [response]).map((v) => Number(v)).filter((n) => Number.isFinite(n));
    const ordered = type === "ordering";
    const a = ordered ? got : [...got].sort((x, y) => x - y);
    const b = ordered ? want : [...want].sort((x, y) => x - y);
    const exact = a.length === b.length && a.every((v, i) => v === b[i]);
    if (exact) return { status: "correct", score: 1, correct: true, reason: "All parts match the key." };
    if (!ordered) {
      const hits = a.filter((v) => b.includes(v)).length;
      const wrong = a.filter((v) => !b.includes(v)).length;
      const frac = b.length ? Math.max(0, (hits - wrong) / b.length) : 0;
      if (frac > 0) {
        return { status: "partial", score: Math.round(frac * 100) / 100, correct: false, reason: `${hits} of ${b.length} correct selections.` };
      }
    }
    return { status: "incorrect", score: 0, correct: false, reason: "Selection does not match the key." };
  }

  if (type === "numeric") {
    const target = parseNumberish(k.value ?? (k as any).correct);
    const got = parseNumberish(response);
    if (got === null) {
      return { status: "incorrect", score: 0, correct: false, reason: "Answer is not a number." };
    }
    const tol = Number(k.tolerance ?? 0);
    const ok = target !== null && Math.abs(got - target) <= (tol || 1e-9);
    return {
      status: ok ? "correct" : "incorrect",
      score: ok ? 1 : 0,
      correct: ok,
      reason: ok ? "Matches the keyed value." : `Keyed value is ${target}${tol ? ` (±${tol})` : ""}.`,
    };
  }

  // short_text / pt_scenario — typed answers
  const cs = k.case_sensitive === true;
  const typed = normalizeText(response, cs);
  const accepted = acceptedList(k);

  for (const cand of accepted) {
    const target = normalizeText(cand, cs);
    if (looseEquals(typed, target)) {
      return { status: "correct", score: 1, correct: true, reason: `Matches accepted answer “${cand}”.`, matched: [cand] };
    }
  }
  // Accepted answer appearing inside a longer sentence still counts.
  for (const cand of accepted) {
    const target = normalizeText(cand, cs);
    if (target.length >= 2 && typed.includes(target)) {
      return { status: "correct", score: 1, correct: true, reason: `Contains accepted answer “${cand}”.`, matched: [cand] };
    }
  }

  const keywords = (k.keywords ?? []).filter((w) => String(w).trim() !== "");
  if (keywords.length) {
    const hitList = keywords.filter((w) => {
      const t = normalizeText(w, cs);
      if (!t) return false;
      if (typed.includes(t)) return true;
      return typed.split(" ").some((word) => looseEquals(word, t));
    });
    const need = Math.max(1, Number(k.min_keywords ?? Math.ceil(keywords.length * 0.6)));
    const frac = Math.min(1, hitList.length / need);
    if (hitList.length >= need) {
      return { status: "correct", score: 1, correct: true, reason: `Covered ${hitList.length}/${keywords.length} key ideas.`, matched: hitList };
    }
    if (hitList.length > 0) {
      return {
        status: "partial",
        score: Math.round(frac * 100) / 100,
        correct: false,
        reason: `Only ${hitList.length} of ${need} key ideas needed.`,
        matched: hitList,
      };
    }
  }

  if (accepted.length === 0 && keywords.length === 0) {
    return { status: "unscored", score: null, correct: null, reason: "No accepted answers or key ideas set." };
  }
  return { status: "incorrect", score: 0, correct: false, reason: "Does not match any accepted answer." };
}
