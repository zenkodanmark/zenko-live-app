import { useEffect, useState } from "react";
import { PrimaryButton } from "@/components/zenko";
import { t } from "@/lib/i18n";
import { useYard } from "@/lib/store";
import type { Employee, Lang } from "@/lib/types";

export function PinEditor({ emp, lang }: { emp: Employee; lang: Lang }) {
  const live = useYard((s) => s.employees.find((e) => e.id === emp.id) ?? emp);
  const employees = useYard((s) => s.employees);
  const patchEmployee = useYard((s) => s.patchEmployee);
  const [pin, setPin] = useState(live.pin);
  const [note, setNote] = useState("");
  useEffect(() => {
    setPin(live.pin);
  }, [live.id, live.pin]);
  const taken = employees.some((e) => e.id !== live.id && e.pin === pin);
  const ready = pin.length === 4 && pin !== live.pin && !taken;

  return (
    <div className="mt-3" data-testid="pin-editor">
      <p className="text-xs text-muted">
        {t(lang, "changePin")} · {t(lang, "pinFour")}
      </p>
      <div className="mt-1 flex gap-2">
        <input
          inputMode="numeric"
          autoComplete="off"
          data-testid="pin-editor-input"
          className="min-h-11 flex-1 rounded-lg bg-sand px-3 text-sm text-ink tracking-[0.4em]"
          value={pin}
          maxLength={4}
          onChange={(e) => {
            setNote("");
            setPin(e.target.value.replace(/\D/g, "").slice(0, 4));
          }}
        />
        <PrimaryButton
          className="w-auto shrink-0 px-4 disabled:opacity-40"
          data-testid="pin-editor-save"
          disabled={!ready}
          onClick={() => {
            patchEmployee(live.id, { pin });
            setNote(t(lang, "save"));
          }}
        >
          {t(lang, "save")}
        </PrimaryButton>
      </div>
      {taken && pin.length === 4 ? <p className="mt-1 text-xs text-brick">{t(lang, "pinTaken")}</p> : null}
      {note ? <p className="mt-1 text-xs text-moss">{note}</p> : null}
    </div>
  );
}
