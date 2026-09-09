import { useEffect, useMemo, useState, type ReactNode } from "react";
import { addSagTfReply } from "@/lib/sag-ledelse.functions";
import {
  asPdfFilename,
  filterAs,
  filterEr,
  filterTfs,
  paginate,
  sagJobFields,
  sagPath,
  sumAsPrices,
  tfCounts,
  type SagAsView,
  type SagErView,
  type SagSite,
  type SagTfView,
} from "@/lib/sag-ledelse";
import { BackArrow } from "@/components/sag-icons";
import { SagBack, SagMetaGrid, SagMissing, SagPhotos, SagRow, SagShell } from "@/components/sag-shell";
import { useYard } from "@/lib/store";
import { t } from "@/lib/i18n";
import { projectIdFromSlug } from "@/lib/ks-customer";

function dmy(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso.slice(0, 10);
  return d.toLocaleDateString("da-DK", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export function SagHome({ site }: { site: SagSite | null }) {
  if (!site) return <SagMissing />;
  const { job, tfs, slips, tbs, ents } = site;
  const tf = tfCounts(tfs);
  const asSum = sumAsPrices(slips);
  const tbSum = sumAsPrices(tbs);
  const tfLine =
    tf.total === 0
      ? "Ingen endnu"
      : `${tf.open} ${tf.open === 1 ? "åben" : "åbne"} · ${tf.answered} besvaret`;
  const asLine =
    slips.length === 0
      ? "Ingen endnu"
      : `${slips.length} ${slips.length === 1 ? "seddel" : "sedler"}${asSum.sum ? ` · ${asSum.label} ekskl. moms` : ""}`;
  const tbLine =
    tbs.length === 0
      ? "Ingen endnu"
      : `${tbs.length} ${tbs.length === 1 ? "tilbud" : "tilbud"}${tbSum.sum ? ` · ${tbSum.label} ekskl. moms` : ""}`;
  const erLine =
    ents.length === 0 ? "Ingen endnu" : `${ents.length} ${ents.length === 1 ? "rapport" : "rapporter"}`;

  return (
    <SagShell job={job} hero>
      <UdforselBack slug={job.slug} />
      <SagMetaGrid rows={sagJobFields(job)} />
      <nav className="mt-16">
        <SagRow n="01" href={sagPath(job.slug, ["tf"])}>
          Tekniske forespørgsler
          <span className="mt-1 block text-sm tracking-wide text-kunde-muted">{tfLine}</span>
        </SagRow>
        <SagRow n="02" href={sagPath(job.slug, ["as"])}>
          Aftalesedler
          <span className="mt-1 block text-sm tracking-wide text-kunde-muted">{asLine}</span>
        </SagRow>
        <SagRow n="03" href={sagPath(job.slug, ["tb"])}>
          Tilbud
          <span className="mt-1 block text-sm tracking-wide text-kunde-muted">{tbLine}</span>
        </SagRow>
        <SagRow n="04" href={sagPath(job.slug, ["er"])}>
          Entreprenørrapporter
          <span className="mt-1 block text-sm tracking-wide text-kunde-muted">{erLine}</span>
        </SagRow>
      </nav>
      <footer className="mt-20 border-t border-kunde-line pt-6 text-sm text-kunde-muted">
        <p>
          {job.name} · Byggeledelse
        </p>
        <p className="mt-1">
          {job.firm} · CVR {job.cvr}
        </p>
      </footer>
    </SagShell>
  );
}

function UdforselBack({ slug }: { slug: string }) {
  const projects = useYard((s) => s.projects);
  const emp = useYard((s) => s.employees.find((e) => e.id === s.employeeId));
  const lang = emp?.language ?? "da";
  const jobId = projectIdFromSlug(slug, projects) || "";
  const href = jobId ? `/mester?open=sager&job=${encodeURIComponent(jobId)}` : "/mester?open=sager";
  return (
    <a href={href} className="kunde-no-print mb-6 mt-2 inline-block text-base font-bold text-kunde-ink no-underline" data-testid="udfoersel-back">
      {t(lang, "back")}
    </a>
  );
}

function FilterField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex min-w-0 flex-1 flex-col gap-1">
      <span className="text-[0.68rem] tracking-[0.18em] text-kunde-muted uppercase">{label}</span>
      {children}
    </label>
  );
}

