import { useEffect, useState } from "react";
import { BackArrow } from "@/components/sag-icons";
import { HANDBOOK, kundeJobFields, kundePath, padReportNo, pdfFilename, type KundeReportView, type KundeSite } from "@/lib/ks-customer";
import { KundeBack, KundeFooter, KundeMetaGrid, KundeMissing, KundeRow, KundeShell } from "@/components/kunde-shell";

function dmy(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso.slice(0, 10);
  return d.toLocaleDateString("da-DK", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function padN(i: number) {
  return String(i).padStart(2, "0");
}

export function KundeHome({ site }: { site: KundeSite | null }) {
  if (!site) return <KundeMissing />;
  const { job, parts } = site;
  return (
    <KundeShell job={job} hero>
      <KundeMetaGrid rows={kundeJobFields(job)} />
      <nav className="mt-16">
        <KundeRow n="01" href={kundePath(job.slug, ["haandbog"])}>
          Kvalitetssikringshåndbog
        </KundeRow>
        {parts.map((p, i) => (
          <KundeRow key={p.code} n={padN(i + 2)} href={kundePath(job.slug, [p.code])}>
            {p.code === "ovrige" ? (
              <span>{p.title}</span>
            ) : (
              <>
                <span className="text-kunde-accent">{p.code}</span>
                <span className="mt-1 block">{p.title}</span>
              </>
            )}
          </KundeRow>
        ))}
      </nav>
      <KundeFooter job={job} actionHref={kundePath(job.slug, ["komplet"])} action="Generer komplet KS-rapport som PDF" />
    </KundeShell>
  );
}

export function KundeHandbook({ site }: { site: KundeSite | null }) {
  if (!site) return <KundeMissing />;
  const { job } = site;
  const rows = kundeJobFields(job).filter(([k]) => ["Bygherre", "Entreprise", "Omfang", "Blok / afdeling", "Periode", "Kvalitetsansvarlig"].includes(k));
  rows.push(["Entreprenør", job.firm]);
  rows.push(["CVR", job.cvr]);
  rows.push(["Telefon", job.phone]);
  return (
    <KundeShell job={job}>
      <KundeBack to={kundePath(job.slug)}>Tilbage til {job.name}</KundeBack>
      <h1 className="mt-2 text-[clamp(2rem,5vw,3.2rem)] leading-tight font-light">Kvalitetssikringshåndbog</h1>
      <KundeMetaGrid rows={rows} />
      <section className="mt-16 space-y-12">
        <HandbookBlock n={HANDBOOK.purpose.n} title={HANDBOOK.purpose.title}>
          <p>{HANDBOOK.purpose.body}</p>
        </HandbookBlock>
        <HandbookBlock n={HANDBOOK.duty.n} title={HANDBOOK.duty.title}>
          <p>{HANDBOOK.duty.body}</p>
        </HandbookBlock>
        <HandbookBlock n={HANDBOOK.control.n} title={HANDBOOK.control.title}>
          <ul className="space-y-3">
            {HANDBOOK.control.items.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </HandbookBlock>
        <HandbookBlock n={HANDBOOK.docs.n} title={HANDBOOK.docs.title}>
          <p>{HANDBOOK.docs.body}</p>
        </HandbookBlock>
      </section>
      <KundeFooter job={job} actionHref={kundePath(job.slug, ["komplet"])} action="Generer komplet KS-rapport som PDF" />
    </KundeShell>
  );
}

function HandbookBlock({ n, title, children }: { n: string; title: string; children: React.ReactNode }) {
  return (
    <article>
      <p className="text-sm font-medium tracking-[0.18em] text-kunde-accent">{n}</p>
      <h2 className="mt-2 text-2xl font-light tracking-[-0.02em]">{title}</h2>
      <div className="mt-4 max-w-prose text-[1.05rem] leading-[1.65] text-kunde-ink">{children}</div>
    </article>
  );
}

export function KundePunkt({ site, code }: { site: KundeSite | null; code: string }) {
  if (!site) return <KundeMissing />;
  const part = site.parts.find((p) => p.code === code);
  const reports = site.reports.filter((r) => r.part.code === code);
  if (!part || !reports.length) return <KundeMissing />;
  const { job } = site;
  return (
    <KundeShell job={job}>
      <KundeBack to={kundePath(job.slug)}>Tilbage til {job.name}</KundeBack>
      {part.code === "ovrige" ? null : <p className="text-sm font-medium tracking-[0.18em] text-kunde-accent">{part.code}</p>}
      <h1 className={`${part.code === "ovrige" ? "mt-2" : "mt-3"} text-[clamp(2rem,5vw,3.2rem)] leading-tight font-light`}>{part.title}</h1>
      <p className="mt-4 text-sm text-kunde-muted">
        {reports.length} {reports.length === 1 ? "rapport" : "rapporter"}
        {part.controlPoint ? ` · ${part.controlPoint}` : ""}
      </p>
      <nav className="mt-12">
        {reports.map((r) => (
          <a key={r.id} href={kundePath(job.slug, [part.code, r.pad])} className="kunde-punkt-row">
            {r.photos.length ? (
              <span className="kunde-punkt-row-thumbs">
                {r.photos.slice(0, 3).map((p) => (
                  <img key={p.id} src={p.src} alt="" width={56} height={56} referrerPolicy="no-referrer" />
                ))}
              </span>
            ) : null}
            <span className="kunde-punkt-row-body">
              <span className="kunde-punkt-row-text">
                <span className="kunde-punkt-row-title">
                  Rapport {r.pad} · {r.employeeName}
                  {r.location ? ` · ${r.location}` : ""}
                </span>
                <span className="kunde-punkt-row-date">{dmy(r.createdAt)}</span>
              </span>
              <span className="kunde-punkt-row-go" aria-hidden>
                →
              </span>
            </span>
          </a>
        ))}
      </nav>
    </KundeShell>
  );
}

export function KundeRapport({ site, code, pad }: { site: KundeSite | null; code: string; pad: string }) {
  if (!site) return <KundeMissing />;
  const report = site.reports.find((r) => r.part.code === code && (r.pad === pad || padReportNo(r.number) === pad || r.number === pad));
  if (!report) return <KundeMissing />;
  return (
    <KundeShell job={site.job}>
      <KundeBack to={kundePath(site.job.slug, [code])}>Tilbage til {report.part.title}</KundeBack>
      <KundeReportBody report={report} jobName={site.job.name} slug={site.job.slug} />
    </KundeShell>
  );
}

function KundeReportBody({ report, jobName, slug, print }: { report: KundeReportView; jobName: string; slug: string; print?: boolean }) {
  const kind = report.kind ?? "ks";
  if (kind === "tf" || kind === "er") {
    const rows: [string, string][] = [
      ["Byggesag", jobName],
      ["Dato", dmy(report.createdAt)],
      ["Lokation", report.location],
    ].filter(([, v]) => v.trim()) as [string, string][];
    return (
      <article>
        <p className="text-[0.7rem] font-medium tracking-[0.22em] text-kunde-muted">
          {kind === "tf" ? "TEKNISK FORESPØRGSEL" : "ENTREPRENØRRAPPORT"} <span className="text-kunde-line">|</span> {report.number}
        </p>
        <h1 className="mt-3 text-[clamp(2rem,5vw,3.2rem)] leading-tight font-light">{report.task}</h1>
        <KundeMetaGrid rows={rows} />
        {report.body ? (
          <section className="mt-12">
            <p className="text-[0.68rem] tracking-[0.18em] text-kunde-muted uppercase">{kind === "tf" ? "Spørgsmål" : "Beskrivelse"}</p>
            <p className="mt-2 max-w-prose whitespace-pre-wrap text-[1.05rem] leading-relaxed">{report.body}</p>
          </section>
        ) : null}
        {report.deviations && report.deviations !== "Ingen" ? (
          <section className="mt-12">
            <p className="text-[0.68rem] tracking-[0.18em] text-kunde-muted uppercase">{kind === "tf" ? "Svar" : "Note"}</p>
            <p className="mt-2 max-w-prose whitespace-pre-wrap text-[1.05rem] leading-relaxed">{report.deviations}</p>
          </section>
        ) : null}
        {report.photos.length ? <KundePhotos photos={report.photos} /> : null}
        {print ? null : (
          <footer className="mt-16 border-t border-kunde-line pt-6 text-sm text-kunde-muted">
            <p>{jobName}</p>
            <button type="button" className="mt-3 text-kunde-accent" onClick={() => window.print()}>
              Gem som PDF
            </button>
          </footer>
        )}
      </article>
    );
  }
  const rows: [string, string][] = [
    ["Byggesag", jobName],
    ["Dato", dmy(report.createdAt)],
    ["Lokation", report.location],
    ["Kontrol udført af", "Zenko Danmark · CVR 42285757"],
    ["Kontrolomfang", report.qcScope],
    ["Metode", report.qcMethod],
    ["Godkendelseskriterie", report.criteria],
  ].filter(([, v]) => v.trim()) as [string, string][];

  return (
    <article>
      <p className="text-[0.7rem] font-medium tracking-[0.22em] text-kunde-muted">
        PROCESKONTROL <span className="text-kunde-line">|</span> RAPPORT {report.pad}
      </p>
      <h1 className="mt-3 text-[clamp(2rem,5vw,3.2rem)] leading-tight font-light">{report.part.title}</h1>
      <p className="mt-3 text-sm font-medium tracking-[0.12em] text-kunde-accent">
        {report.part.code}
        {report.part.controlPoint && report.part.controlPoint !== report.part.code ? ` · ${report.part.controlPoint}` : ""}
      </p>
      <KundeMetaGrid rows={rows} />
      <section className="mt-12">
        <p className="text-[0.68rem] tracking-[0.18em] text-kunde-muted uppercase">Afvigelser</p>
        <p className="mt-2 max-w-prose text-[1.05rem] leading-relaxed">{report.deviations}</p>
      </section>
      {report.photos.length ? <KundePhotos photos={report.photos} /> : null}
      {print ? null : (
        <footer className="mt-16 border-t border-kunde-line pt-6 text-sm text-kunde-muted">
          <p>{jobName}</p>
          <button type="button" className="mt-3 text-kunde-accent" onClick={() => window.print()}>
            Gem denne rapport som PDF
          </button>
        </footer>
      )}
    </article>
  );
}

function KundePhotos({ photos }: { photos: KundeReportView["photos"] }) {
  const [open, setOpen] = useState<number | null>(null);
  useEffect(() => {
    if (open == null) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(null);
      if (e.key === "ArrowRight") setOpen((i) => (i == null ? i : (i + 1) % photos.length));
      if (e.key === "ArrowLeft") setOpen((i) => (i == null ? i : (i - 1 + photos.length) % photos.length));
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, photos.length]);

  let startX = 0;
  return (
    <section className="mt-12">
      <p className="mb-4 text-[0.68rem] tracking-[0.18em] text-kunde-muted uppercase">Foto</p>
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
        {photos.map((p, i) => (
          <button key={p.id} type="button" className="ks-photo text-left" onClick={() => setOpen(i)}>
            <img src={p.src} alt="" referrerPolicy="no-referrer" className="aspect-[4/3] w-full object-cover" />
            <span className="mt-2 block text-xs tracking-[0.18em] text-kunde-accent">{p.n}</span>
          </button>
        ))}
      </div>
      {open != null ? (
        <button
          type="button"
          className="kunde-no-print fixed inset-0 z-[70] flex items-center justify-center bg-kunde-ink/90 p-4"
          onClick={() => setOpen(null)}
          onTouchStart={(e) => {
            startX = e.changedTouches[0]?.clientX ?? 0;
          }}
          onTouchEnd={(e) => {
            const x = e.changedTouches[0]?.clientX ?? 0;
            const dx = x - startX;
            if (dx > 40) setOpen((i) => (i == null ? i : (i - 1 + photos.length) % photos.length));
            if (dx < -40) setOpen((i) => (i == null ? i : (i + 1) % photos.length));
          }}
        >
          <img src={photos[open].src} alt="" referrerPolicy="no-referrer" className="max-h-[90vh] max-w-full object-contain" />
          <span className="absolute bottom-6 text-xs tracking-[0.2em] text-kunde-bg">{photos[open].n}</span>
        </button>
      ) : null}
    </section>
  );
}

export function KundeKomplet({ site }: { site: KundeSite | null }) {
  useEffect(() => {
    if (!site) return;
    const prev = document.title;
    document.title = pdfFilename(site.job);
    return () => {
      document.title = prev;
    };
  }, [site]);

  if (!site) return <KundeMissing />;
  const { job, parts, reports } = site;
  const rows = kundeJobFields(job);

  return (
    <main className="kunde-a">
      <div className="kunde-brick-top kunde-no-print">
        <img src="/kunde/mursten.jpg" alt="" className="h-[110px] w-full object-cover lg:h-16" />
      </div>
      <div className="mx-auto max-w-[42rem] px-6 py-12 sm:px-10">
        <div className="kunde-no-print mb-10 flex flex-wrap items-center gap-6 text-sm">
          <BackArrow href={kundePath(job.slug)} label={`Tilbage til ${job.name}`} />
          <button type="button" className="text-kunde-accent" onClick={() => window.print()}>
            Gem som PDF
          </button>
        </div>

        <section className="ks-forside">
          <p className="text-[0.7rem] font-medium tracking-[0.28em]">ZENKO DANMARK</p>
          <h1 className="mt-8 text-[clamp(2.4rem,7vw,4.2rem)] leading-[1.05] font-light">{job.name}</h1>
          <KundeMetaGrid rows={rows} />
          <p className="mt-8 text-sm text-kunde-muted">KS-aflevering · {dmy(new Date().toISOString())}</p>
        </section>

        <section className="ks-haandbog mt-16">
          <h2 className="text-3xl font-light">Kvalitetssikringshåndbog</h2>
          <div className="mt-10 space-y-10">
            <HandbookBlock n={HANDBOOK.purpose.n} title={HANDBOOK.purpose.title}>
              <p>{HANDBOOK.purpose.body}</p>
            </HandbookBlock>
            <HandbookBlock n={HANDBOOK.duty.n} title={HANDBOOK.duty.title}>
              <p>{HANDBOOK.duty.body}</p>
            </HandbookBlock>
            <HandbookBlock n={HANDBOOK.control.n} title={HANDBOOK.control.title}>
              <ul className="space-y-3">
                {HANDBOOK.control.items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </HandbookBlock>
            <HandbookBlock n={HANDBOOK.docs.n} title={HANDBOOK.docs.title}>
              <p>{HANDBOOK.docs.body}</p>
            </HandbookBlock>
          </div>
        </section>

        {parts.map((part) => (
          <section key={part.code} className="ks-punkt">
            <div className="mt-16 border-t border-kunde-line pt-10">
              {part.code === "ovrige" ? null : <p className="text-sm font-medium tracking-[0.18em] text-kunde-accent">{part.code}</p>}
              <h2 className={`${part.code === "ovrige" ? "" : "mt-3"} text-3xl font-light`}>{part.title}</h2>
            </div>
            {reports
              .filter((r) => r.part.code === part.code)
              .map((r) => (
                <article key={r.id} className="ks-rapport mt-12">
                  <KundeReportBody report={r} jobName={job.name} slug={job.slug} print />
                </article>
              ))}
          </section>
        ))}

        <footer className="mt-20 border-t border-kunde-line pt-8 text-sm text-kunde-muted">
          <p>{job.firm}</p>
          <p>{job.firmLine}</p>
          <p>CVR {job.cvr} · {job.phone}</p>
          <p className="mt-4">KS-aflevering genereret {dmy(new Date().toISOString())}</p>
        </footer>
      </div>
    </main>
  );
}
