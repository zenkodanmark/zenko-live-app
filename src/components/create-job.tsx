import { useState } from "react";
import { Card, GhostButton, PrimaryButton, SectionLabel } from "@/components/zenko";
import { t } from "@/lib/i18n";
import { createSagOnDrive } from "@/lib/sag-drive";
import { askGps } from "@/lib/geo";
import { reverseGeocode } from "@/lib/geo.functions";
import type { Lang } from "@/lib/types";

export function CreateJobForm({
  lang,
  createdBy,
  onDone,
  simple,
}: {
  lang: Lang;
  createdBy: string;
  onDone?: (id: string) => void;
  simple?: boolean;
}) {
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [client, setClient] = useState("");
  const [trade, setTrade] = useState("");
  const [period, setPeriod] = useState("");
  const [qualityManager, setQualityManager] = useState("");
  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [gpsBusy, setGpsBusy] = useState(false);
  const [note, setNote] = useState("");

  async function useGps() {
    if (gpsBusy) return;
    setGpsBusy(true);
    setNote(t(lang, "gpsFinding"));
    const ask = await askGps(20000);
    if (!ask.ok) {
      setGpsBusy(false);
      setNote(t(lang, "gpsFail"));
      return;
    }
    setLat(ask.fix.lat);
    setLng(ask.fix.lng);
    try {
      const geo = await reverseGeocode({ data: { lat: ask.fix.lat, lng: ask.fix.lng } });
      if (geo.ok && geo.address) setAddress(geo.address);
    } catch {
      /* adresse kan skrives i hånden */
    }
    setGpsBusy(false);
    setNote("");
  }

  return (
    <Card className="rounded-[20px]">
      <SectionLabel>{t(lang, simple ? "newJob" : "createSmallJob")}</SectionLabel>
      <label className="mt-2 block text-xs text-muted">
        {t(lang, "jobName")}
        <input
          className="mt-1 min-h-11 w-full rounded-lg bg-sand px-3 text-sm"
          value={name}
          onChange={(e) => setName(e.target.value)}
          data-testid="job-name"
        />
      </label>
      {simple ? null : (
        <label className="mt-2 block text-xs text-muted">
          {t(lang, "sagFieldClient")}
          <input className="mt-1 min-h-11 w-full rounded-lg bg-sand px-3 text-sm" value={client} onChange={(e) => setClient(e.target.value)} />
        </label>
      )}
      <label className="mt-2 block text-xs text-muted">
        {t(lang, "jobAddress")}
        <input
          className="mt-1 min-h-11 w-full rounded-lg bg-sand px-3 text-sm"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          placeholder={simple ? "" : undefined}
          data-testid="job-address"
        />
      </label>
      {simple ? null : (
        <>
      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        <label className="block text-xs text-muted">
          {t(lang, "sagFieldTrade")}
          <input className="mt-1 min-h-11 w-full rounded-lg bg-sand px-3 text-sm" value={trade} onChange={(e) => setTrade(e.target.value)} />
        </label>
        <label className="block text-xs text-muted">
          {t(lang, "sagFieldPeriod")}
          <input className="mt-1 min-h-11 w-full rounded-lg bg-sand px-3 text-sm" value={period} onChange={(e) => setPeriod(e.target.value)} />
        </label>
      </div>
      <label className="mt-2 block text-xs text-muted">
        {t(lang, "sagFieldQm")}
        <input className="mt-1 min-h-11 w-full rounded-lg bg-sand px-3 text-sm" value={qualityManager} onChange={(e) => setQualityManager(e.target.value)} />
      </label>
        </>
      )}
      <p className="mt-2 text-xs text-muted">{t(lang, "jobOpenToAll")}</p>
      <div className="mt-3 flex gap-2">
        <GhostButton data-testid="job-gps" disabled={gpsBusy} onClick={() => void useGps()}>
          {t(lang, "useMyGps")}
        </GhostButton>
        <PrimaryButton
          className="w-auto px-4"
          data-testid="job-save"
          disabled={!name.trim() || busy}
          onClick={async () => {
            const jobName = name.trim();
            if (!jobName) return;
            setBusy(true);
            setNote("");
            try {
              const res = await createSagOnDrive({
                name: jobName,
                address: address.trim(),
                lat: lat ?? 0,
                lng: lng ?? 0,
                createdBy,
                customer: client.trim(),
                trade: trade.trim(),
                period: period.trim(),
                qualityManager: qualityManager.trim(),
                lang,
              });
              if (!res.ok || !res.id) {
                setNote(t(lang, "saveFail"));
                return;
              }
              onDone?.(res.id);
            } catch {
              setNote(t(lang, "saveFail"));
            } finally {
              setBusy(false);
            }
          }}
        >
          {t(lang, "save")}
        </PrimaryButton>
      </div>
      {note ? <p className="mt-2 text-list leading-[1.4] text-ink" data-testid="job-gps-note">{note}</p> : null}
    </Card>
  );
}
