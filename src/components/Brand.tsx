import { Link } from "@tanstack/react-router";

export function Brand({ className = "" }: { className?: string }) {
  return (
    <Link to="/" className={`flex items-center gap-2 ${className}`} aria-label="viiedu. | PEP Ready home">
      <span className="display rounded-2xl bg-primary px-2.5 py-1 text-base font-semibold tracking-tight text-primary-foreground">
        viiedu.
      </span>
      <span aria-hidden className="text-lg text-muted-foreground">|</span>
      <span className="display text-lg font-bold">PEP Ready</span>
    </Link>
  );
}
