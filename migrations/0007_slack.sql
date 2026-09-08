-- Slack doorbell on/off. Webhook URL lives in SLACK_WEBHOOK_URL, never here.
create table if not exists slack_settings (
  id       text primary key,
  enabled  boolean not null default true
);
insert into slack_settings (id, enabled) values ('default', true)
  on conflict (id) do nothing;