const filterInput =
  "w-full border-0 border-b border-kunde-line bg-transparent py-2 text-base text-kunde-ink outline-none";

function Pager({ page, pages, onPage }: { page: number; pages: number; onPage: (n: number) => void }) {
  if (pages <= 1) return null;
  return (
    <div className="mt-10 flex items-center justify-between gap-4 text-sm text-kunde-muted">
      <button type="button" className="text-kunde-accent disabled:text-kunde-muted" disabled={page <= 1} onClick={() => onPage(page - 1)}>
        Forrige
      </button>
      <span>
        Side {page} af {pages}
      </span>
      <button type="button" className="text-kunde-accent disabled:text-kunde-muted" disabled={page >= pages} onClick={() => onPage(page + 1)}>
        Næste
      </button>
    </div>
  );
}

export function SagTfList({ site }: { site: SagSite | null }) {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<"all" | "open" | "answered">("all");
  const [day, setDay] = useState("");
  const [page, setPage] = useState(1);
  if (!site) return <SagMissing />;
  const filtered = filterTfs(site.tfs, { q, status, day });
  const paged = paginate(filtered, page);
  const usePage = Math.min(page, paged.pages);

  return (
    <SagShell job={site.job}>
      <SagBack to={sagPath(site.job.slug)}>Tilbage til {site.job.name}</SagBack>
      <p className="text-sm font-medium tracking-[0.18em] text-kunde-accent">01</p>
      <h1 className="mt-3 text-[clamp(2rem,5vw,3.2rem)] leading-tight font-light">Tekniske forespørgsler</h1>
      <p className="mt-4 text-sm text-kunde-muted">{filtered.length} {filtered.length === 1 ? "forespørgsel" : "forespørgsler"}.</p>
      <div className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-3">
        <FilterField label="Søg">
          <input className={filterInput} value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} placeholder="Nr eller tekst" />
        </FilterField>
        <FilterField label="Status">
          <span className="flex flex-wrap gap-x-4 py-2 text-base">
            {([
              ["all", "Alle"],
              ["open", "Åbne"],
              ["answered", "Besvaret"],
            ] as const).map(([id, label]) => (
              <button
                key={id}
                type="button"
                className={status === id ? "text-kunde-accent" : "text-kunde-muted"}
                onClick={() => { setStatus(id); setPage(1); }}
              >
                {label}
              </button>
            ))}
          </span>
        </FilterField>
        <FilterField label="Dato">
          <input type="date" className={filterInput} value={day} onChange={(e) => { setDay(e.target.value); setPage(1); }} />
        </FilterField>
      </div>
      <nav className="mt-12">
        {paged.slice.length ? (
          paged.slice.map((tf) => (
            <SagRow key={tf.id} href={sagPath(site.job.slug, ["tf", tf.slug])}>
              <span className="text-kunde-accent">TF {tf.number}</span>
              <span className="mt-1 block text-sm tracking-wide text-kunde-muted">
                {tf.answered || tf.replies.length ? "BESVARET" : "ÅBEN"} · {dmy(tf.createdAt)}
              </span>
            </SagRow>
          ))
        ) : (
          <p className="border-t border-kunde-line py-5 text-sm text-kunde-muted">Ingen tekniske forespørgsler matcher.</p>
        )}
      </nav>
      <Pager page={usePage} pages={paged.pages} onPage={setPage} />
    </SagShell>
  );
}

export function SagAsList({ site }: { site: SagSite | null }) {
  return <SagSeddelList site={site} kind="as" />;
}

export function SagTbList({ site }: { site: SagSite | null }) {
  return <SagSeddelList site={site} kind="tb" />;
}

