alter table slack_settings add column if not exists webhook_url text not null default '';
