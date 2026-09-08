import { useEffect, useRef, useState } from "react";
import { Camera, Package } from "lucide-react";
import { DrivePhoto } from "@/components/drive-photo";
import { FacePhoto } from "@/components/face-photo";
import { ActionPng, CloseX } from "@/components/sag-icons";
import { Card, Chip, GhostButton, PrimaryButton, SectionLabel } from "@/components/zenko";
import { translateMessage } from "@/lib/ai.functions";
import { ORDERS_FOLDER_NAME, RECEIPTS_FOLDER_NAME } from "@/lib/drive";
import { compressImageFile } from "@/lib/field-media";
import { t } from "@/lib/i18n";
import { connectorUserText } from "@/lib/connector-msg";
import { slugForProject } from "@/lib/ks-customer";
import { sendOrderMail } from "@/lib/mail.functions";
import { getMaPublic, saveMaPublic } from "@/lib/ma-public.functions";
import { maFolderName, maLabel, maLinesComplete, maNrFromNumber, maPublicPath, maThreadOriginal, shownMaThreadText, supplierMailBody, toMaPublic } from "@/lib/ma-public";
import { MaHome } from "@/components/ma-public";
import { findProdukter, orderLines, scanBehov } from "@/lib/material";
import { noticeForMaShare } from "@/lib/notify";
import { gpsPatch, readGpsOrSite, stampPhotoFiles } from "@/lib/photo-meta";
import { copenhagenDate, FIRM_CVR, FIRM_PHONE, isMasterRole, projectById } from "@/lib/seed";
import { lookupProject, useSessionEmployee, useYard } from "@/lib/store";
import { uploadDraftsToFolder } from "@/lib/todo-drive";
import { UserText } from "@/components/user-text";
import type { Employee, Lang, MaterialLine, MaterialNeed, MaterialOrder, MaThreadMsg, Supplier } from "@/lib/types";