function SagSeddelList({ site, kind }: { site: SagSite | null; kind: "as" | "tb" }) {
  const [q, setQ] = useState("");
  const [day, setDay] = useState("");
  const [minRaw, setMinRaw] = useState("");
  const [page, setPage] = useState(1);
  const [picked, setPicked] = useState<string[]>([]);
  if (!site) return <SagMissing />;
  const rows = kind === "tb" ? site.tbs : site.slips;
  const minPrice = minRaw.trim() ? Number(minRaw.replace(/\./g, "").replace(",", ".")) : null;
  const min = minPrice != null && Number.isFinite(minPrice) ? minPrice : null;
  const filtered = filterAs(rows, { q, day, minPrice: min });
  const paged = paginate(filtered, page);
  const selected = rows.filter((s) => picked.includes(s.id));
  const pathSeg = kind === "tb" ? "tb" : "as";
  const samlingHref =
    selected.length >= 1 ? `${sagPath(site.job.slug, ["samling"])}?n=${selected.map((s) => s.slug).join(",")}` : "";

  function toggle(id: string) {
    setPicked((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));
  }

  function toggleAll() {
    const ids = filtered.map((s) => s.id);
    const allOn = ids.length > 0 && ids.every((id) => picked.includes(id));
    setPicked(allOn ? picked.filter((id) => !ids.includes(id)) : [...new Set([...picked, ...ids])]);
  }

  return (
    <SagShell job={site.job}>
      <SagBack to={sagPath(site.job.slug)}>Tilbage til {site.job.name}</SagBack>
      <p className="text-sm font-medium tracking-[0.18em] text-kunde-accent">{kind === "tb" ? "03" : "02"}</p>
      <h1 className="mt-3 text-[clamp(2rem,5vw,3.2rem)] leading-tight font-light">{kind === "tb" ? "Tilbud" : "Aftalesedler"}</h1>
      <p className="mt-4 text-sm text-kunde-muted">
        {filtered.length} {kind === "tb" ? (filtered.length === 1 ? "tilbud" : "tilbud") : filtered.length === 1 ? "seddel" : "sedler"}
        {sumAsPrices(filtered).sum ? ` · ${sumAsPrices(filtered).label} ekskl. moms` : ""}.
      </p>
      <div className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-3">
        <FilterField label="Søg">
          <input className={filterInput} value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} placeholder="Nr eller tekst" />
        </FilterField>
        <FilterField label="Dato">
          <input type="date" className={filterInput} value={day} onChange={(e) => { setDay(e.target.value); setPage(1); }} />
        </FilterField>
        <FilterField label="Beløb fra">
          <input className={filterInput} inputMode="numeric" value={minRaw} onChange={(e) => { setMinRaw(e.target.value); setPage(1); }} placeholder="0" />
        </FilterField>
      </div>
      <div className="mt-8 flex flex-wrap items-baseline gap-x-6 gap-y-2 text-sm">
        <button type="button" className="text-kunde-accent" onClick={toggleAll}>
          {filtered.length && filtered.every((s) => picked.includes(s.id)) ? "Fjern hak" : "Hak alle"}
        </button>
        <p className="text-kunde-muted">
          {picked.length} valgt
          {picked.length ? ` · ${sumAsPrices(selected).label} ekskl. moms` : ""}
        </p>
        {samlingHref ? (
          <a href={samlingHref} className="text-kunde-accent no-underline">
            Lav PDF-rapport
          </a>
        ) : (
          <span className="text-kunde-muted">Hak mindst én til PDF</span>
        )}
      </div>
      <nav className="mt-8">
        {paged.slice.length ? (
          paged.slice.map((as) => (
            <div key={as.id} className="flex items-start gap-3 border-t border-kunde-line py-5">
              <label className="mt-1 flex min-h-11 min-w-11 cursor-pointer items-center justify-center">
                <input
                  type="checkbox"
                  checked={picked.includes(as.id)}
                  onChange={() => toggle(as.id)}
                  className="size-4 accent-[#B2472D]"
                  aria-label={`Hak ${as.number} til PDF`}
                />
              </label>
              <a href={sagPath(site.job.slug, [pathSeg, as.slug])} className="min-w-0 flex-1 no-underline">
                <span className="block text-[1.2rem] font-light text-kunde-ink sm:text-[1.45rem]">
                  <span className="text-kunde-accent">{as.number}</span>
                </span>
                <span className="mt-1 block text-sm text-kunde-muted">
                  {dmy(as.createdAt)} · {as.priceLabel} ekskl. moms
                </span>
              </a>
            </div>
          ))
        ) : (
          <p className="border-t border-kunde-line py-5 text-sm text-kunde-muted">{kind === "tb" ? "Ingen tilbud matcher." : "Ingen aftalesedler matcher."}</p>
        )}
      </nav>
      <Pager page={Math.min(page, paged.pages)} pages={paged.pages} onPage={setPage} />
    </SagShell>
  );
}

