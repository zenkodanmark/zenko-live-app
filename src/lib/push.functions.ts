import { createServerFn } from "@tanstack/react-start";
import { getSql } from "@/lib/db";
import { sendPush, vapidPublicKey } from "./push-send.ts";

export const getPushPublicKey = createServerFn({ method: "GET" }).handler(async () => {
  try {
    return { ok: true as const, key: await vapidPublicKey() };
  } catch {
    return { ok: false as const, key: "" };
  }
});

export const savePushSub = createServerFn({ method: "POST" })
  .validator((input: { endpoint: string; p256dh: string; auth: string; employeeId: string; role: string; enabled?: boolean }) => input)
  .handler(async ({ data }) => {
    if (!data.endpoint || !data.p256dh || !data.auth || !data.employeeId) return { ok: false as const };
    try {
      const sql = await getSql();
      await sql.query(
        `insert into push_subs (endpoint, p256dh, auth, employee_id, role, enabled, created_at)
         values ($1, $2, $3, $4, $5, $6, now())
         on conflict (endpoint) do update set p256dh = excluded.p256dh, auth = excluded.auth, employee_id = excluded.employee_id, role = excluded.role, enabled = excluded.enabled`,
        [data.endpoint, data.p256dh, data.auth, data.employeeId, data.role, data.enabled !== false],
      );
      return { ok: true as const };
    } catch {
      return { ok: false as const };
    }
  });

export const setPushEnabled = createServerFn({ method: "POST" })
  .validator((input: { endpoint: string; enabled: boolean }) => input)
  .handler(async ({ data }) => {
    try {
      const sql = await getSql();
      await sql.query("update push_subs set enabled = $2 where endpoint = $1", [data.endpoint, data.enabled]);
      return { ok: true as const };
    } catch {
      return { ok: false as const };
    }
  });

export const sendTestPush = createServerFn({ method: "POST" })
  .validator((input: { employeeId: string }) => input)
  .handler(async ({ data }) => {
    if (!data.employeeId) return { ok: false as const, sent: 0 };
    const res = await sendPush({
      kind: "test",
      title: "Ny to-do",
      body: "Test fra Zenko Plads. Push virker på denne telefon.",
      url: "/mester?open=todo",
      toIds: [data.employeeId],
    });
    return { ok: true as const, sent: res.sent };
  });
