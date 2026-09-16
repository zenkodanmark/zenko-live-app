import { useEffect, useState } from "react";
import { SagPng } from "@/components/sag-icons";
import { t } from "@/lib/i18n";
import { kundePath, slugForProject } from "@/lib/ks-customer";
import { ensureLedelsePin, isFourPin, ledelseClipboard, ledelsePublicUrl, normalizePin } from "@/lib/ledelse-pin";
import { sagPath } from "@/lib/sag-ledelse";
import { pullProjects } from "@/lib/sb-live";
import { useYard } from "@/lib/store";
import { mergeById } from "@/lib/yard-slim";
import type { Lang, Project } from "@/lib/types";

export function KundeJobBar({ project, lang }: { project: Project; lang: Lang }) {
  const slug = slugForProject(project);
  const path = kundePath(slug);
  const sagHref = ledelsePublicUrl(slug);
  const patchProject = useYard((s) => s.patchProject);
  const live = useYard((s) => s.projects.find((p) => p.id === project.id)) ?? project;
  const [pin, setPin] = useState(live.ledelsePin ?? "");
  const [copied, setCopied] = useState("");
  const [note, setNote] = useState("");

  useEffect(() => {
    setPin(live.ledelsePin ?? "");
  }, [live.ledelsePin]);

  useEffect(() => {
    let livePull = true;
    void pullProjects().then((rows) => {
      if (!livePull || !rows?.length) return;
      const s = useYard.getState();
      useYard.setState({ projects: mergeById(s.projects, rows as Project[]) });
    });
    return () => {
      livePull = false;
    };
  }, [project.id]);

  function takePin() {
    const fromStore = useYard.getState().projects.find((p) => p.id === project.id)?.ledelsePin;
    const existing = fromStore || live.ledelsePin || pin;
    if (isFourPin(existing)) {
      const code = normalizePin(existing);
      setPin(code);
      return code;
    }
    const code = ensureLedelsePin("");
    patchProject(project.id, { ledelsePin: code });
    setPin(code);
    return code;
  }

  function savePin(next: string) {
    const value = normalizePin(next);
    setPin(value);
    if (isFourPin(value) && value !== (live.ledelsePin ?? "")) {
      patchProject(project.id, { ledelsePin: value });
    }
  }

  async function copyLink() {
    const rows = await pullProjects();
    if (rows?.length) {
      const s = useYard.getState();
      useYard.setState({ projects: mergeById(s.projects, rows as Project[]) });
    }
    const code = takePin();
    const text = ledelseClipboard(live.name, slug, code);
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      /* iframe */
    }
    setCopied(text);
    setNote("Kopieret");
  }

  return (
    <div className="rounded-[20px] bg-paper px-4 py-4 shadow-card">
      <div className="flex gap-6">
        <a
          href={path}
          target="_blank"
          rel="noreferrer"
          className="flex w-[128px] flex-col items-center gap-2"
          data-testid="kunde-aflevering"
        >
          <SagPng name="aflevering" px={112} />
          <span className="text-center text-sm font-medium text-navy">{t(lang, "kundeHandover")}</span>
        </a>
        <a
          href={sagHref}
          target="_blank"
          rel="noreferrer"
          className="flex w-[128px] flex-col items-center gap-2"
          data-testid="kunde-udfoersel"
          onClick={() => takePin()}
        >
          <SagPng name="udfoersel" px={112} />
          <span className="text-center text-sm font-medium text-navy">{t(lang, "kundeBuild")}</span>
        </a>
      </div>
      <p className="mt-3 truncate text-xs text-muted">
        {path} · {sagPath(slug)}
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => void copyLink()}
          className="min-h-11 rounded-full bg-navy px-4 text-sm font-semibold text-sand"
          data-testid="copy-ledelse-link"
          data-clip={copied}
        >
          Kopiér link
        </button>
        {isFourPin(pin) ? (
          <p className="font-display text-xl tracking-[0.18em] text-navy" data-testid="ledelse-pin-code">
            Kode {pin}
          </p>
        ) : null}
      </div>
      <label className="mt-3 block">
        <span className="text-xs font-semibold tracking-wide text-muted uppercase">Byggeleder-kode</span>
        <input
          className="mt-1 min-h-11 w-full rounded-xl bg-sand px-3 font-display text-xl tracking-[0.3em] outline-none"
          inputMode="numeric"
          maxLength={4}
          placeholder="----"
          value={pin}
          onChange={(e) => savePin(e.target.value)}
          data-testid="ledelse-pin-field"
        />
      </label>
      {note ? <p className="mt-1 text-xs text-muted">{note}</p> : null}
    </div>
  );
}