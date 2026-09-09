import { useEffect, useMemo, useState, type ReactNode } from "react";
import { addSagTfReply } from "@/lib/sag-ledelse.functions";
import {
  asPdfFilename,
  filterAs,
  filterEr,
  filterKs,
  filterTfs,
  paginate,
  sagJobFields,
  sagPath,
  sumAsPrices,
  tfCounts,
  type SagAsView,
  type SagErView,
  type SagKsView,
  type SagSite,
  type SagTfView,
} from "@/lib/sag-ledelse";
import { BackArrow, SagPng, TabPng } from "@/components/sag-icons";
import { SagBack, SagMetaGrid, SagMissing, SagPhotos, SagShell, SagTypeBtn } from "@/components/sag-shell";
import { PrimaryButton } from "@/components/zenko";
import { useYard } from "@/lib/store";
import { t } from "@/lib/i18n";
import { projectIdFromSlug } from "@/lib/ks-customer";
import { todoPeopleLine } from "@/lib/todo-people";
import type { LedelseReply } from "@/lib/types";

function dmy(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso.slice(0, 10);
  return d.toLocaleDateString("da-DK", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export function SagHome({ site }: { site: SagSite | null }) {
  if (!site) return <SagMissing />;
  const { job, tfs, slips, tbs, ents, kss } = site;
  const tf = tfCounts(tfs);
  const asSum = sumAsPrices(slips);
  const tbSum = sumAsPrices(tbs);
  const tfLine =
    tf.total === 0 ? "Ingen endnu" : `${tf.open} ${tf.open === 1 ? "åben" : "åbne"} · ${tf.answered} besvaret`;
  const asLine =
    slips.length === 0
      ? "Ingen endnu"
      : `${slips.length} ${slips.length === 1 ? "seddel" : "sedler"}${asSum.sum ? ` · ${asSum.label}` : ""}`;
  const tbLine =
    tbs.length === 0
      ? "Ingen endnu"
      : `${tbs.length} ${tbs.length === 1 ? "tilbud" : "tilbud"}${tbSum.sum ? ` · ${tbSum.label}` : ""}`;
  const erLine = ents.length === 0 ? "Ingen endnu" : `${ents.length} ${ents.length === 1 ? "rapport" : "rapporter"}`;
  const ksLine = kss.length === 0 ? "Ingen endnu" : `${kss.length} ${kss.length === 1 ? "rapport" : "rapporter"}`;

  return (
    <SagShell job={job} hero>
      <UdforselBack slug={job.slug} />
      <SagMetaGrid rows={sagJobFields(job)} />
      <nav className="space-y-3" data-testid="ledelse-types">
        <SagTypeBtn href={sagPath(job.slug, ["tf"])} icon="tf" title="TF" count={tfs.length} line={tfLine} testId="ledelse-btn-tf" />
        <SagTypeBtn href={sagPath(job.slug, ["as"])} icon="as" title="AS" count={slips.length} line={asLine} testId="ledelse-btn-as" />
        <SagTypeBtn href={sagPath(job.slug, ["er"])} icon="er" title="ER" count={ents.length} line={erLine} testId="ledelse-btn-er" />
        <SagTypeBtn href={sagPath(job.slug, ["ks"])} icon="ks" title="KS" count={kss.length} line={ksLine} testId="ledelse-btn-ks" />
        <SagTypeBtn href={sagPath(job.slug, ["tb"])} icon="as" title="TB" count={tbs.length} line={tbLine} testId="ledelse-btn-tb" />
        <LedelseTodoBtn slug={job.slug} projectId={job.projectId} />
      </nav>
      <section className="rounded-[24px] bg-paper px-4 py-4 shadow-card" data-testid="plan-open-card">
        <div className="flex items-center gap-3">
          <TabPng name="plan" px={64} />
          <div className="min-w-0 flex-1">
            <p className="font-display text-3xl leading-none text-navy">Plan</p>
            <p className="mt-1 text-sm text-muted">Uge-gitter for sagen</p>
          </div>
          <a
            href={sagPath(job.slug, ["plan"])}
            className="inline-flex min-h-11 shrink-0 items-center rounded-full bg-navy px-4 text-sm font-semibold text-sand no-underline"
            data-testid="plan-open"
          >
            Åbn plan
          </a>
        </div>
      </section>
    </SagShell>
  );
}

function LedelseTodoBtn({ slug, projectId }: { slug: string; projectId: string }) {
  const allTodos = useYard((s) => s.todos);
  const n = allTodos.filter((td) => td.projectId === projectId && !td.done).length;
  const line = n === 0 ? "Ingen åbne" : `${n} ${n === 1 ? "åben" : "åbne"}`;
  return (
    <SagTypeBtn href={sagPath(slug, ["todo"])} icon="todo" title="To-do" count={n} line={line} testId="ledelse-btn-todo" />
  );
}

function UdforselBack({ slug }: { slug: string }) {
  const projects = useYard((s) => s.projects);
  const emp = useYard((s) => s.employees.find((e) => e.id === s.employeeId));
  const lang = emp?.language ?? "da";
  const jobId = projectIdFromSlug(slug, projects) || "";
  const href = jobId ? `/mester?open=sager&job=${encodeURIComponent(jobId)}` : "/mester?open=sager";
  return (
    <a href={href} className="mb-1 inline-flex min-h-11 items-center text-sm font-semibold text-navy no-underline" data-testid="udfoersel-back">
      {t(lang, "back")}
    </a>
  );
}

function FilterField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex min-w-0 flex-1 flex-col gap-1">
      <span className="text-xs font-semibold tracking-wide text-muted uppercase">{label}</span>
      {children}
    </label>
  );
}

