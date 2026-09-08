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
}: {
  original: string;
  translations?: Partial<Record<Lang, string>>;
  lang: Lang;
  role?: Role;
  className?: string;
  linkClass?: string;
}) {
  const [open, setOpen] = useState(false);
  const shown = role && isMasterRole(role)
    ? (translations?.da ?? original)
    : (translations?.[lang] ?? translations?.da ?? original);
  const showLink = hasOriginal(shown, original);
  return (
    <div>
      <p className={className}>{shown}</p>
      {showLink ? (
        <button type="button" className={linkClass ?? "mt-1 text-xs underline underline-offset-2"} onClick={() => setOpen((v) => !v)}>
          {t(lang, "chatOriginalLink")}
        </button>
      ) : null}
      {open ? <p className={`${className ?? "text-sm"} mt-1 opacity-80`}>{original}</p> : null}
    </div>
  );
}