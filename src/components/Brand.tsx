import { Link } from "@tanstack/react-router";

export function Brand({ className = "" }: { className?: string }) {
  return (
    <Link to="/" className={`flex items-center gap-2 leading-none ${className}`} aria-label="viiedu. | PEP Ready home">
      <span className="display inline-flex items-center rounded-2xl bg-primary px-2.5 py-1.5 text-lg font-semibold leading-none tracking-tight text-primary-foreground">
        viiedu.
      </span>
      <span aria-hidden className="text-lg leading-none text-muted-foreground">|</span>
      <span className="display text-lg font-bold leading-none">PEP Ready</span>
    </Link>
  );
}
