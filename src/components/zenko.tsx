import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export function BrickMark({ className, light }: { className?: string; light?: boolean }) {
  return (
    <svg viewBox="0 0 48 40" className={cn(light ? "text-brick-soft" : "text-brick", className)} aria-hidden="true" fill="currentColor">
      <rect x="1" y="1" width="22" height="11" rx="1.5" />
      <rect x="25" y="1" width="22" height="11" rx="1.5" />
      <rect x="1" y="14.5" width="10" height="11" rx="1.5" />
      <rect x="13" y="14.5" width="22" height="11" rx="1.5" />
      <rect x="37" y="14.5" width="10" height="11" rx="1.5" />
      <rect x="1" y="28" width="22" height="11" rx="1.5" />
      <rect x="25" y="28" width="22" height="11" rx="1.5" />
    </svg>
  );
}

export function Wordmark({ light }: { light?: boolean }) {
  return (
    <div className="flex items-center gap-2.5" data-testid="wordmark">
      <img
        src="/icons/apple-touch-icon.png"
        alt=""
        width={36}
        height={36}
        className="size-9 shrink-0 rounded-[9px]"
        draggable={false}
      />
      <div className={cn("font-display text-2xl font-semibold tracking-widest", light ? "text-sand" : "text-navy")}>ZENKO</div>
    </div>
  );
}

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <section className={cn("rounded-[18px] bg-paper p-4 shadow-card", className)}>{children}</section>;
}

export function SectionLabel({ children }: { children: ReactNode }) {
  return <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">{children}</p>;
}

export function Chip({ children, tone = "sand", className }: { children: ReactNode; tone?: "sand" | "navy" | "ok" | "brick" | "off"; className?: string }) {
  const map = {
    sand: "bg-sand text-ink",
    navy: "bg-navy text-sand",
    ok: "bg-moss text-sand",
    brick: "bg-brick text-sand",
    off: "bg-sand-deep text-muted",
  };
  return <span className={cn("inline-flex min-h-7 items-center rounded-full px-2.5 text-xs font-medium", map[tone], className)}>{children}</span>;
}

export function PrimaryButton({
  children,
  className,
  tone = "brick",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { tone?: "brick" | "navy" | "sand" }) {
  const map = {
    brick: "bg-brick text-sand",
    navy: "bg-navy text-sand",
    sand: "bg-sand text-navy",
  };
  return (
    <button type="button" className={cn("inline-flex min-h-11 w-full items-center justify-center rounded-xl px-4 text-sm font-semibold", map[tone], className)} {...props}>
      {children}
    </button>
  );
}

export function GhostButton({ children, className, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button type="button" className={cn("inline-flex min-h-11 items-center justify-center rounded-xl px-3 text-sm font-medium text-navy", className)} {...props}>
      {children}
    </button>
  );
}

export function Avatar({ initials, className, px = 40 }: { initials: string; className?: string; px?: number }) {
  return (
    <span
      className={cn("inline-flex shrink-0 items-center justify-center rounded-full bg-navy font-display font-semibold tracking-wide text-sand", className)}
      style={{ width: px, height: px, fontSize: Math.max(11, Math.round(px * 0.36)) }}
    >
      {initials}
    </span>
  );
}

export function BrickMeter({ n, label }: { n: number; label?: string }) {
  const shown = Math.min(Math.max(n, 0), 16);
  return (
    <div>
      <div className="flex flex-wrap gap-1">
        {Array.from({ length: Math.max(shown, 1) }, (_, i) => (
          <span key={i} className="brick-slot" data-fill={i < n ? "1" : "0"} />
        ))}
      </div>
      {label ? <p className="mt-1 text-xs text-muted">{label}</p> : null}
    </div>
  );
}