export function SagErList({ site }: { site: SagSite | null }) {
  const [q, setQ] = useState("");
  const [day, setDay] = useState("");
  const [page, setPage] = useState(1);
  if (!site) return <SagMissing />;
  const filtered = filterEr(site.ents, { q, day });
  const paged = paginate(filtered, page);

  return (
    <SagShell job={site.job}>
      <SagBack to={sagPath(site.job.slug)}>Tilbage til {site.job.name}</SagBack>
      <p className="text-sm font-medium tracking-[0.18em] text-kunde-accent">04</p>
      <h1 className="mt-3 text-[clamp(2rem,5vw,3.2rem)] leading-tight font-light">Entreprenørrapporter</h1>
      <p className="mt-4 text-sm text-kunde-muted">{filtered.length} {filtered.length === 1 ? "rapport" : "rapporter"}.</p>
      <div className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-2">
        <FilterField label="Søg">
          <input className={filterInput} value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} placeholder="Nr eller tekst" />
        </FilterField>
        <FilterField label="Dato">
          <input type="date" className={filterInput} value={day} onChange={(e) => { setDay(e.target.value); setPage(1); }} />
        </FilterField>
      </div>
      <nav className="mt-12">
        {paged.slice.length ? (
          paged.slice.map((er) => (
            <SagRow key={er.id} href={sagPath(site.job.slug, ["er", er.slug])}>
              <span className="text-kunde-accent">{er.number}</span>
              <span className="mt-1 block text-sm tracking-wide text-kunde-muted">{dmy(er.createdAt)}</span>
            </SagRow>
          ))
        ) : (
          <p className="border-t border-kunde-line py-5 text-sm text-kunde-muted">Ingen entreprenørrapporter matcher.</p>
        )}
      </nav>
      <Pager page={Math.min(page, paged.pages)} pages={paged.pages} onPage={setPage} />
    </SagShell>
  );
}

export function SagTfPage({ site, number }: { site: SagSite | null; number: string }) {
  const tf = site?.tfs.find((r) => r.slug === number || r.number === number);
  if (!site || !tf) return <SagMissing />;
  return (
    <SagShell job={site.job}>
      <SagBack to={sagPath(site.job.slug, ["tf"])}>Tilbage til tekniske forespørgsler</SagBack>
      <SagTfBody tf={tf} job={site.job} />
    </SagShell>
  );
}

