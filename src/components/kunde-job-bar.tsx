import { SagPng } from "@/components/sag-icons";
import { t } from "@/lib/i18n";
import { kundePath, slugForProject } from "@/lib/ks-customer";
import { sagPath } from "@/lib/sag-ledelse";
import type { Lang, Project } from "@/lib/types";

export function KundeJobBar({ project, lang }: { project: Project; lang: Lang }) {
  const slug = slugForProject(project);
  const path = kundePath(slug);
  const sagHref = sagPath(slug);

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
        >
          <SagPng name="udfoersel" px={112} />
          <span className="text-center text-sm font-medium text-navy">{t(lang, "kundeBuild")}</span>
        </a>
      </div>
      <p className="mt-3 truncate text-xs text-muted">
        {path} · {sagHref}
      </p>
    </div>
  );
}
