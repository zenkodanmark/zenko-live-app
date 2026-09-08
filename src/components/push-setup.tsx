import { useEffect, useState } from "react";
import { Card, GhostButton, PrimaryButton } from "@/components/zenko";
import { readPushUser } from "@/lib/device-auth";
import { t } from "@/lib/i18n";
import { getPushPublicKey, savePushSub, sendTestPush, setPushEnabled } from "@/lib/push.functions";
import { isMasterRole } from "@/lib/seed";
import { useSessionEmployee } from "@/lib/store";
import type { Lang } from "@/lib/types";

const ENDPOINT_KEY = "zenko-push-endpoint";
const OFF_KEY = "zenko-push-off";

export function isStandalone() {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(display-mode: standalone)").matches || Boolean((window.navigator as Navigator & { standalone?: boolean }).standalone);
}

export function isIos() {
  if (typeof navigator === "undefined") return false;
  return /iPhone|iPad|iPod/i.test(navigator.userAgent);
}

function urlBase64ToUint8Array(base64: string) {
  const pad = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

export async function registerPushWorker() {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return null;
  try {
    return await navigator.serviceWorker.register("/sw.js", { scope: "/" });
  } catch {
    return null;
  }
}

export function PushBanner({ lang }: { lang: Lang }) {
  const [show, setShow] = useState(false);
  useEffect(() => {
    setShow(!isStandalone());
  }, []);
  if (!show) return null;
  return (
    <div className="mx-auto max-w-lg px-4 pt-3" data-testid="push-install-hint">
      <p className="rounded-xl bg-paper px-3 py-2 text-sm text-ink shadow-card">{t(lang, "pushInstallHint")}</p>
    </div>
  );
}

export function PushSetup({ lang }: { lang: Lang }) {
  const emp = useSessionEmployee();
  const [perm, setPerm] = useState("default");
  const [installed, setInstalled] = useState(false);
  const [on, setOn] = useState(true);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");

  useEffect(() => {
    setInstalled(isStandalone());
    if (typeof Notification !== "undefined") setPerm(Notification.permission);
    try {
      setOn(window.localStorage.getItem(OFF_KEY) !== "1");
    } catch {
      /* */
    }
    void registerPushWorker();
  }, []);

  useEffect(() => {
    if (!emp) return;
    void (async () => {
      if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;
      const reg = await navigator.serviceWorker.ready.catch(() => null);
      const sub = await reg?.pushManager.getSubscription();
      if (!sub) return;
      const raw = sub.toJSON();
      if (!raw.endpoint || !raw.keys?.p256dh) return;
      try {
        window.localStorage.setItem(ENDPOINT_KEY, raw.endpoint);
      } catch {
        /* */
      }
      await savePushSub({
        data: {
          endpoint: raw.endpoint,
          p256dh: raw.keys.p256dh,
          auth: raw.keys.auth ?? "",
          employeeId: emp.id,
          role: emp.role,
          enabled: window.localStorage.getItem(OFF_KEY) !== "1",
        },
      });
    })();
  }, [emp?.id]);

  const status = !installed ? t(lang, "pushStatusNeedInstall") : perm === "granted" ? t(lang, "pushStatusOn") : perm === "denied" ? t(lang, "pushStatusDenied") : t(lang, "pushStatusWait");

  async function allow() {
    if (!emp) return;
    setBusy(true);
    setNote("");
    try {
      if (typeof Notification === "undefined") {
        setNote(t(lang, "pushInstallHint"));
        return;
      }
      const next = await Notification.requestPermission();
      setPerm(next);
      if (next !== "granted") return;
      const ready = await registerPushWorker();
      if (!ready || !("pushManager" in ready)) {
        setNote(t(lang, "pushInstallHint"));
        return;
      }
      const reg = await navigator.serviceWorker.ready;
      const key = await getPushPublicKey();
      if (!key.ok || !key.key) {
        setNote(t(lang, "pushFail"));
        return;
      }
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(key.key),
      });
      const raw = sub.toJSON();
      const endpoint = raw.endpoint ?? "";
      const p256dh = raw.keys?.p256dh ?? "";
      const auth = raw.keys?.auth ?? "";
      await savePushSub({ data: { endpoint, p256dh, auth, employeeId: emp.id, role: emp.role, enabled: true } });
      try {
        window.localStorage.setItem(ENDPOINT_KEY, endpoint);
        window.localStorage.setItem(OFF_KEY, "0");
      } catch {
        /* */
      }
      setOn(true);
      setNote(t(lang, "pushOk"));
    } catch {
      setNote(t(lang, "pushFail"));
    } finally {
      setBusy(false);
    }
  }

  async function toggle(next: boolean) {
    setOn(next);
    try {
      window.localStorage.setItem(OFF_KEY, next ? "0" : "1");
      const endpoint = window.localStorage.getItem(ENDPOINT_KEY);
      if (endpoint) await setPushEnabled({ data: { endpoint, enabled: next } });
    } catch {
      /* */
    }
  }

  async function test() {
    if (!emp) return;
    setBusy(true);
    try {
      const res = await sendTestPush({ data: { employeeId: emp.id } });
      setNote(res.sent ? t(lang, "pushTestSent") : t(lang, "pushFail"));
    } catch {
      setNote(t(lang, "pushFail"));
    } finally {
      setBusy(false);
    }
  }

  void readPushUser;
  if (!emp) return null;
  return (
    <Card className="rounded-[20px]" data-testid="push-setup">
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">{t(lang, "pushTitle")}</p>
      <p className="mt-1 text-sm text-ink">{status}</p>
      {!installed ? <p className="mt-2 text-sm text-muted">{t(lang, "pushInstallHint")}</p> : null}
      <div className="mt-3 flex flex-wrap gap-2">
        {perm !== "granted" ? (
          <PrimaryButton disabled={busy} onClick={() => void allow()}>
            {t(lang, "noticeAllowBtn")}
          </PrimaryButton>
        ) : (
          <GhostButton className="bg-sand" onClick={() => void toggle(!on)}>
            {on ? t(lang, "pushOff") : t(lang, "pushOn")}
          </GhostButton>
        )}
        {isMasterRole(emp.role) && perm === "granted" ? (
          <GhostButton className="bg-sand" disabled={busy} onClick={() => void test()}>
            {t(lang, "pushTest")}
          </GhostButton>
        ) : null}
      </div>
      {note ? <p className="mt-2 text-xs text-muted">{note}</p> : null}
    </Card>
  );
}
