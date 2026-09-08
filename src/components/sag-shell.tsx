import type { ReactNode } from "react";
import { BackArrow } from "@/components/sag-icons";
import type { SagJobMeta } from "@/lib/sag-ledelse";

export const SAG_FONT = {
  rel: "stylesheet" as const,
  href: "https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600&display=swap",
};

export function sagHead(title: string, description: string) {
  return {
    meta: [
      { title },
      { name: "robots", content: "noindex" },
      { name: "description", content: description },
      { name: "theme-color", content: "#F4F1EC" },
    ],
    links: [SAG_FONT],
  };
}

export function SagShell({ job, hero = false, children }: { job?: SagJobMeta | null; hero?: boolean; children: ReactNode }) {
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
          {hero ? <p className="mt-6 text-[0.7rem] font-medium tracking-[0.28em] text-kunde-accent">BYGGELEDELSE</p> : null}
          {hero && job ? (
            <p className="mt-4 font-kunde text-[clamp(2.4rem,7vw,4.4rem)] leading-[1.05] font-light tracking-[-0.03em] text-kunde-ink">
              {job.name}
            </p>
          ) : null}
          {children}
        </div>
      </div>
    </main>
  );
}

export function SagBack({ to, children }: { to: string; children?: ReactNode }) {
  const label = typeof children === "string" ? children : "Tilbage";
  return (
    <div className="kunde-no-print mb-8 mt-6">
      <BackArrow href={to} label={label} />
    </div>
  );
}

export function SagRow({ href, n, children }: { href?: string; n?: string; children: ReactNode }) {
  const cls = "group flex min-h-14 items-baseline gap-5 border-t border-kunde-line py-5 no-underline sm:gap-8";
  const inner = (
    <>
      {n ? <span className="w-8 shrink-0 font-kunde text-sm font-medium tracking-[0.18em] text-kunde-accent">{n}</span> : null}
      <span className="min-w-0 flex-1 text-[1.2rem] leading-snug font-light tracking-[-0.02em] text-kunde-ink sm:text-[1.45rem]">{children}</span>
      {href ? (
        <span className="shrink-0 text-kunde-muted transition-transform duration-200 group-hover:translate-x-0.5" aria-hidden>
          →
        </span>
      ) : null}
    </>
  );
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
    <dl className="mt-10 grid grid-cols-1 gap-x-10 gap-y-6 sm:grid-cols-2">
      {rows.map(([label, value]) => (
        <div key={label}>
          <dt className="text-[0.68rem] tracking-[0.18em] text-kunde-muted uppercase">{label}</dt>
          <dd className="mt-1 text-base font-medium text-kunde-ink">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function SagMissing() {
  return (
    <SagShell>
      <p className="mt-16 text-3xl font-light">Siden findes ikke</p>
      <p className="mt-3 max-w-md text-sm leading-relaxed text-kunde-muted">Linket er ugyldigt, eller sagen er ikke oprettet endnu.</p>
    </SagShell>
  );
}

export function SagPhotos({ photos }: { photos: { id: string; src: string; n: string }[] }) {
  if (!photos.length) return null;
  return (
    <section className="mt-12">
      <p className="mb-4 text-[0.68rem] tracking-[0.18em] text-kunde-muted uppercase">Foto</p>
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
        {photos.map((p) => (
          <figure key={p.id}>
            <img src={p.src} alt="" referrerPolicy="no-referrer" className="aspect-[4/3] w-full object-cover" />
            <figcaption className="mt-2 text-xs tracking-[0.18em] text-kunde-accent">{p.n}</figcaption>
          </figure>
        ))}
      </div>
    </section>
  );
}
