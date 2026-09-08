import { useEffect, useRef, type ReactNode } from "react";
import { Chip, PrimaryButton } from "@/components/zenko";
import { t } from "@/lib/i18n";
import type { Lang } from "@/lib/types";

export type ChatLine = { who: "me" | "bot"; text: string; used?: string[] };

export function AssistChat({
  icon,
  title,
  status,
  hint,
  loginLabel,
  onLogin,
  messages,
  chips,
  placeholder,
  busy,
  busyText,
  value,
  onChange,
  onSend,
  footer,
  lang = "da",
}: {
  icon: ReactNode;
  title: string;
  status?: { label: string; tone?: "ok" | "sand" | "navy" };
  hint?: string;
  loginLabel?: string;
  onLogin?: () => void;
  messages: ChatLine[];
  chips: { label: string; q: string }[];
  placeholder: string;
  busy: boolean;
  busyText: string;
  value: string;
  onChange: (v: string) => void;
  onSend: (q?: string) => void;
  footer?: ReactNode;
  lang?: Lang;
}) {
  const scroller = useRef<HTMLDivElement>(null);
  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: "smooth" });
  }, [messages, busy]);

  return (
    <section className="overflow-hidden rounded-[20px] bg-paper shadow-card">
      <div className="flex items-start gap-2 bg-navy px-4 py-3 text-sand">
        <span className="mt-0.5">{icon}</span>
        <div className="min-w-0 flex-1">
          <p className="font-display text-xl tracking-wide">{title}</p>
          {hint ? <p className="text-xs text-sand/70">{hint}</p> : null}
        </div>
        {status ? <Chip tone={status.tone ?? "sand"}>{status.label}</Chip> : null}
      </div>
      {onLogin && loginLabel ? (
        <div className="px-3 pt-3">
          <PrimaryButton onClick={onLogin}>{loginLabel}</PrimaryButton>
        </div>
      ) : null}
      <div ref={scroller} className="max-h-72 space-y-2 overflow-y-auto px-3 py-3">
        {messages.map((m, i) => (
          <div key={`${m.who}-${i}`} className={m.who === "me" ? "ml-8" : "mr-6"}>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">{m.who === "me" ? t(lang, "you") : t(lang, "bot")}</p>
            <p className={`mt-1 whitespace-pre-wrap rounded-2xl px-3 py-2 text-sm leading-relaxed ${m.who === "me" ? "bg-navy text-sand" : "bg-sand text-ink"}`}>{m.text}</p>
            {m.used?.length ? <p className="mt-1 text-xs text-muted">{m.used.join(" · ")}</p> : null}
          </div>
        ))}
        {busy ? <p className="text-sm text-muted">{busyText}</p> : null}
      </div>
      <div className="flex flex-wrap gap-1.5 px-3">
        {chips.map((c) => (
          <button key={c.q} type="button" className="min-h-11 rounded-full bg-sand px-3 text-xs" onClick={() => onSend(c.q)}>
            {c.label}
          </button>
        ))}
      </div>
      <div className="flex gap-2 px-3 py-3">
        <textarea
          className="min-h-11 flex-1 rounded-xl bg-sand px-3 py-2 text-base"
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              onSend();
            }
          }}
        />
        <PrimaryButton className="self-end" disabled={busy} onClick={() => onSend()}>
          {t(lang, "chatSend")}
        </PrimaryButton>
      </div>
      {footer}
    </section>
  );
}
