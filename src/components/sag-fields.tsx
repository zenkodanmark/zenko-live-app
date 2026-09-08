import { useState } from "react";
import { Card, GhostButton } from "@/components/zenko";
import { ActionPng } from "@/components/sag-icons";
import { t } from "@/lib/i18n";
import { slugForProject } from "@/lib/ks-customer";
import { sagJobMeta } from "@/lib/sag-ledelse";
import { saveSagFields } from "@/lib/sag-ledelse.functions";
import { useYard } from "@/lib/store";
import type { Lang, Project } from "@/lib/types";

export function SagFields({ project, lang }: { project: Project; lang: Lang }) {
  const patchProject = useYard((s) => s.patchProject);
  const meta = sagJobMeta(project);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(project.name);
  const [client, setClient] = useState(project.customer ?? meta.client);
  const [address, setAddress] = useState(project.address);
  const [trade, setTrade] = useState(project.trade ?? meta.trade);
  const [period, setPeriod] = useState(project.period ?? meta.period);
  const [qualityManager, setQualityManager] = useState(project.qualityManager ?? meta.qualityManager);
  const [note, setNote] = useState("");

  function save() {
    const fields = {
      name: name.trim(),
      client: client.trim(),
      address: address.trim(),
      trade: trade.trim(),
      period: period.trim(),
      qualityManager: qualityManager.trim(),
    };
    patchProject(project.id, {
      name: fields.name || project.name,
      customer: fields.client,
      address: fields.address,
      trade: fields.trade,
      period: fields.period,
      qualityManager: fields.qualityManager,
    });
    void saveSagFields({
      data: {
        slug: slugForProject({ ...project, name: fields.name || project.name }),
        projectId: project.id,
        fields,
      },
    });
    setNote(t(lang, "sagFieldsSaved"));
  }

  return (
    <Card className="rounded-[20px]">
      <button type="button" className="flex w-full items-center gap-3 text-left" onClick={() => setOpen((v) => !v)} data-testid="sager-edit">
        <ActionPng name="sagerPencil" px={64} />
        <span className="font-display text-2xl text-navy">{t(lang, "editShort")}</span>
        <span className="ml-auto text-sm text-muted">{open ? "–" : "+"}</span>
      </button>
      {open ? (
        <>
          <p className="mt-1 text-sm text-muted">{t(lang, "sagFieldsHint")}</p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <Field label={t(lang, "jobName")} value={name} onChange={setName} />
            <Field label={t(lang, "sagFieldClient")} value={client} onChange={setClient} />
            <Field label={t(lang, "jobAddress")} value={address} onChange={setAddress} />
            <Field label={t(lang, "sagFieldTrade")} value={trade} onChange={setTrade} />
            <Field label={t(lang, "sagFieldPeriod")} value={period} onChange={setPeriod} />
            <Field label={t(lang, "sagFieldQm")} value={qualityManager} onChange={setQualityManager} />
          </div>
          <GhostButton className="mt-3 rounded-full bg-sand px-4" onClick={save}>
            {t(lang, "save")}
          </GhostButton>
          {note ? <p className="mt-2 text-xs text-muted">{note}</p> : null}
        </>
      ) : null}
    </Card>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="block text-xs text-muted">
      {label}
      <input className="mt-1 min-h-11 w-full rounded-lg bg-sand px-3 text-sm text-navy" value={value} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}
