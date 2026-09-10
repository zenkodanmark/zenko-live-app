import type { ReactNode } from "react";
import { BackArrow } from "@/components/sag-icons";
import type { KundeJobMeta } from "@/lib/ks-customer";

export const KUNDE_FONT = {
  rel: "stylesheet" as const,
  href: "https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600&display=swap",
};

export function kundeHead(title: string, description: string) {
  return {
    meta: [
      { title },
      { name: "robots", content: "noindex" },
      { name: "description", content: description },
      { name: "theme-color", content: "#F4F1EC" },
    ],
    links: [KUNDE_FONT],
  };
}

export function KundeShell({ job, hero = false, children }: { job?: KundeJobMeta | null; hero?: boolean; children: ReactNode }) {
  return (
    <main className="kunde-a">
      <aside className="kunde-brick kunde-brick-side fixed inset-y-0 left-0 hidden w-[18vw] max-w-[280px] min-w-[140px] overflow-hidden lg:block">
        <img src="/kunde/mursten.jpg" alt="" className="h-full w-full object-cover" />
      </aside>
      <div className="kunde-brick-top lg:hidden">
        <img src="/kunde/mursten.jpg" alt="" className="h-[110px] w-full object-cover" />
      </div>
      <div className="lg:ml-[18vw]">
        <div className={`mx-auto max-w-[42rem] px-6 pb-24 sm:px-10 ${hero ? "py-10 sm:py-16" : "pt-8 pb-24 sm:pt-12"}`}>
          <p className="text-[0.7rem] font-medium tracking-[0.28em] text-kunde-ink">ZENKO DANMARK</p>
          {hero && job ? (
            <p className="mt-10 font-kunde text-[clamp(2.4rem,7vw,4.4rem)] leading-[1.05] font-light tracking-[-0.03em] text-kunde-ink">
              {job.name}
            </p>
          ) : null}
          {children}
        </div>
      </div>
    </main>
  );
}

export function KundeBack({ to, children }: { to: string; children?: ReactNode }) {
  const label = typeof children === "string" ? children : "Tilbage";
  return (
    <div className="kunde-no-print mb-8 mt-6">
      <BackArrow href={to} label={label} />
    </div>
  );
}

export function KundeRow({ href, count, children }: { href: string; count?: number; children: ReactNode }) {
  return (
    <a href={href} className="group flex min-h-14 items-baseline gap-5 border-t border-kunde-line py-5 no-underline sm:gap-8">
      <span className="min-w-0 flex-1 text-[1.35rem] leading-snug font-light tracking-[-0.02em] text-kunde-ink sm:text-[1.65rem]">
        {children}
      </span>
      {count != null ? (
        <span className="shrink-0 font-kunde text-[1.35rem] font-light tabular-nums text-kunde-ink sm:text-[1.65rem]">{count}</span>
      ) : null}
      <span className="shrink-0 text-kunde-muted transition-transform duration-200 group-hover:translate-x-0.5" aria-hidden>
        →
      </span>
    </a>
  );
}

export function KundeMetaGrid({ rows }: { rows: [string, string][] }) {
  if (!rows.length) return null;
  return (
    <dl className="ks-felt-grid mt-10 grid grid-cols-1 gap-x-10 gap-y-6 sm:grid-cols-2">
      {rows.map(([label, value]) => (
        <div key={label}>
          <dt className="text-[0.68rem] tracking-[0.18em] text-kunde-muted uppercase">{label}</dt>
          <dd className="mt-1 text-base font-medium text-kunde-ink">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function KundeFooter({ job, actionHref, action }: { job: KundeJobMeta; actionHref?: string; action?: string }) {
  return (
    <footer className="mt-20 border-t border-kunde-line pt-6 text-sm text-kunde-muted">
      <p>
        {job.name} · KS-aflevering
      </p>
      {action && actionHref ? (
        <a href={actionHref} className="mt-3 inline-block text-kunde-accent no-underline">
          {action}
        </a>
      ) : null}
    </footer>
  );
}

export function KundeMissing() {
  return (
    <KundeShell>
      <p className="mt-16 text-3xl font-light">Siden findes ikke</p>
      <p className="mt-3 max-w-md text-sm leading-relaxed text-kunde-muted">Linket er ugyldigt, eller sagen er ikke oprettet endnu.</p>
    </KundeShell>
  );
}
