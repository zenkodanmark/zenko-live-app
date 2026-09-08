import { readFileSync } from "node:fs";
import { env } from "./env.server";

/** Server-only Incoming Webhook. Do not import from client components. Never hardcode the URL. */
export function slackIncomingWebhook(): string {
  const fromEnv = env("SLACK_WEBHOOK_URL") || "";
  if (fromEnv.startsWith("https://hooks.slack.com/")) return fromEnv;
  for (const file of ["/workspace/.local/slack-webhook", new URL("../../.local/slack-webhook", import.meta.url)]) {
    try {
      const v = readFileSync(file, "utf8").trim();
      if (v.startsWith("https://hooks.slack.com/")) return v;
    } catch {
      /* missing file is fine */
    }
  }
  return "";
}