export function MaterialBoard({ lang, projectId }: { lang: Lang; projectId?: string }) {
  const me = useSessionEmployee();
  const master = me ? isMasterRole(me.role) : false;
  const needs = (useYard((s) => s.needs) ?? []).filter((n) => n.status === "need" && (!projectId || n.projectId === projectId));
  const orders = (useYard((s) => s.orders) ?? []).filter((o) => !projectId || o.projectId === projectId);
  const employees = useYard((s) => s.employees);
  const [openNeed, setOpenNeed] = useState<string | null>(null);
  const [openOrder, setOpenOrder] = useState<string | null>(null);
  const [openBlanket, setOpenBlanket] = useState<{ slug: string; nr: string } | null>(null);
  const need = needs.find((n) => n.id === openNeed) ?? null;
  const order = orders.find((o) => o.id === openOrder) ?? null;
  const warnings = orders.filter((o) => o.status === "mismatch" || o.warning);

  return (
    <>
      {master ? <SupplierBook lang={lang} /> : null}
      <Card className="rounded-[20px]">
        <div className="mb-2 flex items-center gap-2">
          <Package className="size-4 text-navy" />
          <SectionLabel>{t(lang, "matTitle")}</SectionLabel>
          {needs.length ? <Chip tone="brick">{needs.length}</Chip> : null}
        </div>
        <p className="mb-3 text-list leading-[1.4] text-ink">{t(lang, "matHint")}</p>
        {needs.length === 0 ? <p className="text-list leading-[1.4] text-ink">{t(lang, "matNone")}</p> : null}
        <ul className="space-y-2">
          {needs.map((n) => {
            const who = employees.find((e) => e.id === n.fromId);
            return (
              <li key={n.id}>
                <button type="button" className="flex min-h-14 w-full items-start gap-3 rounded-xl bg-sand px-3 py-2 text-left" onClick={() => setOpenNeed(n.id)}>
                  <FacePhoto employee={who} px={32} />
                  <span className="min-w-0 flex-1">
                    <p className="font-display text-title font-semibold text-ink">
                      {who?.name ?? "—"} · {projectById(n.projectId).name}
                    </p>
                    <p className="text-list leading-[1.4] text-ink">{n.text}</p>
                    <p className="mt-1 text-list leading-[1.4] text-ink">
                      {t(lang, "matType")} · {n.keywords.join(" · ")}
                    </p>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
        {orders.length ? (
          <div className="mt-3 border-t border-line pt-3">
            <SectionLabel>{t(lang, "matOrders")}</SectionLabel>
            <ul className="mt-1 space-y-1.5">
              {orders.slice(0, 8).map((o) => {
                const done = maLinesComplete(orderLines(o));
                const job = lookupProject(o.projectId);
                const slug = slugForProject(job);
                const nr = maNrFromNumber(o.number) || o.number;
                return (
                  <li key={o.id}>
                    <div className="flex items-center gap-2 rounded-xl bg-sand px-3 py-2">
                      <button
                        type="button"
                        className="min-w-0 flex-1 text-left"
                        onClick={() => setOpenBlanket({ slug, nr })}
                      >
                        <p className="whitespace-nowrap font-display text-title font-semibold text-ink">
                          {maLabel(o.number)} · {o.product || t(lang, "matFillSelf")}
                        </p>
                      </button>
                      {master ? (
                        <button
                          type="button"
                          className="flex size-11 shrink-0 items-center justify-center rounded-full bg-paper"
                          aria-label="Redigér"
                          onClick={() => setOpenOrder(o.id)}
                        >
                          <ActionPng name="sagerPencil" px={28} />
                        </button>
                      ) : null}
                      <button
                        type="button"
                        className={`flex size-11 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${done ? "bg-[#2f7d4a] text-white" : "bg-[#c45c3e] text-[#fffaf6]"}`}
                        onClick={() => setOpenBlanket({ slug, nr })}
                      >
                        {done ? t(lang, "maOk") : t(lang, "maOpen")}
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        ) : null}
        {warnings.length ? (
          <p className="mt-2 text-xs text-brick">
            {t(lang, "matWarnCount", { n: warnings.length })}
          </p>
        ) : null}
      </Card>
      {need ? <OrderSheet lang={lang} need={need} onClose={() => setOpenNeed(null)} /> : null}
      {order && !need ? <OrderView lang={lang} order={order} onClose={() => setOpenOrder(null)} /> : null}
      {openBlanket ? (
        <div className="fixed inset-0 z-[80] overflow-y-auto bg-[#fffaf6]">
          <div className="sticky top-0 z-10 flex justify-end bg-[#fffaf6] px-3 py-2 pt-[max(0.5rem,env(safe-area-inset-top))]">
            <CloseX onClick={() => setOpenBlanket(null)} label={t(lang, "close")} />
          </div>
          <MaHome slug={openBlanket.slug} nr={openBlanket.nr} />
        </div>
      ) : null}
    </>
  );
}

export function OpenMaSheet({ lang }: { lang: Lang }) {
  const id = useYard((s) => s.openMaId);
  const order = useYard((s) => s.orders.find((o) => o.id === id) ?? null);
  if (!order) return null;
  const job = lookupProject(order.projectId);
  const slug = slugForProject(job);
  const nr = maNrFromNumber(order.number) || order.number;
  return (
    <div className="fixed inset-0 z-[80] overflow-y-auto bg-[#fffaf6]">
      <div className="sticky top-0 z-10 flex justify-end bg-[#fffaf6] px-3 py-2 pt-[max(0.5rem,env(safe-area-inset-top))]">
        <CloseX onClick={() => useYard.getState().setOpenMa(null)} label={t(lang, "close")} />
      </div>
      <MaHome slug={slug} nr={nr} />
    </div>
  );
}

export function NeedOrderSheet({ lang, needId, onClose }: { lang: Lang; needId: string; onClose: () => void }) {
  const need = useYard((s) => s.needs.find((n) => n.id === needId) ?? null);
  if (!need) return null;
  return <OrderSheet lang={lang} need={need} onClose={onClose} />;
}

export function NewOrderSheet({ lang, projectId, pickJob, onClose }: { lang: Lang; projectId?: string; pickJob?: boolean; onClose: () => void }) {
  const me = useSessionEmployee();
  const need: MaterialNeed = {
    id: "",
    projectId: pickJob ? "" : projectId ?? "",
    fromId: me?.id ?? "",
    keywords: [],
    text: "",
    at: new Date().toISOString(),
    status: "need",
  };
  return <OrderSheet lang={lang} need={need} pickJob={Boolean(pickJob || !projectId)} onClose={onClose} />;
}

function emptyLine(): MaterialLine {
  return { product: "", spec: "", qty: 1, unit: "stk", inUdbud: false, cite: "ikke i udbud — udfyld selv" };
}

function linesFromNeed(projectId: string, need: MaterialNeed): MaterialLine[] {
  const keys = (need.keywords?.length ? need.keywords : scanBehov(need.text || "")).filter(Boolean);
  if (projectId && keys.length) {
    const hits = findProdukter(projectId, keys);
    const filled = hits.filter((h) => h.product.trim());
    if (filled.length) {
      return filled.map((h) => ({
        product: h.product,
        spec: h.spec,
        qty: 1,
        unit: "stk",
        inUdbud: h.found,
        cite: h.cite || (h.found ? "" : "ikke i udbud — udfyld selv"),
      }));
    }
  }
  if (need.text?.trim()) return [{ ...emptyLine(), spec: need.text.trim() }];
  return [emptyLine()];
}

const LINE_UNITS = [
  { id: "stk", label: "Stk" },
  { id: "m2", label: "m²" },
  { id: "liter", label: "Liter" },
  { id: "spande", label: "Spande" },
  { id: "lbm", label: "lbm" },
  { id: "saek", label: "Sæk" },
  { id: "pak", label: "Pak" },
  { id: "rulle", label: "Rulle" },
] as const;

type LineDraft = { dataUrl: string; name: string };

function LineEditor({
  lang,
  projectId,
  line,
  index = 0,
  onChange,
  onRemove,
  drafts = [],
  onDrafts,
  folderName,
}: {
  lang: Lang;
  projectId: string;
  line: MaterialLine;
  index?: number;
  onChange: (next: MaterialLine) => void;
  onRemove?: () => void;
  drafts?: LineDraft[];
  onDrafts?: (next: LineDraft[]) => void;
  folderName?: string;
}) {
  const photoRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const unit = LINE_UNITS.some((u) => u.id === line.unit) ? line.unit : "stk";
  const photoId = line.photoFileIds?.[0];
  const draft = drafts[0];

  async function addPhoto(list: FileList | null) {
    const file = list?.[0];
    if (!file) return;
    try {
      const made = await compressImageFile(file);
      if (!made.dataUrl) return;
      const next: LineDraft = { dataUrl: made.dataUrl, name: file.name || "foto.jpg" };
      if (folderName) {
        setBusy(true);
        const ids = await uploadDraftsToFolder({ projectId, folderName, drafts: [next] });
        setBusy(false);
        if (ids[0]) onChange({ ...line, photoFileIds: [ids[0]] });
        return;
      }
      onDrafts?.([next]);
    } catch {
      /* skip */
    }
  }

  return (
    <div className={`rounded-2xl border-2 border-navy/25 p-3 shadow-card ${index % 2 ? "bg-sand" : "bg-paper"}`}>
      <p className="mb-2 font-display text-lg text-navy">{t(lang, "matLineN", { n: index + 1 })}</p>
      <label className="block text-xs text-muted">
        {t(lang, "matProduct")}
        <input className="mt-1 min-h-11 w-full rounded-xl bg-white/80 px-3 text-sm" value={line.product} onChange={(e) => onChange({ ...line, product: e.target.value })} />
      </label>
      <label className="mt-2 block text-xs text-muted">
        {t(lang, "matQty")}
        <input
          className="mt-1 min-h-11 w-full rounded-xl bg-white/80 px-3 text-sm"
          value={String(line.qty)}
          onChange={(e) => onChange({ ...line, qty: Number(e.target.value) || 0 })}
          inputMode="numeric"
        />
      </label>
      <div className="mt-2 flex flex-wrap gap-1">
        {LINE_UNITS.map((u) => (
          <button
            key={u.id}
            type="button"
            className={`min-h-9 rounded-full px-3 text-xs ${unit === u.id ? "bg-navy text-sand" : "bg-white/80 text-ink"}`}
            onClick={() => onChange({ ...line, unit: u.id })}
          >
            {u.label}
          </button>
        ))}
      </div>
      <label className="mt-2 block text-xs text-muted">
        {t(lang, "matProductUrl")}
        <input
          className="mt-1 min-h-11 w-full rounded-xl bg-white/80 px-3 text-sm"
          value={line.productUrl ?? ""}
          onChange={(e) => onChange({ ...line, productUrl: e.target.value })}
          placeholder="https://…"
        />
      </label>
      <input
        ref={photoRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          void addPhoto(e.target.files);
          e.target.value = "";
        }}
      />
      <div className="mt-3 flex items-start gap-2">
        <button
          type="button"
          disabled={busy}
          aria-label={t(lang, "matLinePhoto")}
          className="grid size-14 shrink-0 place-items-center rounded-xl border border-navy/20 bg-white/80 text-navy disabled:opacity-50"
          onClick={() => photoRef.current?.click()}
        >
          {photoId ? (
            <DrivePhoto
              compact
              className="size-14 object-cover"
              photo={{ id: photoId, dataUrl: "", takenAt: "", floor: "", room: "", point: "", projectId, projectName: "", employeeId: "", employeeName: "", driveFileId: photoId }}
            />
          ) : draft ? (
            <img src={draft.dataUrl} alt="" className="size-14 object-cover" />
          ) : (
            <Camera className="size-6" strokeWidth={2.1} />
          )}
        </button>
        <label className="block min-w-0 flex-1 text-xs text-muted">
          {t(lang, "matLineText")}
          <textarea
            className="mt-1 min-h-14 w-full rounded-xl bg-white/80 px-3 py-2 text-sm"
            value={line.spec}
            onChange={(e) => onChange({ ...line, spec: e.target.value })}
          />
        </label>
      </div>
      {onRemove ? (
        <GhostButton className="mt-2 min-h-9 px-2 text-xs text-brick" onClick={onRemove}>
          {t(lang, "todoDelete")}
        </GhostButton>
      ) : null}
    </div>
  );
}

function statusLabel(lang: Lang, o: MaterialOrder) {
  if (o.status === "sent") return t(lang, "matSent");
  if (o.status === "draft") return t(lang, "matDraft");
  if (o.status === "received") return t(lang, "matReceived");
  if (o.status === "mismatch") return t(lang, "matMismatch");
  if (o.status === "ks") return t(lang, "matKsDone");
  return o.status;
}

function SupplierBook({ lang }: { lang: Lang }) {
  const suppliers = useYard((s) => s.suppliers) ?? [];
  const addSupplier = useYard((s) => s.addSupplier);
  const removeSupplier = useYard((s) => s.removeSupplier);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  return (
    <Card className="rounded-[20px]" data-testid="ma-suppliers">
      <SectionLabel>{t(lang, "matSuppliers")}</SectionLabel>
      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        <input className="min-h-11 w-full rounded-xl bg-sand px-3 text-sm" placeholder={t(lang, "matSupplierName")} value={name} onChange={(e) => setName(e.target.value)} />
        <input className="min-h-11 w-full rounded-xl bg-sand px-3 text-sm" placeholder={t(lang, "matSupplierMail")} value={email} onChange={(e) => setEmail(e.target.value)} inputMode="email" />
      </div>
      <GhostButton
        className="mt-2 bg-sand"
        onClick={() => {
          if (addSupplier({ name, email })) {
            setName("");
            setEmail("");
          }
        }}
      >
        {t(lang, "matAddSupplier")}
      </GhostButton>
      {suppliers.length ? (
        <ul className="mt-3 space-y-1.5">
          {suppliers.map((s) => (
            <li key={s.id} className="flex items-center justify-between gap-2 rounded-xl bg-sand px-3 py-2">
              <span className="min-w-0">
                <span className="block text-sm font-medium text-navy">{s.name}</span>
                <span className="block truncate text-xs text-muted">{s.email}</span>
              </span>
              <GhostButton className="min-h-9 px-2 text-xs text-brick" onClick={() => removeSupplier(s.id)}>
                {t(lang, "matDelSupplier")}
              </GhostButton>
            </li>
          ))}
        </ul>
      ) : null}
    </Card>
  );
}

function OrderSheet({ lang, need, pickJob, onClose }: { lang: Lang; need: MaterialNeed; pickJob?: boolean; onClose: () => void }) {
  const me = useSessionEmployee();
  const projects = (useYard((s) => s.projects) ?? []).filter((p) => p.status === "active");
  const employees = useYard((s) => s.employees) ?? [];
  const suppliers = useYard((s) => s.suppliers) ?? [];
  const [jobId, setJobId] = useState(need.projectId);
  const job = lookupProject(jobId);
  const [lines, setLines] = useState<MaterialLine[]>(() => linesFromNeed(need.projectId, need));
  const [drafts, setDrafts] = useState<Record<number, LineDraft[]>>({});
  const [date, setDate] = useState(copenhagenDate());
  const [delivery, setDelivery] = useState(job.address);
  const [mail, setMail] = useState("");
  const [supplierName, setSupplierName] = useState("");
  const [phone, setPhone] = useState(FIRM_PHONE);
  const [contactId, setContactId] = useState("");
  const [driverNote, setDriverNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const addOrder = useYard((s) => s.addOrder);
  const patchOrder = useYard((s) => s.patchOrder);
  const addTodo = useYard((s) => s.addTodo);
  const patchChat = useYard((s) => s.patchChat);

  function pickSag(id: string) {
    setJobId(id);
    const next = lookupProject(id);
    setDelivery(next.address);
    setLines((cur) => {
      const blank = cur.length === 1 && !cur[0]?.product.trim();
      return blank ? linesFromNeed(id, need) : cur;
    });
  }

  function pickSupplier(s: Supplier) {
    setMail(s.email);
    setSupplierName(s.name);
  }

  function pickContact(id: string) {
    setContactId(id);
    const emp = employees.find((e) => e.id === id);
    if (emp?.phone) setPhone(emp.phone);
  }

  async function save(mode: "send" | "draft" | "copy") {
    if (!me) return;
    if (!jobId) {
      setNote(t(lang, "matPickJobNeed"));
      return;
    }
    const filled = lines.filter((l) => l.product.trim()).map((l) => ({ ...l, unit: l.unit || "stk" }));
    const first = filled[0];
    if (!first?.product.trim()) {
      setNote(t(lang, "matNeedProduct"));
      return;
    }
    setBusy(true);
    setNote("");
    try {
      const qtyN = first.qty || 0;
      const cite = first.inUdbud ? first.cite ?? "" : "ikke i udbud — udfyld selv";
      const shareStatus = mode === "send" ? "sendt" : mode === "copy" ? "kopieret" : "kladde";
      const slug = slugForProject(job);
      const n = useYard.getState().serial.mo ?? 1;
      const number = `MA-2026-${String(n).padStart(3, "0")}`;
      const id = `mo-${crypto.randomUUID().slice(0, 8)}`;
      const folder = `${ORDERS_FOLDER_NAME}/${maFolderName(number)}`;
      const withMedia = [...filled];
      for (const [idx, ds] of Object.entries(drafts)) {
        const i = Number(idx);
        if (!ds?.length || !withMedia[i]) continue;
        const ids = await uploadDraftsToFolder({ projectId: jobId, folderName: folder, drafts: ds.slice(0, 1) });
        if (!ids[0]) {
          setNote(t(lang, "driveFail"));
          return;
        }
        withMedia[i] = { ...withMedia[i]!, photoFileIds: [ids[0]] };
      }
      const path = maPublicPath(slug, number);
      const origin = typeof window !== "undefined" ? window.location.origin : "";
      const draftRow = {
        id,
        number,
        projectId: jobId,
        needId: need.id || undefined,
        chatId: need.chatId,
        fromId: need.fromId || me.id,
        product: withMedia[0]?.product.trim() || first.product.trim(),
        spec: first.spec,
        qty: qtyN,
        unit: first.unit || "stk",
        inUdbud: first.inUdbud,
        cite,
        deliveryAddress: delivery,
        expectedDate: date,
        supplierEmail: mail,
        supplierName,
        nab: guessNab(job.brief),
        customer: job.customer ?? "",
        cvr: FIRM_CVR,
        orderedBy: me.name,
        mailMode: mode === "draft" ? "draft" : "send",
        status: mode === "send" ? "sent" : "draft",
        lines: withMedia,
        phone,
        driverNote,
        shareStatus,
        contactEmployeeId: contactId || undefined,
        orderedAt: new Date().toISOString(),
        publicPath: path,
      } as MaterialOrder;
      const pub = { ...toMaPublic(draftRow, [], useYard.getState().projects), dummy: false, missingData: false };
      const drive = await saveMaPublic({ data: { order: { ...pub, id }, action: shareStatus } });
      if (!drive.ok || !drive.fileId) {
        setNote(connectorUserText(lang, drive.error, drive.loginRequired));
        return;
      }
      const row = addOrder({
        ...draftRow,
        id,
        number,
        driveFileId: drive.fileId,
      });
      let todoId = row.todoId;
      if (mode !== "draft" && (need.fromId || me.id)) {
        const todo = addTodo({
          projectId: jobId,
          assigneeId: need.fromId || me.id,
          fromId: me.id,
          title: t(lang, "matTodoTitle", { product: row.product }),
          body: t(lang, "matTodoBody", { product: row.product, qty: `${row.qty} ${row.unit}`, date }),
          due: date,
          needsPhoto: true,
          original: "Materiale bestilt — tag billede når det ankommer.",
          sourceLang: "da",
          translations: {
            da: "Materiale bestilt — tag billede når det ankommer.",
            ro: "Material comandat — fă poză când sosește.",
            es: "Material pedido — foto cuando llegue.",
          },
          orderId: row.id,
        });
        todoId = todo.id;
      }
      patchOrder(row.id, { todoId, publicPath: path, phone, driverNote, shareStatus, lines: withMedia, driveFileId: drive.fileId });
      notifyMaShare(me, { ...row, publicPath: path, shareStatus }, mode, `${origin}${path}`);
      if (need.chatId) {
        patchChat(need.chatId, {
          classifiedAs: "materials",
          classifiedAt: new Date().toISOString(),
          handledAt: new Date().toISOString(),
        });
      }
      if (mode === "copy") {
        try {
          await navigator.clipboard.writeText(`${origin}${path}`);
          useYard.setState({ toast: t(lang, "matCopied") });
        } catch {
          useYard.setState({ toast: `${origin}${path}` });
        }
      } else if (mail.trim()) {
        const body = supplierMailBody(pub, origin);
        const sent = await sendOrderMail({
          data: {
            to: mail.trim(),
            subject: `Materialebestilling ${maLabel(row.number)} · ${job.name}`,
            body,
            mode: mode === "draft" ? "draft" : "send",
          },
        });
        const msg = sent.loginRequired
          ? t(lang, "mailLogin")
          : !sent.ok
            ? sent.error || t(lang, "driveFail")
            : mode === "send"
              ? t(lang, "matSentOk")
              : t(lang, "matDraftOk");
        useYard.setState({ toast: msg });
      } else {
        useYard.setState({ toast: mode === "send" ? t(lang, "matSentOk") : t(lang, "matDraftOk") });
      }
      onClose();
    } catch (err) {
      setNote(err instanceof Error ? err.message : t(lang, "matNeedProduct"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[70] overflow-y-auto bg-sand">
      <div className="sticky top-0 z-10 flex items-center gap-2 bg-navy px-3 py-2 pt-[max(0.5rem,env(safe-area-inset-top))] text-sand">
        <p className="font-display text-lg">{t(lang, "matOrder")}</p>
        <CloseX onClick={onClose} label={t(lang, "close")} />
      </div>
      <div className="mx-auto max-w-lg space-y-3 px-4 py-4">
        {pickJob ? (
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">{t(lang, "matPickJob")}</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {projects.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  className={`min-h-10 rounded-full px-3 text-xs font-medium ${jobId === p.id ? "bg-navy text-sand" : "bg-paper text-ink shadow-card"}`}
                  onClick={() => pickSag(p.id)}
                >
                  {p.name}
                </button>
              ))}
            </div>
          </div>
        ) : null}
        <p className="text-sm text-muted">
          {jobId ? `${job.name} · ${job.address}` : t(lang, "matPickJobNeed")}
        </p>
        {need.text ? (
          <blockquote className="border-l-2 border-brick pl-3 text-sm text-ink">
            <p className="text-[0.68rem] uppercase tracking-[0.14em] text-muted">{t(lang, "matNeedQuote")}</p>
            <p className="mt-1">{need.text}</p>
          </blockquote>
        ) : null}
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">{t(lang, "matLines")}</p>
        <ul className="space-y-4">
          {lines.map((line, i) => (
            <li key={i}>
              <LineEditor
                lang={lang}
                projectId={jobId}
                index={i}
                line={line}
                drafts={drafts[i] ?? []}
                onDrafts={(next) => setDrafts((cur) => ({ ...cur, [i]: next }))}
                onChange={(next) => setLines((cur) => cur.map((x, idx) => (idx === i ? next : x)))}
                onRemove={i > 0 ? () => setLines((cur) => cur.filter((_, idx) => idx !== i)) : undefined}
              />
            </li>
          ))}
        </ul>
        <GhostButton className="bg-paper" onClick={() => setLines((cur) => [...cur, emptyLine()])}>
          {t(lang, "matAddLine")}
        </GhostButton>
        <label className="block text-xs text-muted">
          {t(lang, "matDate")}
          <input className="mt-1 min-h-11 w-full rounded-xl bg-paper px-3 text-sm shadow-card" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </label>
        <label className="block text-xs text-muted">
          {t(lang, "matDelivery")}
          <input className="mt-1 min-h-11 w-full rounded-xl bg-paper px-3 text-sm shadow-card" value={delivery} onChange={(e) => setDelivery(e.target.value)} />
        </label>
        <div>
          <p className="text-xs text-muted">{t(lang, "matContactWho")}</p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {employees.map((e) => (
              <button
                key={e.id}
                type="button"
                className={`min-h-10 rounded-full px-3 text-xs font-medium ${contactId === e.id ? "bg-navy text-sand" : "bg-paper text-ink shadow-card"}`}
                onClick={() => pickContact(e.id)}
              >
                {e.name.split(" ")[0]}
                {e.phone ? ` · ${e.phone}` : ""}
              </button>
            ))}
          </div>
        </div>
        <label className="block text-xs text-muted">
          {t(lang, "matPhone")}
          <input className="mt-1 min-h-11 w-full rounded-xl bg-paper px-3 text-sm shadow-card" value={phone} onChange={(e) => setPhone(e.target.value)} />
        </label>
        <label className="block text-xs text-muted">
          {t(lang, "matDriver")}
          <textarea className="mt-1 min-h-20 w-full rounded-xl bg-paper px-3 py-2 text-sm shadow-card" value={driverNote} onChange={(e) => setDriverNote(e.target.value)} />
        </label>
        {suppliers.length ? (
          <div>
            <p className="text-xs text-muted">{t(lang, "matPickSupplier")}</p>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {suppliers.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  className={`min-h-10 rounded-full px-3 text-xs font-medium ${mail === s.email ? "bg-navy text-sand" : "bg-paper text-ink shadow-card"}`}
                  onClick={() => pickSupplier(s)}
                >
                  {s.name}
                </button>
              ))}
            </div>
          </div>
        ) : null}
        <label className="block text-xs text-muted">
          {t(lang, "matMailTo")}
          <input className="mt-1 min-h-11 w-full rounded-xl bg-paper px-3 text-sm shadow-card" value={mail} onChange={(e) => setMail(e.target.value)} placeholder="mail@…" />
        </label>
        {note ? <p className="text-sm text-brick">{note}</p> : null}
        <div className="flex flex-wrap gap-2">
          <GhostButton className="bg-paper" disabled={busy} onClick={() => void save("copy")}>
            {t(lang, "matCopyLink")}
          </GhostButton>
          <PrimaryButton disabled={busy} onClick={() => void save("send")}>
            {t(lang, "matSendNow")}
          </PrimaryButton>
          <GhostButton className="bg-paper" disabled={busy} onClick={() => void save("draft")}>
            {t(lang, "matSaveDraft")}
          </GhostButton>
        </div>
      </div>
    </div>
  );
}

function OrderView({ lang, order, onClose }: { lang: Lang; order: MaterialOrder; onClose: () => void }) {
  const me = useSessionEmployee();
  const master = me ? isMasterRole(me.role) : false;
  const receipts = (useYard((s) => s.receipts) ?? []).filter((r) => r.orderId === order.id);
  const orderToKs = useYard((s) => s.orderToKs);
  const dismissNeed = useYard((s) => s.dismissNeed);
  const removeTodo = useYard((s) => s.removeTodo);
  const patchOrder = useYard((s) => s.patchOrder);
  const addOrderThread = useYard((s) => s.addOrderThread);
  const addTodo = useYard((s) => s.addTodo);
  const addReceipt = useYard((s) => s.addReceipt);
  const [extra, setExtra] = useState<MaterialLine>(emptyLine());
  const [reply, setReply] = useState("");
  const [busyThread, setBusyThread] = useState(false);
  const camRef = useRef<HTMLInputElement>(null);
  const galRef = useRef<HTMLInputElement>(null);
  const rows = orderLines(order);
  const job = lookupProject(order.projectId);
  const path = order.publicPath || maPublicPath(slugForProject(job), order.number);
  const live = useYard((s) => s.orders.find((o) => o.id === order.id) ?? order);

  useEffect(() => {
    const slug = slugForProject(job);
    const nr = maNrFromNumber(order.number);
    if (!nr) return;
    void getMaPublic({ data: { slug, nr } }).then(async (res) => {
      if (!res.ok || !res.order?.thread?.length) return;
      const thread = [...res.order.thread];
      let changed = false;
      for (let i = 0; i < thread.length; i++) {
        const m = thread[i]!;
        if (m.translations && Object.keys(m.translations).length) continue;
        try {
          const tr = await translateMessage({ data: { text: m.text, from: m.sourceLang ?? "da" } });
          if (tr.ok) {
            thread[i] = { ...m, translations: tr.translations, original: m.original ?? m.text, text: tr.translations.da ?? m.text };
            changed = true;
          }
        } catch {
          /* keep original */
        }
      }
      patchOrder(order.id, { thread });
      if (changed) {
        const next = { ...order, thread, publicPath: path };
        void saveMaPublic({ data: { order: toMaPublic(next), action: next.shareStatus ?? "kladde" } });
      }
    });
  }, [order.id, order.number, job, patchOrder]);

  async function share(mode: "send" | "draft" | "copy") {
    const origin = window.location.origin;
    const shareStatus = mode === "send" ? "sendt" as const : mode === "copy" ? "kopieret" as const : "kladde" as const;
    if (!live.todoId && mode !== "draft" && live.fromId && me) {
      const todo = addTodo({
        projectId: live.projectId,
        assigneeId: live.fromId,
        fromId: me.id,
        title: t(lang, "matTodoTitle", { product: live.product }),
        body: t(lang, "matTodoBody", { product: live.product, qty: `${live.qty} ${live.unit}`, date: live.expectedDate }),
        due: live.expectedDate,
        needsPhoto: true,
        original: "Materiale bestilt — tag billede når det ankommer.",
        sourceLang: "da",
        orderId: live.id,
      });
      patchOrder(live.id, { todoId: todo.id, publicPath: path, shareStatus });
    } else {
      patchOrder(live.id, { publicPath: path, shareStatus, status: mode === "send" ? "sent" : live.status });
    }
    const pub = toMaPublic({ ...live, publicPath: path, shareStatus });
    const drive = await saveMaPublic({ data: { order: pub, action: shareStatus } });
    if (!drive.ok) {
      useYard.setState({ toast: connectorUserText(lang, drive.error, drive.loginRequired) });
      return;
    }
    if (drive.fileId) patchOrder(live.id, { driveFileId: drive.fileId, publicPath: path, shareStatus, status: mode === "send" ? "sent" : live.status });
    if (me) notifyMaShare(me, { ...live, publicPath: path, shareStatus }, mode, `${origin}${path}`);
    if (mode === "copy") {
      try {
        await navigator.clipboard.writeText(`${origin}${path}`);
        useYard.setState({ toast: t(lang, "matCopied") });
      } catch {
        useYard.setState({ toast: `${origin}${path}` });
      }
      return;
    }
    if (!live.supplierEmail?.trim()) {
      useYard.setState({ toast: t(lang, "matMailDrive") });
      return;
    }
    const sent = await sendOrderMail({
      data: {
        to: live.supplierEmail.trim(),
        subject: `Materialebestilling ${maLabel(live.number)} · ${job.name}`,
        body: supplierMailBody(pub, origin),
        mode: mode === "draft" ? "draft" : "send",
      },
    });
    useYard.setState({ toast: sent.ok ? (mode === "send" ? t(lang, "matSentOk") : t(lang, "matDraftOk")) : sent.error || t(lang, "matMailDrive") });
  }

  async function sendThread() {
    const raw = reply.trim();
    if (!raw || !me || busyThread) return;
    setBusyThread(true);
    try {
      let translations: MaThreadMsg["translations"] = { [lang]: raw, da: raw };
      try {
        const tr = await translateMessage({ data: { text: raw, from: lang } });
        if (tr.ok) translations = tr.translations;
      } catch {
        /* keep original */
      }
      const msg: MaThreadMsg = {
        from: master ? "mester" : "ansat",
        name: me.name,
        text: translations?.da ?? raw,
        original: raw,
        sourceLang: lang,
        translations,
        at: new Date().toISOString(),
      };
      addOrderThread(live.id, msg);
      setReply("");
      const next = { ...live, thread: [...(live.thread ?? []), msg], publicPath: path };
      void saveMaPublic({ data: { order: toMaPublic(next), action: next.shareStatus ?? "kladde" } });
    } finally {
      setBusyThread(false);
    }
  }

  async function addDelivery(list: FileList | null) {
    if (!list?.length || !me) return;
    const gps = await readGpsOrSite(job);
    const stamped = await stampPhotoFiles([...list], { who: me.name, job: job.name, gps });
    const folder = `${RECEIPTS_FOLDER_NAME}/${maFolderName(order.number)}`;
    const ids = await uploadDraftsToFolder({ projectId: order.projectId, folderName: folder, drafts: stamped });
    if (!ids.length) {
      useYard.setState({ toast: t(lang, "driveFail") });
      return;
    }
    const extraGps = gpsPatch(gps, "create");
    addReceipt({
      orderId: order.id,
      projectId: order.projectId,
      employeeId: me.id,
      source: "levering",
      photoFileIds: ids,
      gpsLabel: extraGps.gpsLabel,
      lat: extraGps.lat,
      lng: extraGps.lng,
    });
  }

  return (
    <div className="fixed inset-0 z-[70] overflow-y-auto bg-sand">
      <div className="sticky top-0 z-10 flex items-center gap-2 bg-navy px-3 py-2 pt-[max(0.5rem,env(safe-area-inset-top))] text-sand">
        <p className="font-display text-lg">{maLabel(order.number)}</p>
        <CloseX onClick={onClose} label={t(lang, "close")} />
      </div>
      <div className="mx-auto max-w-lg space-y-3 px-4 py-4">
        <p className="font-display text-2xl text-navy">{order.product}</p>
        <p className="text-sm text-muted">
          {order.qty} {order.unit} · {job.name}
        </p>
        {live.phone ? (
          <p className="text-sm">
            {t(lang, "matPhone")}: {live.phone}
          </p>
        ) : null}
        {live.driverNote ? (
          <p className="text-sm whitespace-pre-wrap">
            {t(lang, "matDriver")}: {live.driverNote}
          </p>
        ) : null}
        <p className="text-sm">{order.spec}</p>
        {!order.inUdbud ? <p className="text-xs text-brick">{t(lang, "matNotInUdbud")}</p> : <p className="text-xs text-muted">{order.cite}</p>}
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">{t(lang, "matLines")}</p>
        <ul className="space-y-1">
          {rows.map((l, i) => (
            <li key={`${l.product}-${i}`} className="rounded-xl bg-paper px-3 py-2 text-sm shadow-card">
              {l.product || t(lang, "matFillSelf")} · {l.qty} {l.unit || "stk"}
              {l.spec ? <span className="mt-0.5 block text-xs text-muted">{l.spec}</span> : null}
              {!l.inUdbud ? <span className="mt-0.5 block text-xs text-brick">{t(lang, "matNotInUdbud")}</span> : <span className="mt-0.5 block text-xs text-muted">{t(lang, "matFromUdbud")}</span>}
            </li>
          ))}
        </ul>
        <LineEditor lang={lang} projectId={order.projectId} index={rows.length} line={extra} onChange={setExtra} folderName={`${ORDERS_FOLDER_NAME}/${maFolderName(order.number)}`} />
        <GhostButton
          className="bg-paper"
          onClick={() => {
            if (!extra.product.trim()) return;
            patchOrder(order.id, { lines: [...rows, extra] });
            setExtra(emptyLine());
          }}
        >
          {t(lang, "matAddLine")}
        </GhostButton>
        <p className="text-sm">
          {t(lang, "matDelivery")}: {order.deliveryAddress}
        </p>
        <p className="text-sm">
          {t(lang, "matDate")}: {order.expectedDate}
        </p>
        {order.warning ? <p className="text-sm text-brick">{order.warning}</p> : null}
        {receipts.map((r) => (
          <p key={r.id} className="text-xs text-muted">
            {r.source} · {r.match} · {r.photoFileIds.length} foto
            {r.warning ? ` · ${r.warning}` : ""}
          </p>
        ))}
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">{t(lang, "maDeliveryPhoto")}</p>
        <div className="flex flex-wrap gap-2">
          <GhostButton className="bg-sand" onClick={() => camRef.current?.click()}>
            <Camera className="mr-1 size-4" />
            {t(lang, "camera")}
          </GhostButton>
          <GhostButton className="bg-sand" onClick={() => galRef.current?.click()}>
            {t(lang, "gallery")}
          </GhostButton>
        </div>
        <input ref={camRef} type="file" accept="image/*" capture="environment" className="hidden" multiple onChange={(e) => void addDelivery(e.target.files)} />
        <input ref={galRef} type="file" accept="image/*" className="hidden" multiple onChange={(e) => void addDelivery(e.target.files)} />
        <div className="flex flex-wrap gap-2">
          <GhostButton className="bg-paper" onClick={() => void share("copy")}>
            {t(lang, "matCopyLink")}
          </GhostButton>
          <PrimaryButton onClick={() => void share("send")}>{t(lang, "matSendNow")}</PrimaryButton>
          <GhostButton className="bg-paper" onClick={() => void share("draft")}>
            {t(lang, "matSaveDraft")}
          </GhostButton>
        </div>
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">{t(lang, "matThread")}</p>
        <ul className="space-y-2">
          {(live.thread ?? []).map((m, i) => (
            <li key={`${m.at}-${i}`} className="rounded-xl bg-paper px-3 py-2 text-sm shadow-card">
              <p className="text-[11px] uppercase tracking-wide text-muted">
                {m.from === "leverandor" ? "Leverandør" : m.name || "Zenko"}
              </p>
              {master ? (
                <UserText original={maThreadOriginal(m)} translations={m.translations} lang="da" role={me?.role} className="mt-0.5 whitespace-pre-wrap" />
              ) : (
                <p className="mt-0.5 whitespace-pre-wrap">{shownMaThreadText(m, lang, me?.role)}</p>
              )}
            </li>
          ))}
        </ul>
        <textarea className="min-h-20 w-full rounded-xl bg-paper px-3 py-2 text-sm shadow-card" value={reply} onChange={(e) => setReply(e.target.value)} placeholder={t(lang, "matThreadPh")} />
        <GhostButton className="bg-paper" disabled={busyThread} onClick={() => void sendThread()}>
          Send
        </GhostButton>
        {master ? (
          <PrimaryButton
            onClick={() => {
              orderToKs(order.id);
              onClose();
            }}
          >
            {t(lang, "matMakeKs")}
          </PrimaryButton>
        ) : null}
        {master && order.todoId ? (
          <GhostButton
            className="bg-sand"
            onClick={() => {
              removeTodo(order.todoId!);
              if (order.needId) dismissNeed(order.needId);
            }}
          >
            {t(lang, "todoDelete")}
          </GhostButton>
        ) : null}
      </div>
    </div>
  );
}

function guessNab(brief: string) {
  const m = brief.match(/NAB[^\n.]{0,40}/i);
  return m ? m[0] : "";
}

function notifyMaShare(me: Employee, order: MaterialOrder, mode: "send" | "draft" | "copy", link: string) {
  const n = noticeForMaShare({
    orderId: order.id,
    projectId: order.projectId,
    fromId: me.id,
    number: maLabel(order.number),
    mode,
    link,
    employees: useYard.getState().employees,
  });
  if (n) useYard.getState().pushNotice(n);
}
