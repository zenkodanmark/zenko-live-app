import { useState } from "react";
import { t } from "@/lib/i18n";
import { hasOriginal } from "@/lib/chat";
import { isMasterRole } from "@/lib/seed";
import type { Lang, Role } from "@/lib/types";

export function UserText({
  original,
  translations,
  lang,
  role,
  className,
  linkClass,
  originalHint,
}: {
  original: string;
  translations?: Partial<Record<Lang, string>>;
  lang: Lang;
  role?: Role;
  className?: string;
  linkClass?: string;
  originalHint?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const master = Boolean(role && isMasterRole(role));
  const shown = master ? (translations?.da ?? original) : (translations?.[lang] ?? translations?.da ?? original);
  const hasLang = Boolean(translations?.[lang]?.trim());
  const missing = Boolean(originalHint && !master && original.trim() && !hasLang);
  const showLink = !missing && hasOriginal(shown, original);
  return (
    <div>
      <p className={className}>{shown}</p>
      {missing ? <p className={linkClass ?? "mt-1 text-xs text-muted"}>{t(lang, "chatOriginalLink")}</p> : null}
      {showLink ? (
        <button type="button" className={linkClass ?? "mt-1 text-xs underline underline-offset-2"} onClick={() => setOpen((v) => !v)}>
          {t(lang, "chatOriginalLink")}
        </button>
      ) : null}
      {open ? <p className={`${className ?? "text-sm"} mt-1 opacity-80`}>{original}</p> : null}
    </div>
  );
}