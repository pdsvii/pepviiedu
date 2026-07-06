import { BAND_LABEL, type Band } from "@/lib/pep";
import { Sparkles } from "lucide-react";

export function BandBadge({ band, size = "md" }: { band: Band; size?: "sm" | "md" | "lg" }) {
  const scale = size === "lg" ? "text-base px-4 py-2" : size === "sm" ? "text-xs px-2 py-0.5" : "";
  return (
    <span className={`band-chip ${scale}`} data-band={band}>
      <Sparkles className="h-3.5 w-3.5" aria-hidden />
      {BAND_LABEL[band]}
    </span>
  );
}
