import { type ButtonHTMLAttributes } from "react";

export function hakClass(on: boolean, busy?: boolean) {
  return `shrink-0 rounded-md px-2 py-1 text-[11px] font-semibold leading-none ${
    on ? "bg-moss text-sand" : "bg-white text-navy ring-1 ring-line"
  } ${busy ? "opacity-70" : ""}`;
}

export function HakBtn({
  on,
  busy,
  label,
  ...rest
}: {
  on: boolean;
  busy?: boolean;
  label: string;
} & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button type="button" disabled={busy} className={hakClass(on, busy)} aria-busy={busy} {...rest}>
      {label}
    </button>
  );
}
