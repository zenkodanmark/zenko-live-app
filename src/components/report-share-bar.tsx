import { useEffect, useState, type MouseEvent } from "react";
import { GhostButton, PrimaryButton } from "@/components/zenko";
import { t } from "@/lib/i18n";
import { lookupProject, useYard } from "@/lib/store";
import { softrAsFieldItems } from "@/lib/softr-as";
import { softrKsPhotos } from "@/lib/softr-ks";
import {
  buildAsSharePayload,
  buildErSharePayload,
  buildKsSharePayload,
  buildTfShareReportPayload,
  reportMailCopy,
  publicReportUrl,
  shareSlug,
  type ReportSharePayload,
  type ShareKind,
} from "@/lib/report-share";
import { getReportShare, publishReportShare } from "@/lib/report-share.functions";
import { buildTfSharePayload, mailtoHref } from "@/lib/tf-share";
import { publishTfShare } from "@/lib/tf-share.functions";
import type { Entrepreneur, KsReport, Lang, Slip, Tf } from "@/lib/types";

function rowNumber(kind: ShareKind, id: string): string | null {
  const s = useYard.getState();
  const row =
    kind === "as"
      ? s.slips.find((x) => x.id === id)
      : kind === "tf"
        ? s.tfs.find((x) => x.id === id)
        : kind === "er"
          ? s.ents.find((x) => x.id === id)
          : s.ksReports.find((x) => x.id === id);
  return row?.number ?? null;
}

function customerUrl(kind: ShareKind, id: string) {
  const number = rowNumber(kind, id);
  if (!number) return null;
  return publicReportUrl(kind, number);
}

function payloadFor(kind: ShareKind, id: string): { payload: ReportSharePayload; slug: string } | null {
  const s = useYard.getState();
  const jobOf = (projectId: string) => lookupProject(projectId);
  const fields = [...softrAsFieldItems(), ...s.fieldItems];
  if (kind === "as") {
    const row = s.slips.find((x) => x.id === id);
    if (!row) return null;
    return { payload: buildAsSharePayload(row, jobOf(row.projectId), fields), slug: shareSlug(row.number) };
  }
  if (kind === "tf") {
    const row = s.tfs.find((x) => x.id === id);
    if (!row) return null;
    return { payload: buildTfShareReportPayload(row, jobOf(row.projectId), fields), slug: shareSlug(row.number) };
  }
  if (kind === "er") {
    const row = s.ents.find((x) => x.id === id);
    if (!row) return null;
    return { payload: buildErSharePayload(row, jobOf(row.projectId), fields), slug: shareSlug(row.number) };
  }
  const row = s.ksReports.find((x) => x.id === id);
  if (!row) return null;
  const photos = [...softrKsPhotos(), ...Object.values(s.days).flatMap((d) => d.photos ?? []), ...s.drivePhotos];
  return { payload: buildKsSharePayload(row, jobOf(row.projectId), photos), slug: shareSlug(row.number) };
}

async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.top = "0";
    ta.style.left = "0";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    try {
      return document.execCommand("copy");
    } catch {
      return false;
    } finally {
      ta.remove();
    }
  }
}

async function publish(kind: ShareKind, id: string) {
  const built = payloadFor(kind, id);
  if (!built) throw new Error("missing");
  const res = await publishReportShare({
    data: { kind, number: built.slug, reportId: built.payload.id, payload: built.payload },
  });
  if (!res.ok) throw new Error(res.error);
  if (kind === "tf") {
    const tf = useYard.getState().tfs.find((x) => x.id === id);
    if (tf) {
      const token = tf.shareToken || crypto.randomUUID();
      const job = lookupProject(tf.projectId);
      const fields = [...softrAsFieldItems(), ...useYard.getState().fieldItems];
      await publishTfShare({ data: { token, tfId: tf.id, payload: buildTfSharePayload(tf, job, fields) } });
      if (token !== tf.shareToken) useYard.getState().patchReport("tf", tf.id, { shareToken: token, status: "issued" });
    }
  }
  return { url: publicReportUrl(kind, built.slug), payload: built.payload };
}

