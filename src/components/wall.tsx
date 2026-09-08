import { SectionLabel } from "@/components/zenko";
import { t } from "@/lib/i18n";
import type { Lang } from "@/lib/types";

export function WallSection({ lang, projectId }: { lang: Lang; projectId?: string }) {
  const hillerod = projectId === "job-hillerodsholm";
  return (
    <div>
      <SectionLabel>{t(lang, "wallTitle")}</SectionLabel>
      <div className="overflow-hidden rounded-lg bg-sand-deep shadow-card">
        <div className="flex h-40">
          <div className="flex w-14 flex-col items-center justify-center bg-brick px-1 text-center">
            <span className="rotate-180 font-display text-xs font-semibold tracking-wide text-sand [writing-mode:vertical-rl]">
              {hillerod ? "Formur 360 mm" : t(lang, "wallBrick")}
            </span>
          </div>
          <div
            className="flex flex-1 flex-col items-center justify-center px-2 text-center"
            style={{
              backgroundImage:
                "repeating-linear-gradient(-45deg, color-mix(in oklab, var(--color-moss) 22%, var(--color-sand)), color-mix(in oklab, var(--color-moss) 22%, var(--color-sand)) 8px, var(--color-sand) 8px, var(--color-sand) 16px)",
            }}
          >
            <span className="font-display text-lg font-semibold text-navy">{hillerod ? "Hulmur · stenuld" : t(lang, "wallIso")}</span>
            <span className="mt-1 text-xs text-muted">{hillerod ? "λD=37 indblæst · KS 5.3" : "Rockwool Flexibatts · KS 3.1"}</span>
          </div>
          <div className="flex w-16 flex-col items-center justify-center bg-navy-mid px-1 text-center">
            <span className="rotate-180 font-display text-xs font-semibold tracking-wide text-sand [writing-mode:vertical-rl]">{t(lang, "wallInner")}</span>
          </div>
        </div>
        <p className="border-t border-line bg-paper px-3 py-2 text-xs text-muted">
          {hillerod
            ? "Eksisterende rød maskinsten, krydsforbandt. Hulmur 1.–2. sal. Indblæst stenuld λD=37. Bindere Ø4 rustfri min. 4/m². Omfugning KKh 35/65/500. K01_C08_002."
            : "Udefra: skalmur 108 mm · isolering · bagmur."}
        </p>
      </div>
    </div>
  );
}
