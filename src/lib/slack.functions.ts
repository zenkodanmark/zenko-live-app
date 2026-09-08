import { createServerFn } from "@tanstack/react-start";
import { saveSlackWebhook, sendSlack, setSlackOn, slackIsConfigured, slackIsOn } from "./slack-send.ts";

export const getSlackStatus = createServerFn({ method: "GET" }).handler(async () => {
  try {
    return { ok: true as const, configured: await slackIsConfigured(), enabled: await slackIsOn() };
  } catch {
    return { ok: false as const, configured: false, enabled: true };
  }
});

export const setSlackEnabled = createServerFn({ method: "POST" })
  .validator((input: { enabled: boolean }) => input)
  .handler(async ({ data }) => {
    try {
      await setSlackOn(Boolean(data.enabled));
      return { ok: true as const, enabled: Boolean(data.enabled) };
    } catch {
      return { ok: false as const, enabled: Boolean(data.enabled) };
    }
  });

export const setSlackWebhook = createServerFn({ method: "POST" })
  .validator((input: { url: string }) => input)
  .handler(async ({ data }) => {
    const saved = await saveSlackWebhook(data.url ?? "");
    return { ok: saved.ok, configured: saved.ok };
  });

export const sendSlackTest = createServerFn({ method: "POST" }).handler(async () => {
  if (!(await slackIsConfigured())) return { ok: false as const, sent: false, missing: true };
  const res = await sendSlack({
    title: "Zenko test",
    body: "Zenko test. Hvis du ser det her på telefonen, virker Slack.",
  });
  return { ok: res.ok, sent: res.ok, missing: false };
});