export function ReportShareBar({ kind, id, lang }: { kind: ShareKind; id: string; lang: Lang }) {
  const patchReport = useYard((s) => s.patchReport);
  const answerTf = useYard((s) => s.answerTf);
  const tf = useYard((s) => (kind === "tf" ? s.tfs.find((x) => x.id === id) : undefined));
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const [copiedUrl, setCopiedUrl] = useState("");

  useEffect(() => {
    if (kind !== "tf" || !tf) return;
    const slug = shareSlug(tf.number);
    let live = true;
    void getReportShare({ data: { kind: "tf", number: slug } }).then((res) => {
      if (!live || !res.ok) return;
      if (res.share.answer && res.share.answer !== tf.answer) {
        answerTf(tf.id, res.share.answer);
        patchReport("tf", tf.id, { answeredBy: res.share.answeredBy, answeredAt: res.share.answeredAt ?? undefined });
      }
    });
    return () => {
      live = false;
    };
  }, [kind, tf?.id, tf?.number, tf?.answer, answerTf, patchReport]);

  async function copyLink() {
    const url = customerUrl(kind, id);
    if (!url) {
      setNote(t(lang, "tfShareFail"));
      return;
    }
    setBusy(true);
    setNote("");
    try {
      const copied = await copyText(url);
      setCopiedUrl(url);
      setNote(copied ? t(lang, "tfShareCopied") : t(lang, "tfShareShowUrl"));
      void publish(kind, id).catch(() => {});
    } catch {
      setCopiedUrl(url);
      setNote(t(lang, "tfShareShowUrl"));
    } finally {
      setBusy(false);
    }
  }

  async function copyMail() {
    const url = customerUrl(kind, id);
    if (!url) {
      setNote(t(lang, "tfShareFail"));
      return;
    }
    setBusy(true);
    setNote("");
    try {
      const built = payloadFor(kind, id);
      const mail = reportMailCopy(built?.payload ?? { kind, id, number: rowNumber(kind, id) ?? "", createdAt: "", projectName: "", address: "", customer: "", title: "", body: "", location: "", extra: {}, photos: [] }, url);
      const copied = await copyText(`${mail.subject}\n\n${mail.body}`);
      setCopiedUrl(url);
      setNote(copied ? t(lang, "tfShareMailCopied") : t(lang, "tfShareShowUrl"));
      void publish(kind, id).catch(() => {});
    } catch {
      setCopiedUrl(url);
      setNote(t(lang, "tfShareShowUrl"));
    } finally {
      setBusy(false);
    }
  }

  async function openMail() {
    const url = customerUrl(kind, id);
    if (!url) {
      setNote(t(lang, "tfShareFail"));
      return;
    }
    setBusy(true);
    setNote("");
    try {
      const built = payloadFor(kind, id);
      const mail = reportMailCopy(built?.payload ?? { kind, id, number: rowNumber(kind, id) ?? "", createdAt: "", projectName: "", address: "", customer: "", title: "", body: "", location: "", extra: {}, photos: [] }, url);
      window.location.href = mailtoHref(mail);
      setCopiedUrl(url);
      setNote(t(lang, "tfShareMailOpened"));
      void publish(kind, id).catch(() => {});
    } catch {
      setNote(t(lang, "tfShareFail"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
      <PrimaryButton className="w-auto px-4 text-base" disabled={busy} onClick={() => void copyLink()}>
        {busy ? t(lang, "tfShareBusy") : t(lang, "tfShareLink")}
      </PrimaryButton>
      <PrimaryButton tone="sand" className="w-auto px-4 text-base" disabled={busy} onClick={() => void copyMail()}>
        {t(lang, "tfShareMail")}
      </PrimaryButton>
      <GhostButton className="text-sand" disabled={busy} onClick={() => void openMail()}>
        {t(lang, "tfShareOpenMail")}
      </GhostButton>
      {copiedUrl ? (
        <a href={copiedUrl} className="max-w-[min(100%,22rem)] truncate text-xs text-sand underline" data-share-url={copiedUrl} target="_blank" rel="noreferrer">
          {copiedUrl.replace(/^https?:\/\//, "")}
        </a>
      ) : note ? (
        <span className="text-xs text-sand">{note}</span>
      ) : (
        <span className="text-xs text-sand/70">{t(lang, "tfShareHint")}</span>
      )}
      {note && copiedUrl ? <span className="text-xs text-sand">{note}</span> : null}
    </div>
  );
}

export function ReportShareChip({ kind, id, lang }: { kind: ShareKind; id: string; lang: Lang }) {
  const [busy, setBusy] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState("");

  async function copy(e: MouseEvent) {
    e.stopPropagation();
    if (busy) return;
    const url = customerUrl(kind, id);
    if (!url) {
      useYard.setState({ toast: t(lang, "tfShareFail") });
      return;
    }
    setBusy(true);
    try {
      const copied = await copyText(url);
      setCopiedUrl(url);
      useYard.setState({ toast: copied ? t(lang, "tfShareCopied") : url });
      void publish(kind, id).catch(() => {});
    } catch {
      setCopiedUrl(url);
      useYard.setState({ toast: url });
    } finally {
      setBusy(false);
    }
  }

  return (
    <button type="button" className="shrink-0 rounded-full bg-navy px-3 py-1.5 text-action font-medium text-sand" data-share-url={copiedUrl || undefined} onClick={(e) => void copy(e)}>
      {busy ? "…" : t(lang, "tfShareLink")}
    </button>
  );
}

export function TfShareChip({ tf, lang }: { tf: Tf; lang: Lang }) {
  return <ReportShareChip kind="tf" id={tf.id} lang={lang} />;
}

export function AsShareChip({ slip, lang }: { slip: Slip; lang: Lang }) {
  return <ReportShareChip kind="as" id={slip.id} lang={lang} />;
}

export function ErShareChip({ ent, lang }: { ent: Entrepreneur; lang: Lang }) {
  return <ReportShareChip kind="er" id={ent.id} lang={lang} />;
}

export function KsShareChip({ report, lang }: { report: KsReport; lang: Lang }) {
  return <ReportShareChip kind="ks" id={report.id} lang={lang} />;
}
