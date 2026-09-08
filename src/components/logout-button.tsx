import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { GhostButton, PrimaryButton } from "@/components/zenko";
import { performLogout } from "@/lib/device-auth";
import { t } from "@/lib/i18n";
import { useYard } from "@/lib/store";
import type { Lang } from "@/lib/types";

export function LogoutButton({
  lang,
  className,
  full,
  link,
}: {
  lang: Lang;
  className?: string;
  full?: boolean;
  link?: boolean;
}) {
  const nav = useNavigate();
  const logout = useYard((s) => s.logout);
  const [ask, setAsk] = useState(false);

  function yes() {
    setAsk(false);
    performLogout(logout, () => void nav({ to: "/" }));
  }

  return (
    <>
      {full ? (
        <PrimaryButton tone="navy" className={className} data-testid="logout-open" onClick={() => setAsk(true)}>
          {t(lang, "logOut")}
        </PrimaryButton>
      ) : link ? (
        <button
          type="button"
          className={`min-h-11 shrink-0 px-2 text-base font-semibold text-sand underline underline-offset-4 ${className ?? ""}`}
          data-testid="logout-open"
          onClick={() => setAsk(true)}
        >
          {t(lang, "logOut")}
        </button>
      ) : (
        <button
          type="button"
          className={className}
          data-testid="logout-open"
          aria-label={t(lang, "logOut")}
          onClick={() => setAsk(true)}
        >
          <img src="/icons/action/logout.png" alt="" width={40} height={40} className="size-10 object-contain" draggable={false} />
        </button>
      )}
      {ask ? (
        <div className="fixed inset-0 z-[90] flex items-end justify-center bg-navy/50 p-4 sm:items-center" role="dialog" data-testid="logout-confirm">
          <div className="w-full max-w-sm rounded-[20px] bg-paper px-4 py-5 shadow-card">
            <p className="font-display text-xl text-navy">{t(lang, "logOut")}</p>
            <p className="mt-2 text-sm text-muted">{t(lang, "logoutSure")}</p>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <GhostButton className="bg-sand" data-testid="logout-cancel" onClick={() => setAsk(false)}>
                {t(lang, "cancel")}
              </GhostButton>
              <PrimaryButton data-testid="logout-yes" onClick={yes}>
                {t(lang, "logOut")}
              </PrimaryButton>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
