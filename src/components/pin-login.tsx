import { useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { Avatar, Chip, Wordmark } from "@/components/zenko";
import { t, roleLabel, LANGS } from "@/lib/i18n";
import { acceptPin, destFor, employeeById, pinOf } from "@/lib/pin-enter";
import { EMPLOYEES, isMasterRole } from "@/lib/crew";
import type { Lang } from "@/lib/types";

function LoginHeader({ lang, title }: { lang: Lang; title?: string }) {
  return (
    <>
      <header className="bg-navy px-5 pb-5 pt-[max(1rem,env(safe-area-inset-top))] text-sand">
        <Wordmark light />
        <p className="mt-4 font-display text-3xl font-semibold tracking-tight text-sand">
          {title || t(lang, "loginTitle")}
        </p>
        <p className="mt-1.5 max-w-lg text-sm leading-relaxed text-sand/70">{t(lang, "loginHint")}</p>
      </header>
      <div className="h-1.5 bg-brick" />
    </>
  );
}

export function LoginSplash() {
  return (
    <main className="min-h-dvh bg-sand">
      <LoginHeader lang="da" />
      <section className="mx-auto max-w-lg px-4 py-5">
        <p className="text-sm text-muted">Åbner…</p>
      </section>
    </main>
  );
}

function PinPad({ empId, pin = "" }: { empId?: string; pin?: string }) {
  const nav = useNavigate();
  const [digits, setDigits] = useState(() => String(pin || "").replace(/\D/g, "").slice(0, 4));
  const [busy, setBusy] = useState(false);
  const pick = employeeById(empId);
  const lang: Lang = (pick?.language as Lang) || "da";
  const wrong = digits.length === 4 && !!pick && digits !== pinOf(pick);

  function go(nextId: string, code: string) {
    if (busy) return;
    const emp = employeeById(nextId);
    if (!emp) return;
    const ok = acceptPin(emp.id, code);
    if (!ok) return;
    setBusy(true);
    const dest = destFor(emp) as "/svend" | "/mester";
    void nav({ to: dest });
  }

  function tap(d: string) {
    if (busy || !pick) return;
    const next = (digits + d).replace(/\D/g, "").slice(0, 4);
    setDigits(next);
    if (next.length === 4 && next === pinOf(pick)) go(pick.id, next);
  }

  if (!pick) {
    return (
      <main className="relative z-20 min-h-dvh bg-sand">
        <LoginHeader lang="da" />
        <section className="relative z-20 mx-auto max-w-lg px-4 py-5">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.16em] text-muted">{t("da", "selectEmployee")}</p>
          <ul className="space-y-3">
            {EMPLOYEES.map((e) => (
              <li key={e.id}>
                <Link
                  to="/"
                  search={{ e: e.id }}
                  data-testid={`login-${e.id}`}
                  className="relative z-20 flex min-h-16 w-full cursor-pointer items-center gap-3 rounded-2xl bg-paper px-3 py-4 text-left shadow-card"
                >
                  <Avatar initials={e.initials} />
                  <span className="min-w-0 flex-1">
                    <span className="block font-display text-2xl text-navy">{e.name}</span>
                    <span className="text-sm text-muted">
                      {roleLabel(e.language, e.role)} · {LANGS.find((l) => l.id === e.language)?.native ?? e.language}
                    </span>
                  </span>
                  <Chip tone={isMasterRole(e.role) ? "brick" : "navy"} className="shrink-0">
                    {roleLabel(e.language, e.role)}
                  </Chip>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </main>
    );
  }

  return (
    <main className="relative z-20 flex min-h-dvh flex-col bg-sand">
      <header className="bg-navy px-5 py-3 pt-[max(0.75rem,env(safe-area-inset-top))] text-sand">
        <Link to="/" search={{}} className="text-sm font-semibold text-sand/80 underline">
          {t(lang, "back")}
        </Link>
        <p className="mt-2 font-display text-2xl font-semibold">{pick.name}</p>
        <p className="text-sm text-sand/70">Tast 4 cifre</p>
      </header>
      <div className="h-1.5 bg-brick" />
      <section className="relative z-20 mx-auto flex w-full max-w-lg flex-1 flex-col px-4 py-4">
        <div data-testid="pin-pad" className="flex flex-1 flex-col">
          <div className="mb-5 flex justify-center gap-4">
            {[0, 1, 2, 3].map((i) => (
              <span
                key={i}
                className={`size-4 rounded-full ${wrong ? "bg-brick" : i < digits.length ? "bg-navy" : "bg-line"}`}
              />
            ))}
          </div>
          {wrong ? (
            <p className="mb-3 text-center text-base text-brick">
              {t(lang, "pinWrong")}{" "}
              <button type="button" className="underline" onClick={() => setDigits("")}>
                Prøv igen
              </button>
            </p>
          ) : null}
          <div className="mx-auto grid w-full max-w-sm grid-cols-3 gap-3">
            {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
              <button
                key={d}
                type="button"
                data-testid={`pin-${d}`}
                disabled={busy}
                onClick={() => tap(d)}
                className="flex min-h-16 cursor-pointer items-center justify-center rounded-2xl bg-paper font-display text-3xl text-navy shadow-card disabled:opacity-60"
              >
                {d}
              </button>
            ))}
            <span />
            <button
              type="button"
              data-testid="pin-0"
              disabled={busy}
              onClick={() => tap("0")}
              className="flex min-h-16 cursor-pointer items-center justify-center rounded-2xl bg-paper font-display text-3xl text-navy shadow-card disabled:opacity-60"
            >
              0
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => setDigits((s) => s.slice(0, -1))}
              className="flex min-h-16 cursor-pointer items-center justify-center rounded-2xl bg-sand text-sm font-semibold text-muted"
            >
              {t(lang, "pinDelete")}
            </button>
          </div>
          <button
            type="button"
            data-testid="pin-submit"
            disabled={busy || digits.length !== 4 || !pick || digits !== pinOf(pick)}
            onClick={() => pick && go(pick.id, digits)}
            className="mt-auto mb-[max(1rem,env(safe-area-inset-bottom))] flex min-h-16 w-full cursor-pointer items-center justify-center rounded-2xl bg-brick font-display text-2xl text-sand disabled:bg-brick/40"
          >
            {busy ? "Åbner…" : "Log ind"}
          </button>
        </div>
      </section>
    </main>
  );
}

export function PinLogin({ empId, pin = "" }: { empId?: string; pin?: string }) {
  return <PinPad empId={empId} pin={pin} />;
}
