import { slackIncomingWebhook } from "./slack-hook.server.ts";
import { getSql } from "@/lib/db";

function envWebhook() {
  return (typeof process !== "undefined" ? process.env.SLACK_WEBHOOK_URL : "")?.trim() || "";
}

function isSlackHook(url: string) {
  return url.startsWith("https://hooks.slack.com/");
}

async function resolveWebhook() {
  const env = envWebhook();
  if (isSlackHook(env)) return env;
  if (typeof window === "undefined") {
    const file = slackIncomingWebhook();
    if (isSlackHook(file)) return file;
  }
  try {
    const sql = await getSql();
    const rows = await sql.query<{ webhook_url: string }>("select webhook_url from slack_settings where id = $1", ["default"]);
    const db = (rows[0]?.webhook_url ?? "").trim();
    return isSlackHook(db) ? db : "";
  } catch {
    return "";
  }
}

export async function slackIsConfigured() {
  return Boolean(await resolveWebhook());
}

export async function slackIsOn() {
  try {
    const sql = await getSql();
    const rows = await sql.query<{ enabled: boolean }>("select enabled from slack_settings where id = $1", ["default"]);
    if (!rows[0]) return true;
    return Boolean(rows[0].enabled);
  } catch {
    return true;
  }
}

export async function setSlackOn(enabled: boolean) {
  const sql = await getSql();
  await sql.query(
    "insert into slack_settings (id, enabled) values ($1, $2) on conflict (id) do update set enabled = excluded.enabled",
    ["default", enabled],
  );
}

export async function saveSlackWebhook(url: string) {
  const clean = url.trim();
  if (!isSlackHook(clean)) return { ok: false as const };
  const sql = await getSql();
  await sql.query(
    `insert into slack_settings (id, enabled, webhook_url) values ($1, true, $2)
     on conflict (id) do update set webhook_url = excluded.webhook_url, enabled = true`,
    ["default", clean],
  );
  return { ok: true as const };
}

/** Incoming Webhook. Never throw. Never log the URL. Never return the URL. */
export async function sendSlack(input: { title: string; body: string }) {
  const title = input.title.trim();
  const body = input.body.trim();
  if (!title || !body) return { ok: false as const };
  const url = await resolveWebhook();
  if (!url) return { ok: false as const };
  try {
    if (!(await slackIsOn())) return { ok: false as const };
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: `*${title}*\n${body}` }),
    });
    if (!res.ok) {
      console.error("slack webhook status", res.status);
      return { ok: false as const };
    }
    return { ok: true as const };
  } catch (err) {
    console.error("slack webhook", err instanceof Error ? err.message : "fail");
    return { ok: false as const };
  }
}