function SagTfBody({ tf, job }: { tf: SagTfView; job: SagSite["job"] }) {
  const [draft, setDraft] = useState("");
  const [replies, setReplies] = useState(tf.replies);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function send() {
    const text = draft.trim();
    if (!text || busy) return;
    setBusy(true);
    setError("");
    try {
      const res = await addSagTfReply({ data: { slug: job.slug, projectId: job.projectId, tfId: tf.id, text } });
      if (res.ok) {
        setReplies(res.replies);
        useYard.getState().patchReport("tf", tf.id, {
          answered: true,
          answer: text,
          answeredAt: new Date().toISOString(),
          ledelseReplies: res.replies,
        });
        setDraft("");
        return;
      }
      useYard.getState().answerTf(tf.id, text);
      setReplies((cur) => [...cur, { id: `rpl-${Date.now().toString(36)}`, text, at: new Date().toISOString() }]);
      setDraft("");
    } catch {
      useYard.getState().answerTf(tf.id, text);
      setReplies((cur) => [...cur, { id: `rpl-${Date.now().toString(36)}`, text, at: new Date().toISOString() }]);
      setDraft("");
    } finally {
      setBusy(false);
    }
  }

  const rows: [string, string][] = [
    ["Til", tf.customer],
    ["Dato", dmy(tf.createdAt)],
    ["Byggesag", tf.projectName],
    ["Sag / adresse", tf.address],
    ["Status", replies.length ? "BESVARET" : "ÅBEN"],
  ].filter(([, v]) => v.trim()) as [string, string][];

  return (
    <article>
      <p className="text-[0.7rem] font-medium tracking-[0.22em] text-kunde-muted">
        TEKNISK FORESPØRGSEL <span className="text-kunde-line">|</span> {tf.number}
      </p>
      <h1 className="mt-3 text-[clamp(2rem,5vw,3.2rem)] leading-tight font-light">{tf.title}</h1>
      <SagMetaGrid rows={rows} />
      <section className="mt-12">
        <p className="text-[0.68rem] tracking-[0.18em] text-kunde-muted uppercase">Forespørgsel</p>
        <p className="mt-3 max-w-prose whitespace-pre-wrap text-[1.05rem] leading-[1.65]">{tf.body}</p>
      </section>
      <SagPhotos photos={tf.photos} />
      <section className="mt-12">
        <p className="text-[0.68rem] tracking-[0.18em] text-kunde-muted uppercase">Svar fra byggeledelse</p>
        {replies.map((r) => (
          <div key={r.id} className="mt-4 max-w-prose border-t border-kunde-line pt-4">
            <p className="text-xs tracking-wide text-kunde-muted">{dmy(r.at)}</p>
            <p className="mt-2 whitespace-pre-wrap text-[1.05rem] leading-relaxed">{r.text}</p>
          </div>
        ))}
        <textarea
          className="kunde-no-print mt-6 min-h-32 w-full border border-kunde-line bg-transparent p-3 text-base text-kunde-ink"
          placeholder="Skriv svar…"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
        />
        {error ? <p className="mt-2 text-sm text-kunde-accent">{error}</p> : null}
        <button
          type="button"
          className="kunde-no-print mt-3 bg-transparent p-0 text-sm tracking-wide text-kunde-accent disabled:text-kunde-muted"
          disabled={!draft.trim() || busy}
          onClick={() => void send()}
        >
          {busy ? "Sender…" : "Send svar"}
        </button>
      </section>
    </article>
  );
}

export function SagAsPage({ site, number }: { site: SagSite | null; number: string }) {
  const as = site?.slips.find((r) => r.slug === number || r.number === number || r.number === `AS-${number}`);
  if (!site || !as) return <SagMissing />;
  return (
    <SagShell job={site.job}>
      <SagBack to={sagPath(site.job.slug, ["as"])}>Tilbage til aftalesedler</SagBack>
      <SagAsBody as={as} print={false} />
    </SagShell>
  );
}

export function SagTbPage({ site, number }: { site: SagSite | null; number: string }) {
  const row = site?.tbs.find((r) => r.slug === number || r.number === number || r.number === `TB-${number}`);
  if (!site || !row) return <SagMissing />;
  return (
    <SagShell job={site.job}>
      <SagBack to={sagPath(site.job.slug, ["tb"])}>Tilbage til tilbud</SagBack>
      <SagAsBody as={row} print={false} kind="tb" />
    </SagShell>
  );
}

