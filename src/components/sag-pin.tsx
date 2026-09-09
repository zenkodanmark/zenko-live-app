import { useEffect, useState, type ReactNode } from "react";
import { SagShell } from "@/components/sag-shell";
import { isFourPin, isLedelseUnlocked, normalizePin, writeSessionPin } from "@/lib/ledelse-pin";
import { pullProjects } from "@/lib/sb-live";
import { useYard } from "@/lib/store";
import { mergeById } from "@/lib/yard-slim";
import type { Project } from "@/lib/types";

export function SagPinGate({
  slug,
  projectId,
  children,
}: {
  slug: string;
  projectId: string;
  children: ReactNode;
}) {
  const projects = useYard((s) => s.projects);
  const project = projects.find((p) => p.id === projectId);
  const pin = project?.ledelsePin ?? "";
  const [digits, setDigits] = useState("");
  const [unlocked, setUnlocked] = useState(() => isLedelseUnlocked(slug, pin));
  const [wrong, setWrong] = useState(false);

  useEffect(() => {
    let live = true;
    void pullProjects().then((rows) => {
      if (!live || !rows?.length) return;
      const s = useYard.getState();
      useYard.setState({ projects: mergeById(s.projects, rows as Project[]) });
    });
    return () => {
      live = false;
    };
  }, [slug]);

  useEffect(() => {
    if (isLedelseUnlocked(slug, pin)) setUnlocked(true);
  }, [slug, pin]);

  function tryUnlock(next: string) {
    const typed = normalizePin(next);
    if (typed.length < 4) {
      setWrong(false);
      return;
    }
    if (isFourPin(pin) && typed === pin) {
      writeSessionPin(slug, typed);
      setUnlocked(true);
      setWrong(false);
      return;
    }
    setWrong(true);
  }

  function tap(d: string) {
    const next = (digits + d).replace(/\D/g, "").slice(0, 4);
    setDigits(next);
    if (next.length === 4) tryUnlock(next);
  }

  if (unlocked) return <>{children}</>;

  return (
    <SagShell>
      <div data-testid="sag-pin-gate" className="rounded-[24px] bg-paper px-4 py-5 shadow-card">
        <p className="font-display text-3xl text-navy">Kode</p>
        <p className="mt-1 text-sm text-muted">Tast 4 cifre for at åbne byggeledelse.</p>
        <div className="mt-5 mb-4 flex justify-center gap-4">
          {[0, 1, 2, 3].map((i) => (
            <span
              key={i}
              className={`size-4 rounded-full ${wrong ? "bg-brick" : i < digits.length ? "bg-navy" : "bg-line"}`}
            />
          ))}
        </div>
        {wrong ? (
          <p className="mb-3 text-center text-base text-brick" data-testid="sag-pin-wrong">
            Forkert kode.{" "}
            <button type="button" className="underline" onClick={() => { setDigits(""); setWrong(false); }}>
              Prøv igen
            </button>
          </p>
        ) : null}
        <input
          className="mb-4 min-h-11 w-full rounded-xl bg-sand px-3 text-center font-display text-2xl tracking-[0.4em] outline-none"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={4}
          value={digits}
          onChange={(e) => {
            const next = normalizePin(e.target.value);
            setDigits(next);
            if (next.length === 4) tryUnlock(next);
            else setWrong(false);
          }}
          data-testid="sag-pin-input"
          aria-label="Byggeleder-kode"
        />
        <div className="mx-auto grid w-full max-w-sm grid-cols-3 gap-3" data-testid="sag-pin-pad">
          {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
            <button
              key={d}
              type="button"
              data-testid={`sag-pin-${d}`}
              onClick={() => tap(d)}
              className="flex min-h-16 items-center justify-center rounded-2xl bg-sand font-display text-3xl text-navy"
            >
              {d}
            </button>
          ))}
          <span />
          <button
            type="button"
            data-testid="sag-pin-0"
            onClick={() => tap("0")}
            className="flex min-h-16 items-center justify-center rounded-2xl bg-sand font-display text-3xl text-navy"
          >
            0
          </button>
          <button
            type="button"
            data-testid="sag-pin-go"
            onClick={() => tryUnlock(digits)}
            className="flex min-h-16 items-center justify-center rounded-2xl bg-navy font-display text-lg text-sand"
          >
            OK
          </button>
        </div>
      </div>
    </SagShell>
  );
}
