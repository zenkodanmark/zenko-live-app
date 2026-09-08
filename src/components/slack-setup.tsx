import { useEffect, useState } from "react";
import { Card, GhostButton, PrimaryButton } from "@/components/zenko";
import { t } from "@/lib/i18n";
import { isMasterRole } from "@/lib/seed";
import { getSlackStatus, sendSlackTest, setSlackEnabled, setSlackWebhook } from "@/lib/slack.functions";
import { useSessionEmployee } from "@/lib/store";
import type { Lang } from "@/lib/types";

export function SlackSetup({ lang }: { lang: Lang }) {
  const emp = useSessionEmployee();
  const [on, setOn] = useState(true);
  const [configured, setConfigured] = useState(false);
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");

  useEffect(() => {
    void getSlackStatus().then((s) => {
      setConfigured(s.configured);
      setOn(s.enabled);
    });
  }, []);

  if (!emp || !isMasterRole(emp.role)) return null;

  async function saveUrl() {
    setBusy(true);
    setNote("");
    try {
      const res = await setSlackWebhook({ data: { url } });
      setUrl("");
      if (res.ok) {
        setConfigured(true);
        setOn(true);
        setNote(t(lang, "slackSaved"));
      } else setNote(t(lang, "slackBadUrl"));
    } catch {
      setNote(t(lang, "slackFail"));
    } finally {
      setBusy(false);
    }
  }

  async function toggle(next: boolean) {
    setOn(next);
    setBusy(true);
    try {
      await setSlackEnabled({ data: { enabled: next } });
    } catch {
      setOn(!next);
    } finally {
      setBusy(false);
    }
  }

  async function test() {
    setBusy(true);
    setNote("");
    try {
      const res = await sendSlackTest();
      if (res.missing) setNote(t(lang, "slackMissing"));
      else setNote(res.sent ? t(lang, "slackTestSent") : t(lang, "slackFail"));
    } catch {
      setNote(t(lang, "slackFail"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="rounded-[20px]">
      <div data-testid="slack-setup">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">{t(lang, "slackTitle")}</p>
        <p className="mt-1 text-sm text-muted">{t(lang, "slackHint")}</p>
        <p className="mt-2 text-sm text-ink">{configured ? t(lang, "slackConfigured") : t(lang, "slackMissing")}</p>
        <label className="mt-3 block text-xs text-muted">
          {t(lang, "slackUrl")}
          <input
            type="password"
            autoComplete="off"
            className="mt-1 min-h-11 w-full rounded-xl bg-sand px-3 text-sm"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://hooks.slack.com/…"
          />
        </label>
        <div className="mt-3 flex flex-wrap gap-2">
          <PrimaryButton disabled={busy || !url.trim()} onClick={() => void saveUrl()}>
            {t(lang, "slackSave")}
          </PrimaryButton>
          <GhostButton className="bg-sand" disabled={busy || !configured} onClick={() => void toggle(!on)}>
            {on ? t(lang, "slackOff") : t(lang, "slackOn")}
          </GhostButton>
          <GhostButton className="bg-sand" disabled={busy || !configured || !on} onClick={() => void test()}>
            {t(lang, "slackTest")}
          </GhostButton>
        </div>
        {note ? <p className="mt-2 text-xs text-muted">{note}</p> : null}
      </div>
    </Card>
  );
}
