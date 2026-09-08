import webpush from "web-push";
import { getSql } from "@/lib/db";
import { EMPLOYEES, isMasterRole } from "./seed.ts";

export type PushKind = "todo" | "chat" | "ks" | "checkin" | "checkout" | "test" | "ma";

type SubRow = { endpoint: string; p256dh: string; auth: string; employee_id: string; role: string; enabled: boolean };

async function vapid() {
  const sql = await getSql();
  const rows = await sql.query<{ public_key: string; private_key: string }>("select public_key, private_key from push_vapid where id = $1", ["default"]);
  if (rows[0]) return rows[0];
  const keys = webpush.generateVAPIDKeys();
  await sql.query(
    "insert into push_vapid (id, public_key, private_key) values ($1, $2, $3) on conflict (id) do nothing",
    ["default", keys.publicKey, keys.privateKey],
  );
  const again = await sql.query<{ public_key: string; private_key: string }>("select public_key, private_key from push_vapid where id = $1", ["default"]);
  return again[0] ?? { public_key: keys.publicKey, private_key: keys.privateKey };
}

export async function vapidPublicKey() {
  return (await vapid()).public_key;
}

export function masterEmployeeIds() {
  return EMPLOYEES.filter((e) => isMasterRole(e.role)).map((e) => e.id);
}

export async function sendPush(input: {
  kind: PushKind;
  title: string;
  body: string;
  url: string;
  toIds: string[];
  actorId?: string;
}) {
  const to = [...new Set(input.toIds.filter((id) => id && id !== input.actorId))];
  if (!to.length) return { sent: 0 };
  const sql = await getSql();
  const keys = await vapid();
  webpush.setVapidDetails("mailto:zenko.danmark@gmail.com", keys.public_key, keys.private_key);
  const subs = await sql.query<SubRow>(
    `select endpoint, p256dh, auth, employee_id, role, enabled from push_subs where enabled = true and employee_id in (${to.map((_, i) => `$${i + 1}`).join(",")})`,
    to,
  );
  const payload = JSON.stringify({
    title: input.title,
    body: input.body,
    url: input.url,
    tag: `${input.kind}-${Date.now()}`,
    kind: input.kind,
  });
  let sent = 0;
  for (const sub of subs) {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        payload,
        { TTL: 60 * 60 * 12 },
      );
      sent += 1;
    } catch (err) {
      const status = Number((err as { statusCode?: number }).statusCode ?? 0);
      if (status === 404 || status === 410) {
        await sql.query("delete from push_subs where endpoint = $1", [sub.endpoint]);
      }
    }
  }
  return { sent };
}
