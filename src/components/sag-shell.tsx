import type { ReactNode } from "react";
import { BackArrow, SagPng, type SagPngName } from "@/components/sag-icons";
import { ToastHost } from "@/components/toast-host";
import type { SagJobMeta } from "@/lib/sag-ledelse";

export const SAG_FONT = {
  rel: "stylesheet" as const,
  href: "https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@600;700&family=Source+Sans+3:wght@400;600&display=swap",
};

export function sagHead(title: string, description: string) {
  return {
    meta: [
      { title },
      { name: "robots", content: "noindex" },
      { name: "description", content: description },
      { name: "theme-color", content: "#1a2b33" },
    ],
    links: [SAG_FONT],
  };
}

export function SagShell({ job, hero = false, children }: { job?: SagJobMeta | null; hero?: boolean; children: ReactNode }) {
  return (
    <main className="min-h-dvh bg-sand pb-24" data-testid="ledelse-desk">
      <header className="bg-navy px-4 pb-4 pt-[max(0.75rem,env(safe-area-inset-top))] text-sand">
        <p className="text-xs font-semibold tracking-[0.18em] uppercase">Zenko Danmark</p>
        <p className="mt-1 text-xs tracking-wide text-sand/70">Byggeledelse</p>
        {hero && job ? <h1 className="mt-2 font-display text-4xl leading-none">{job.name}</h1> : null}
        {hero && job?.address ? <p className="mt-1 text-sm text-sand/80">{job.address}</p> : null}
      </header>
      <div className={`mx-auto max-w-lg space-y-3 px-4 ${hero ? "py-4" : "pt-3 pb-8"}`}>{children}</div>
      <ToastHost />
    </main>
  );
}

export function SagBack({ to, children }: { to: string; children?: ReactNode }) {
  const label = typeof children === "string" ? children : "Tilbage";
  return (
    <div className="mb-1">
      <BackArrow href={to} label={label} />
    </div>
  );
}

export function SagTypeBtn({
  href,
  icon,
  title,
  count,
  line,
  testId,
}: {
  href: string;
  icon: SagPngName;
  title: string;
  count: number;
  line: string;
  testId?: string;
}) {
  return (
    <a
      href={href}
      data-testid={testId}
      className="flex min-h-[5.75rem] w-full items-center gap-3 rounded-[24px] bg-paper px-3 py-2 no-underline shadow-card"
    >
      <SagPng name={icon} px={84} />
      <span className="min-w-0 flex-1 text-left">
        <span className="block font-display text-3xl leading-none text-navy">{title}</span>
        <span className="mt-1 block text-sm text-muted">{line}</span>
      </span>
      <span className="font-display text-3xl tabular-nums text-brick">{count}</span>
    </a>
  );
}

export function SagRow({ href, n, children }: { href?: string; n?: string; children: ReactNode }) {
  const inner = (
    <span className="flex min-w-0 flex-1 items-center justify-between gap-3">
      {n ? <span className="font-display text-lg text-brick">{n}</span> : null}
      <span className="min-w-0 flex-1 text-left text-list leading-[1.4] text-ink">{children}</span>
    </span>
  );
  const cls = "flex min-h-16 w-full items-center rounded-[20px] bg-paper px-4 py-3 no-underline shadow-card";
  if (!href) return <div className={cls}>{inner}</div>;
  return (
    <a href={href} className={cls}>
      {inner}
    </a>
  );
}

export function SagMetaGrid({ rows }: { rows: [string, string][] }) {
  if (!rows.length) return null;
  return (
    <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {rows.map(([label, value]) => (
        <div key={label} className="rounded-2xl bg-paper px-4 py-3 shadow-card">
          <dt className="text-xs font-semibold tracking-wide text-muted uppercase">{label}</dt>
          <dd className="mt-1 text-base font-semibold text-navy">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function SagMissing() {
  return (
    <SagShell>
      <p className="mt-8 font-display text-3xl text-navy">Siden findes ikke</p>
      <p className="mt-2 text-sm text-muted">Linket er ugyldigt, eller sagen er ikke oprettet endnu.</p>
    </SagShell>
  );
}

export function SagPhotos({ photos }: { photos: { id: string; src: string; n: string }[] }) {
  if (!photos.length) return null;
  return (
    <section className="mt-4">
      <p className="mb-2 text-xs font-semibold tracking-wide text-muted uppercase">Foto</p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {photos.map((p) => (
          <figure key={p.id} className="overflow-hidden rounded-2xl bg-paper shadow-card">
            <img src={p.src} alt="" referrerPolicy="no-referrer" className="aspect-[4/3] w-full object-cover" />
            <figcaption className="px-3 py-2 text-xs font-semibold tracking-wide text-brick">{p.n}</figcaption>
          </figure>
        ))}
      </div>
    </section>
  );
}