const filterInput = "min-h-11 w-full rounded-xl bg-paper px-3 text-base text-ink shadow-card outline-none";

function Pager({ page, pages, onPage }: { page: number; pages: number; onPage: (n: number) => void }) {
  if (pages <= 1) return null;
  return (
    <div className="mt-4 flex items-center justify-between gap-4 text-sm text-muted">
      <button type="button" className="min-h-11 text-navy disabled:text-muted" disabled={page <= 1} onClick={() => onPage(page - 1)}>
        Forrige
      </button>
      <span>
        Side {page} af {pages}
      </span>
      <button type="button" className="min-h-11 text-navy disabled:text-muted" disabled={page >= pages} onClick={() => onPage(page + 1)}>
        Næste
      </button>
    </div>
  );
}

function ReportCard({ href, number, line }: { href: string; number: string; line: string }) {
  return (
    <a href={href} className="block rounded-[20px] bg-paper px-4 py-4 no-underline shadow-card" data-testid={`ledelse-row-${number}`}>
      <span className="block font-display text-2xl text-navy">{number}</span>
      <span className="mt-1 block text-sm text-muted">{line}</span>
    </a>
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
      <div className="flex items-center gap-2">
        <SagPng name="tf" px={64} />
        <h1 className="font-display text-3xl text-navy">TF</h1>
      </div>
      <p className="text-sm text-muted">
        {filtered.length} {filtered.length === 1 ? "forespørgsel" : "forespørgsler"}.
      </p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <FilterField label="Søg">
          <input className={filterInput} value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} placeholder="Nr eller tekst" />
        </FilterField>
        <FilterField label="Status">
          <span className="flex min-h-11 flex-wrap items-center gap-x-4 text-base">
            {([["all", "Alle"], ["open", "Åbne"], ["answered", "Besvaret"]] as const).map(([id, label]) => (
              <button key={id} type="button" className={status === id ? "font-semibold text-navy" : "text-muted"} onClick={() => { setStatus(id); setPage(1); }}>
                {label}
              </button>
            ))}
          </span>
        </FilterField>
        <FilterField label="Dato">
          <input type="date" className={filterInput} value={day} onChange={(e) => { setDay(e.target.value); setPage(1); }} />
        </FilterField>
      </div>
      <nav className="space-y-2">
        {paged.slice.length ? (
          paged.slice.map((tf) => (
            <ReportCard
              key={tf.id}
              href={sagPath(site.job.slug, ["tf", tf.slug])}
              number={tf.number}
              line={`${tf.answered || tf.replies.length ? "Besvaret" : "Åben"} · ${dmy(tf.createdAt)}`}
            />
          ))
        ) : (
          <p className="rounded-2xl bg-paper px-4 py-5 text-sm text-muted shadow-card">Ingen tekniske forespørgsler matcher.</p>
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
      <div className="flex items-center gap-2">
        <SagPng name="as" px={64} />
        <h1 className="font-display text-3xl text-navy">{kind === "tb" ? "TB" : "AS"}</h1>
      </div>
      <p className="text-sm text-muted">
        {filtered.length} {kind === "tb" ? "tilbud" : filtered.length === 1 ? "seddel" : "sedler"}
        {sumAsPrices(filtered).sum ? ` · ${sumAsPrices(filtered).label}` : ""}.
      </p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
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
      {kind === "as" ? (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
          <button type="button" className="min-h-11 font-semibold text-navy" onClick={toggleAll}>
            {filtered.length && filtered.every((s) => picked.includes(s.id)) ? "Fjern hak" : "Hak alle"}
          </button>
          <p className="text-muted">
            {picked.length} valgt
            {picked.length ? ` · ${sumAsPrices(selected).label}` : ""}
          </p>
          {samlingHref ? (
            <a href={samlingHref} className="min-h-11 font-semibold text-brick no-underline">
              PDF
            </a>
          ) : null}
        </div>
      ) : null}
      <nav className="space-y-2">
        {paged.slice.length ? (
          paged.slice.map((as) => (
            <div key={as.id} className="flex items-stretch gap-2">
              {kind === "as" ? (
                <label className="flex min-h-11 min-w-11 items-center justify-center rounded-2xl bg-paper shadow-card">
                  <input type="checkbox" checked={picked.includes(as.id)} onChange={() => toggle(as.id)} className="size-4 accent-brick" aria-label={`Hak ${as.number} til PDF`} />
                </label>
              ) : null}
              <div className="min-w-0 flex-1">
                <ReportCard href={sagPath(site.job.slug, [pathSeg, as.slug])} number={as.number} line={`${dmy(as.createdAt)} · ${as.priceLabel}`} />
              </div>
            </div>
          ))
        ) : (
          <p className="rounded-2xl bg-paper px-4 py-5 text-sm text-muted shadow-card">{kind === "tb" ? "Ingen tilbud matcher." : "Ingen aftalesedler matcher."}</p>
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
      <div className="flex items-center gap-2">
        <SagPng name="er" px={64} />
        <h1 className="font-display text-3xl text-navy">ER</h1>
      </div>
      <p className="text-sm text-muted">
        {filtered.length} {filtered.length === 1 ? "rapport" : "rapporter"}.
      </p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <FilterField label="Søg">
          <input className={filterInput} value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} placeholder="Nr eller tekst" />
        </FilterField>
        <FilterField label="Dato">
          <input type="date" className={filterInput} value={day} onChange={(e) => { setDay(e.target.value); setPage(1); }} />
        </FilterField>
      </div>
      <nav className="space-y-2">
        {paged.slice.length ? (
          paged.slice.map((er) => (
            <ReportCard key={er.id} href={sagPath(site.job.slug, ["er", er.slug])} number={er.number} line={dmy(er.createdAt)} />
          ))
        ) : (
          <p className="rounded-2xl bg-paper px-4 py-5 text-sm text-muted shadow-card">Ingen entreprenørrapporter matcher.</p>
        )}
      </nav>
      <Pager page={Math.min(page, paged.pages)} pages={paged.pages} onPage={setPage} />
    </SagShell>
  );
}

export function SagKsList({ site }: { site: SagSite | null }) {
  const [q, setQ] = useState("");
  const [day, setDay] = useState("");
  const [page, setPage] = useState(1);
  if (!site) return <SagMissing />;
  const filtered = filterKs(site.kss, { q, day });
  const paged = paginate(filtered, page);

  return (
    <SagShell job={site.job}>
      <SagBack to={sagPath(site.job.slug)}>Tilbage til {site.job.name}</SagBack>
      <div className="flex items-center gap-2">
        <SagPng name="ks" px={64} />
        <h1 className="font-display text-3xl text-navy">KS</h1>
      </div>
      <p className="text-sm text-muted">
        {filtered.length} {filtered.length === 1 ? "rapport" : "rapporter"}.
      </p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <FilterField label="Søg">
          <input className={filterInput} value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} placeholder="Nr eller tekst" />
        </FilterField>
        <FilterField label="Dato">
          <input type="date" className={filterInput} value={day} onChange={(e) => { setDay(e.target.value); setPage(1); }} />
        </FilterField>
      </div>
      <nav className="space-y-2">
        {paged.slice.length ? (
          paged.slice.map((ks) => (
            <ReportCard
              key={ks.id}
              href={sagPath(site.job.slug, ["ks", ks.slug])}
              number={`KS-${ks.number}`}
              line={`${ks.partTitle} · ${dmy(ks.createdAt)}`}
            />
          ))
        ) : (
          <p className="rounded-2xl bg-paper px-4 py-5 text-sm text-muted shadow-card">Ingen KS-rapporter matcher.</p>
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
      <SagBack to={sagPath(site.job.slug, ["tf"])}>Tilbage til TF</SagBack>
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
      const at = new Date().toISOString();
      const next = res.ok ? res.replies : [...replies, { id: `rpl-${Date.now().toString(36)}`, text, at }];
      setReplies(next);
      useYard.getState().patchReport("tf", tf.id, {
        answered: true,
        answer: text,
        answeredAt: at,
        ledelseReplies: next,
      });
      setDraft("");
    } catch {
      const at = new Date().toISOString();
      const next = [...replies, { id: `rpl-${Date.now().toString(36)}`, text, at }];
      setReplies(next);
      useYard.getState().patchReport("tf", tf.id, {
        answered: true,
        answer: text,
        answeredAt: at,
        ledelseReplies: next,
      });
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
    ["Status", replies.length ? "Besvaret" : "Åben"],
  ].filter(([, v]) => v.trim()) as [string, string][];

  return (
    <article>
      <ReadSlip kicker="TF" number={tf.number} title={tf.title} rows={rows} body={tf.body} photos={tf.photos} />
      <LedelseComment replies={replies} draft={draft} busy={busy} error={error} onDraft={setDraft} onSend={() => void send()} />
    </article>
  );
}

export function SagAsPage({ site, number }: { site: SagSite | null; number: string }) {
  const as = site?.slips.find((r) => r.slug === number || r.number === number || r.number === `AS-${number}`);
  if (!site || !as) return <SagMissing />;
  return (
    <SagShell job={site.job}>
      <SagBack to={sagPath(site.job.slug, ["as"])}>Tilbage til AS</SagBack>
      <SagAsBody as={as} print={false} />
    </SagShell>
  );
}

export function SagTbPage({ site, number }: { site: SagSite | null; number: string }) {
  const row = site?.tbs.find((r) => r.slug === number || r.number === number || r.number === `TB-${number}`);
  if (!site || !row) return <SagMissing />;
  return (
    <SagShell job={site.job}>
      <SagBack to={sagPath(site.job.slug, ["tb"])}>Tilbage til TB</SagBack>
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
      <ReadSlip
        kicker={kind === "tb" ? "TB" : "AS"}
        number={as.number}
        title={as.title}
        rows={rows}
        body={as.description || as.body}
        photos={as.photos}
        extra={
          <>
            {as.materials.length ? (
              <section className="mt-4 rounded-[20px] bg-paper px-4 py-4 shadow-card">
                <p className="text-xs font-semibold tracking-wide text-muted uppercase">Materialer</p>
                <ul className="mt-2 space-y-2 text-base">
                  {as.materials.map((m, i) => (
                    <li key={i} className="flex justify-between gap-4">
                      <span>{m.text.replace(/\s+\d{1,3}(?:\.\d{3})+\s*,-\s*$/, "").trim() || m.text}</span>
                      <span className="shrink-0 tabular-nums text-muted">{m.amount != null ? `${m.amount.toLocaleString("da-DK")},-` : ""}</span>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}
            {as.note ? (
              <section className="mt-4 rounded-[20px] bg-paper px-4 py-4 shadow-card">
                <p className="text-xs font-semibold tracking-wide text-muted uppercase">Kunde bemærkning</p>
                <p className="mt-2 whitespace-pre-wrap text-base leading-relaxed">{as.note}</p>
              </section>
            ) : null}
            <section className="mt-4 rounded-[20px] bg-paper px-4 py-4 shadow-card">
              <p className="text-xs font-semibold tracking-wide text-muted uppercase">Pris ekskl. moms</p>
              <p className="mt-1 font-display text-3xl text-navy">{as.priceLabel}</p>
            </section>
          </>
        }
      />
      {print ? null : <ReportComment kind={kind === "tb" ? "offer" : "slip"} id={as.id} start={as.replies ?? []} />}
    </article>
  );
}

export function SagErPage({ site, number }: { site: SagSite | null; number: string }) {
  const er = site?.ents.find((r) => r.slug === number || r.number === number || r.number === `ER-${number}`);
  if (!site || !er) return <SagMissing />;
  return (
    <SagShell job={site.job}>
      <SagBack to={sagPath(site.job.slug, ["er"])}>Tilbage til ER</SagBack>
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
      <ReadSlip
        kicker="ER"
        number={er.number}
        title={er.title}
        rows={rows}
        body={er.body}
        photos={er.photos}
        extra={
          er.note ? (
            <section className="mt-4 rounded-[20px] bg-paper px-4 py-4 shadow-card">
              <p className="text-xs font-semibold tracking-wide text-muted uppercase">Kunde bemærkning</p>
              <p className="mt-2 whitespace-pre-wrap text-base leading-relaxed">{er.note}</p>
            </section>
          ) : null
        }
      />
      <ReportComment kind="ent" id={er.id} start={er.replies ?? []} />
    </article>
  );
}

export function SagKsPage({ site, number }: { site: SagSite | null; number: string }) {
  const ks = site?.kss.find((r) => r.slug === number || r.number === number || r.number === `KS-${number}` || `KS-${r.number}` === number);
  if (!site || !ks) return <SagMissing />;
  return (
    <SagShell job={site.job}>
      <SagBack to={sagPath(site.job.slug, ["ks"])}>Tilbage til KS</SagBack>
      <SagKsBody ks={ks} />
    </SagShell>
  );
}

function SagKsBody({ ks }: { ks: SagKsView }) {
  const rows: [string, string][] = [
    ["Dato", dmy(ks.createdAt)],
    ["Lokation", ks.location],
    ["Kontrolpunkt", ks.point],
    ["Udført af", ks.employeeName],
    ["Kontrolomfang", ks.qcScope],
    ["Metode", ks.qcMethod],
  ].filter(([, v]) => v.trim()) as [string, string][];
  return (
    <article>
      <ReadSlip
        kicker="KS"
        number={ks.number}
        title={ks.title}
        rows={rows}
        body=""
        photos={ks.photos}
        extra={
          <>
            {ks.partTitle ? (
              <section className="mt-4 rounded-[20px] bg-paper px-4 py-4 shadow-card">
                <p className="text-xs font-semibold tracking-wide text-muted uppercase">Punkt</p>
                <p className="mt-2 text-base leading-relaxed">
                  {ks.partCode !== "ovrige" ? `${ks.partCode} · ` : ""}
                  {ks.partTitle}
                </p>
              </section>
            ) : null}
            <section className="mt-4 rounded-[20px] bg-paper px-4 py-4 shadow-card">
              <p className="text-xs font-semibold tracking-wide text-muted uppercase">Afvigelser</p>
              <p className="mt-2 whitespace-pre-wrap text-base leading-relaxed">{ks.deviations || "Ingen"}</p>
            </section>
          </>
        }
      />
      <ReportComment kind="ks" id={ks.id} start={ks.replies ?? []} />
    </article>
  );
}

function ReadSlip({
  kicker,
  number,
  title,
  rows,
  body,
  photos,
  extra,
}: {
  kicker: string;
  number: string;
  title: string;
  rows: [string, string][];
  body: string;
  photos: { id: string; src: string; n: string }[];
  extra?: ReactNode;
}) {
  return (
    <div data-testid="ledelse-slip">
      <p className="text-xs font-semibold tracking-wide text-brick uppercase">
        {kicker} · {number}
      </p>
      <h1 className="mt-1 font-display text-3xl leading-tight text-navy">{title}</h1>
      <div className="mt-4">
        <SagMetaGrid rows={rows} />
      </div>
      {body ? (
        <section className="mt-4 rounded-[20px] bg-paper px-4 py-4 shadow-card">
          <p className="text-xs font-semibold tracking-wide text-muted uppercase">Rapport</p>
          <p className="mt-2 whitespace-pre-wrap text-base leading-relaxed text-ink">{body}</p>
        </section>
      ) : null}
      {extra}
      <SagPhotos photos={photos} />
    </div>
  );
}

function LedelseComment({
  replies,
  draft,
  busy,
  error,
  onDraft,
  onSend,
}: {
  replies: LedelseReply[];
  draft: string;
  busy: boolean;
  error: string;
  onDraft: (v: string) => void;
  onSend: () => void;
}) {
  return (
    <section className="mt-4 rounded-[20px] bg-paper px-4 py-4 shadow-card" data-testid="ledelse-comment">
      <p className="text-xs font-semibold tracking-wide text-muted uppercase">Kommentar</p>
      {replies.map((r) => (
        <div key={r.id} className="mt-3 border-t border-line pt-3">
          <p className="text-xs text-muted">{dmy(r.at)}</p>
          <p className="mt-1 whitespace-pre-wrap text-base leading-relaxed">{r.text}</p>
        </div>
      ))}
      <textarea
        className="mt-3 min-h-28 w-full rounded-xl bg-sand px-3 py-2 text-base text-ink outline-none"
        placeholder="Skriv kommentar…"
        value={draft}
        onChange={(e) => onDraft(e.target.value)}
        data-testid="ledelse-comment-input"
      />
      {error ? <p className="mt-2 text-sm text-brick">{error}</p> : null}
      <PrimaryButton className="mt-3 min-h-12 w-auto px-5" disabled={!draft.trim() || busy} onClick={onSend}>
        {busy ? "Gemmer…" : "Send kommentar"}
      </PrimaryButton>
    </section>
  );
}

function ReportComment({ kind, id, start }: { kind: "slip" | "offer" | "ent" | "ks"; id: string; start: LedelseReply[] }) {
  const [draft, setDraft] = useState("");
  const [replies, setReplies] = useState(start);
  const [busy, setBusy] = useState(false);

  function send() {
    const text = draft.trim();
    if (!text || busy) return;
    setBusy(true);
    const next: LedelseReply[] = [...replies, { id: `rpl-${Date.now().toString(36)}`, text, at: new Date().toISOString() }];
    useYard.getState().patchReport(kind, id, { ledelseReplies: next });
    setReplies(next);
    setDraft("");
    setBusy(false);
  }

  return <LedelseComment replies={replies} draft={draft} busy={busy} error="" onDraft={setDraft} onSend={send} />;
}

function LedelseTodos({ projectId }: { projectId: string }) {
  const allTodos = useYard((s) => s.todos);
  const employees = useYard((s) => s.employees);
  const patchTodo = useYard((s) => s.patchTodo);
  const addTodo = useYard((s) => s.addTodo);
  const todos = allTodos.filter((td) => td.projectId === projectId && !td.done);
  const [draft, setDraft] = useState("");
  const [edits, setEdits] = useState<Record<string, string>>({});

  function save(id: string) {
    const body = (edits[id] ?? todos.find((t) => t.id === id)?.body ?? "").trim();
    patchTodo(id, { body, title: body.split("\n")[0]?.slice(0, 80) || todos.find((t) => t.id === id)?.title });
  }

  function add() {
    const body = draft.trim();
    if (!body) return;
    addTodo({
      projectId,
      assigneeId: useYard.getState().employeeId || "emp-ole",
      title: body.split("\n")[0]!.slice(0, 80),
      body,
      due: "",
    });
    setDraft("");
  }

  return (
    <section data-testid="ledelse-todo">
      <p className="text-sm text-muted">Åbne to-dos på sagen. Du kan tilføje og rette beskrivelsen.</p>
      <ul className="mt-3 space-y-3">
        {todos.map((td) => (
          <li key={td.id} className="rounded-[20px] bg-paper px-3 py-3 shadow-card">
            <p className="text-sm font-semibold text-navy">{td.title}</p>
            <p className="text-xs text-muted">{todoPeopleLine(td, employees)}</p>
            <textarea
              className="mt-2 min-h-20 w-full rounded-xl bg-sand px-3 py-2 text-base outline-none"
              value={edits[td.id] ?? td.body ?? td.title ?? ""}
              onChange={(e) => setEdits((cur) => ({ ...cur, [td.id]: e.target.value }))}
              data-testid={`ledelse-todo-body-${td.id}`}
            />
            <PrimaryButton className="mt-2 min-h-11 w-auto px-4 text-sm" onClick={() => save(td.id)}>
              Gem beskrivelse
            </PrimaryButton>
          </li>
        ))}
      </ul>
      <textarea
        className="mt-3 min-h-20 w-full rounded-xl bg-paper px-3 py-2 text-base outline-none shadow-card"
        placeholder="Ny to-do — skriv beskrivelsen"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        data-testid="ledelse-todo-new"
      />
      <PrimaryButton className="mt-2 min-h-11 w-auto px-4" disabled={!draft.trim()} onClick={add}>
        Tilføj to-do
      </PrimaryButton>
    </section>
  );
}

export function SagTodoList({ site }: { site: SagSite | null }) {
  if (!site) return <SagMissing />;
  return (
    <SagShell job={site.job}>
      <SagBack to={sagPath(site.job.slug)}>Tilbage til {site.job.name}</SagBack>
      <div className="flex items-center gap-2">
        <SagPng name="todo" px={64} />
        <h1 className="font-display text-3xl text-navy">To-do</h1>
      </div>
      <LedelseTodos projectId={site.job.projectId} />
    </SagShell>
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
    <main className="min-h-dvh bg-sand pb-16">
      <div className="mx-auto max-w-lg px-4 py-6">
        <div className="mb-6 flex flex-wrap items-center gap-4 text-sm">
          <BackArrow href={sagPath(job.slug, ["as"])} label="Tilbage til AS" />
          <button type="button" className="min-h-11 font-semibold text-navy" onClick={() => window.print()}>
            Print / PDF
          </button>
        </div>
        <section className="rounded-[24px] bg-paper px-4 py-5 shadow-card">
          <p className="text-xs font-semibold tracking-wide text-brick uppercase">AS · samling</p>
          <h1 className="mt-1 font-display text-4xl text-navy">{job.name}</h1>
          <SagMetaGrid
            rows={
              [
                ["Til", job.client],
                ["Antal", String(rows.length)],
                ["Dato", day],
              ].filter(([, v]) => v.trim()) as [string, string][]
            }
          />
          <table className="mt-6 w-full text-left text-sm">
            <thead>
              <tr className="border-b border-line text-xs tracking-wide text-muted uppercase">
                <th className="py-2 font-medium">Nr</th>
                <th className="py-2 font-medium">Titel</th>
                <th className="py-2 font-medium">Dato</th>
                <th className="py-2 text-right font-medium">Beløb</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-line">
                  <td className="py-3">{r.number}</td>
                  <td className="py-3">{r.title}</td>
                  <td className="py-3">{dmy(r.createdAt)}</td>
                  <td className="py-3 text-right tabular-nums">{r.priceLabel}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-6 font-display text-2xl text-navy">I alt {tot.label}</p>
          <p className="mt-4 text-sm text-muted">
            Side 1 af {pages} · CVR {job.cvr}
            {tot.missing ? ` · ${tot.missing} uden beløb er ikke talt med` : ""}
          </p>
        </section>
        {rows.map((r, i) => (
          <section key={r.id} className="mt-6">
            <SagAsBody as={r} print />
            <p className="mt-3 text-sm text-muted">
              Side {i + 2} af {pages} · CVR {job.cvr}
            </p>
          </section>
        ))}
      </div>
    </main>
  );
}
