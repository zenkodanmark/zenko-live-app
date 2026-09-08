import { useEffect, useState } from "react";
import { Avatar, Chip, Wordmark } from "@/components/zenko";
import { t, roleLabel, LANGS } from "@/lib/i18n";
import { acceptPin, destFor, employeeById, pinOf } from "@/lib/pin-enter";
import { EMPLOYEES, isMasterRole } from "@/lib/seed";
import { useYard } from "@/lib/store";
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

export function useYardReady() {
  const [ready, setReady] = useState(() => {
    try {
      return useYard.persist.hasHydrated();
    } catch {
      return true;
    }
  });
  useEffect(() => {
    try {
      if (useYard.persist.hasHydrated()) {
        setReady(true);
        return;
      }
      const unsub = useYard.persist.onFinishHydration(() => setReady(true));
      const wait = window.setTimeout(() => setReady(true), 400);
      return () => {
        unsub();
        window.clearTimeout(wait);
      };
    } catch {
      setReady(true);
    }
  }, []);
  return ready;
}

export function PinLogin({ empId, pin = "" }: { empId?: string; pin?: string }) {
  const pick = employeeById(empId);
  const digits = String(pin).replace(/\D/g, "").slice(0, 4);
  const lang: Lang = (pick?.language as Lang) || "da";
  const wrong = digits.length === 4 && !!pick && digits !== pinOf(pick);

  if (!pick) {
    return (
      <main className="relative z-20 min-h-dvh bg-sand">
        <LoginHeader lang="da" />
        <section className="relative z-20 mx-auto max-w-lg px-4 py-5">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.16em] text-muted">{t("da", "selectEmployee")}</p>
          <ul className="space-y-3">
            {EMPLOYEES.map((e) => (
              <li key={e.id}>
                <a
                  href={`/?e=${encodeURIComponent(e.id)}`}
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
                </a>
              </li>
            ))}
          </ul>
        </section>
      </main>
    );
  }

  const dest = destFor(pick);
  const enterHref = `${dest}?e=${encodeURIComponent(pick.id)}&p=${encodeURIComponent(digits)}`;
  const good = digits.length === 4 && digits === pinOf(pick);

  useEffect(() => {
    if (!good || !pick) return;
    acceptPin(pick.id, digits);
    window.location.href = enterHref;
  }, [good, pick, digits, enterHref]);

  return (
    <main className="relative z-20 flex min-h-dvh flex-col bg-sand">
      <header className="bg-navy px-5 py-3 pt-[max(0.75rem,env(safe-area-inset-top))] text-sand">
        <a href="/" className="text-sm font-semibold text-sand/80 underline">
          {t(lang, "back")}
        </a>
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
              <a className="underline" href={`/?e=${encodeURIComponent(pick.id)}`}>
                Prøv igen
              </a>
            </p>
          ) : null}
          <div className="mx-auto grid w-full max-w-sm grid-cols-3 gap-3">
            {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
              <a
                key={d}
                href={`/?e=${encodeURIComponent(pick.id)}&pin=${encodeURIComponent(digits + d)}`}
                data-testid={`pin-${d}`}
                className="flex min-h-16 cursor-pointer items-center justify-center rounded-2xl bg-paper font-display text-3xl text-navy shadow-card"
              >
                {d}
              </a>
            ))}
            <span />
            <a
              href={`/?e=${encodeURIComponent(pick.id)}&pin=${encodeURIComponent(digits + "0")}`}
              data-testid="pin-0"
              className="flex min-h-16 cursor-pointer items-center justify-center rounded-2xl bg-paper font-display text-3xl text-navy shadow-card"
            >
              0
            </a>
            <a
              href={`/?e=${encodeURIComponent(pick.id)}&pin=${encodeURIComponent(digits.slice(0, -1))}`}
              className="flex min-h-16 cursor-pointer items-center justify-center rounded-2xl bg-sand text-sm font-semibold text-muted"
            >
              {t(lang, "pinDelete")}
            </a>
          </div>
          {good ? (
            <a
              href={enterHref}
              data-testid="pin-submit"
              className="mt-auto mb-[max(1rem,env(safe-area-inset-bottom))] flex min-h-16 w-full cursor-pointer items-center justify-center rounded-2xl bg-brick font-display text-2xl text-sand"
            >
              Log ind
            </a>
          ) : (
            <div
              data-testid="pin-submit"
              className="mt-auto mb-[max(1rem,env(safe-area-inset-bottom))] flex min-h-16 w-full items-center justify-center rounded-2xl bg-brick/40 font-display text-2xl text-sand"
            >
              Log ind
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