export function SagAsBody({ as, print, kind = "as" }: { as: SagAsView; print?: boolean; kind?: "as" | "tb" }) {
  const rows: [string, string][] = [
    ["Til", as.customer],
    ["Dato", dmy(as.createdAt)],
    ["Byggesag", as.projectName],
    ["Lokation", as.location],
  ].filter(([, v]) => v.trim()) as [string, string][];

  return (
    <article>
      <p className="text-[0.7rem] font-medium tracking-[0.22em] text-kunde-muted">
        {kind === "tb" ? "TILBUD" : "AFTALESEDEL"} <span className="text-kunde-line">|</span> {as.number}
      </p>
      <h1 className="mt-3 text-[clamp(2rem,5vw,3.2rem)] leading-tight font-light">{as.title}</h1>
      <SagMetaGrid rows={rows} />
      {as.description ? (
        <section className="mt-12">
          <p className="text-[0.68rem] tracking-[0.18em] text-kunde-muted uppercase">Beskrivelse</p>
          <p className="mt-3 max-w-prose whitespace-pre-wrap text-[1.05rem] leading-[1.65]">{as.description}</p>
        </section>
      ) : as.body ? (
        <section className="mt-12">
          <p className="text-[0.68rem] tracking-[0.18em] text-kunde-muted uppercase">Beskrivelse</p>
          <p className="mt-3 max-w-prose whitespace-pre-wrap text-[1.05rem] leading-[1.65]">{as.body}</p>
        </section>
      ) : null}
      {as.materials.length ? (
        <section className="mt-12">
          <p className="text-[0.68rem] tracking-[0.18em] text-kunde-muted uppercase">Materialer</p>
          <ul className="mt-3 max-w-prose space-y-2 text-[1.05rem] leading-relaxed">
            {as.materials.map((m, i) => (
              <li key={i} className="flex justify-between gap-4">
                <span>{m.text.replace(/\s+\d{1,3}(?:\.\d{3})+\s*,-\s*$/, "").trim() || m.text}</span>
                <span className="shrink-0 tabular-nums text-kunde-muted">{m.amount != null ? `${m.amount.toLocaleString("da-DK")},-` : ""}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      {as.note ? (
        <section className="mt-12">
          <p className="text-[0.68rem] tracking-[0.18em] text-kunde-muted uppercase">Kunde bemærkning</p>
          <p className="mt-3 max-w-prose whitespace-pre-wrap text-[1.05rem] leading-relaxed">{as.note}</p>
        </section>
      ) : null}
      <section className="mt-12">
        <p className="text-[0.68rem] tracking-[0.18em] text-kunde-muted uppercase">Pris ekskl. moms</p>
        <p className="mt-2 text-2xl font-light">{as.priceLabel}</p>
      </section>
      <SagPhotos photos={as.photos} />
      {print ? null : (
        <footer className="kunde-no-print mt-16 border-t border-kunde-line pt-6 text-sm text-kunde-muted">
          <button type="button" className="text-kunde-accent" onClick={() => window.print()}>
            Gem som PDF
          </button>
        </footer>
      )}
    </article>
  );
}

export function SagErPage({ site, number }: { site: SagSite | null; number: string }) {
  const er = site?.ents.find((r) => r.slug === number || r.number === number || r.number === `ER-${number}`);
  if (!site || !er) return <SagMissing />;
  return (
    <SagShell job={site.job}>
      <SagBack to={sagPath(site.job.slug, ["er"])}>Tilbage til entreprenørrapporter</SagBack>
      <SagErBody er={er} />
    </SagShell>
  );
}

function SagErBody({ er }: { er: SagErView }) {
  const rows: [string, string][] = [
    ["Til", er.customer],
    ["Dato", dmy(er.createdAt)],
    ["Byggesag", er.projectName],
    ["Lokation", er.location],
  ].filter(([, v]) => v.trim()) as [string, string][];
  return (
    <article>
      <p className="text-[0.7rem] font-medium tracking-[0.22em] text-kunde-muted">
        ENTREPRENØRRAPPORT <span className="text-kunde-line">|</span> {er.number}
      </p>
      <h1 className="mt-3 text-[clamp(2rem,5vw,3.2rem)] leading-tight font-light">{er.title}</h1>
      <SagMetaGrid rows={rows} />
      <section className="mt-12">
        <p className="text-[0.68rem] tracking-[0.18em] text-kunde-muted uppercase">Beskrivelse</p>
        <p className="mt-3 max-w-prose whitespace-pre-wrap text-[1.05rem] leading-[1.65]">{er.body}</p>
      </section>
      {er.note ? (
        <section className="mt-12">
          <p className="text-[0.68rem] tracking-[0.18em] text-kunde-muted uppercase">Kunde bemærkning</p>
          <p className="mt-3 max-w-prose whitespace-pre-wrap text-[1.05rem] leading-relaxed">{er.note}</p>
        </section>
      ) : null}
      <SagPhotos photos={er.photos} />
      <footer className="kunde-no-print mt-16 border-t border-kunde-line pt-6 text-sm text-kunde-muted">
        <button type="button" className="text-kunde-accent" onClick={() => window.print()}>
          Gem som PDF
        </button>
      </footer>
    </article>
  );
}

export function SagSamling({ site, numbers }: { site: SagSite | null; numbers: string[] }) {
  const rows = useMemo(() => {
    if (!site) return [];
    const want = new Set(numbers.map((n) => n.replace(/^AS-/i, "")));
    return site.slips.filter((s) => want.has(s.slug) || want.has(s.number) || want.has(s.number.replace(/^AS-/i, "")));
  }, [site, numbers]);

  useEffect(() => {
    if (!site || !rows.length) return;
    const prev = document.title;
    document.title = asPdfFilename(site.job);
    return () => {
      document.title = prev;
    };
  }, [site, rows.length]);

  if (!site) return <SagMissing />;
  if (!rows.length) return <SagMissing />;
  const job = site.job;
  const tot = sumAsPrices(rows);
  const pages = 1 + rows.length;
  const day = dmy(new Date().toISOString());

  return (
    <main className="kunde-a">
      <div className="kunde-brick-top">
        <img src="/kunde/mursten.jpg" alt="" className="h-[110px] w-full object-cover lg:h-16" />
      </div>
      <div className="mx-auto max-w-[42rem] px-6 py-12 sm:px-10">
        <div className="kunde-no-print mb-10 flex flex-wrap items-center gap-6 text-sm">
          <BackArrow href={sagPath(job.slug, ["as"])} label="Tilbage til aftalesedler" />
          <button type="button" className="text-kunde-accent" onClick={() => window.print()}>
            Gem som PDF
          </button>
        </div>

        <section>
          <p className="text-[0.7rem] font-medium tracking-[0.28em]">ZENKO DANMARK</p>
          <p className="mt-6 text-[0.7rem] font-medium tracking-[0.28em] text-kunde-accent">AFTALESEDLER · SAMLING</p>
          <h1 className="mt-4 text-[clamp(2.4rem,7vw,4.2rem)] leading-[1.05] font-light">{job.name}</h1>
          <SagMetaGrid
            rows={
              [
                ["Til", job.client],
                ["Antal", String(rows.length)],
                ["Dato", day],
              ].filter(([, v]) => v.trim()) as [string, string][]
            }
          />
          <table className="mt-12 w-full text-left text-sm">
            <thead>
              <tr className="border-b border-kunde-line text-[0.68rem] tracking-[0.18em] text-kunde-muted uppercase">
                <th className="py-2 font-medium">Nr</th>
                <th className="py-2 font-medium">Titel</th>
                <th className="py-2 font-medium">Dato</th>
                <th className="py-2 text-right font-medium">Beløb ekskl. moms</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-kunde-line">
                  <td className="py-3">{r.number}</td>
                  <td className="py-3">{r.title}</td>
                  <td className="py-3">{dmy(r.createdAt)}</td>
                  <td className="py-3 text-right tabular-nums">{r.priceLabel}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-8 text-xl font-light">I alt ekskl. moms {tot.label}</p>
          <p className="mt-10 text-sm text-kunde-muted">
            Side 1 af {pages} · CVR {job.cvr} · {job.firmLine}
            {tot.missing ? ` · ${tot.missing} seddel${tot.missing === 1 ? "" : "er"} uden beløb er ikke talt med` : ""}
          </p>
        </section>

        {rows.map((r, i) => (
          <section key={r.id} className="kunde-break mt-16 border-t border-kunde-line pt-10">
            <SagAsBody as={r} print />
            <p className="mt-10 text-sm text-kunde-muted">
              Side {i + 2} af {pages} · CVR {job.cvr} · {job.firmLine}
            </p>
          </section>
        ))}
      </div>
    </main>
  );
}
