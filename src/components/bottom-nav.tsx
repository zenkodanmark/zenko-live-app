import { cn } from "@/lib/cn";
import { TabPng, type TabPngName } from "@/components/sag-icons";

export type NavItem = {
  id: string;
  label: string;
  icon: TabPngName;
  badge?: number;
};

export function BottomNav({
  items,
  value,
  onChange,
  iconPx = 40,
  roomy = false,
}: {
  items: NavItem[];
  value: string;
  onChange: (id: string) => void;
  iconPx?: number;
  roomy?: boolean;
}) {
  const big = iconPx >= 52 || roomy;
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-navy/20 bg-sand pb-[max(0.35rem,env(safe-area-inset-bottom))] pt-1.5">
      <ul className={cn("mx-auto flex max-w-2xl", roomy && "gap-1 px-1")}>
        {items.map((item) => {
          const on = value === item.id;
          const unread = item.badge ?? 0;
          return (
            <li key={item.id} className="flex-1">
              <button
                type="button"
                onClick={() => onChange(item.id)}
                className={cn(
                  "relative mx-0.5 flex w-[calc(100%-0.25rem)] flex-col items-center justify-center gap-0.5 rounded-xl font-semibold",
                  big ? "min-h-[4.75rem] py-1.5" : "min-h-16",
                  on ? "bg-[#c45c3e] text-sand" : "bg-sand text-navy",
                )}
              >
                <span className="relative">
                  <TabPng name={item.icon} px={iconPx} />
                  {unread > 0 ? (
                    <span
                      className={cn(
                        "absolute -right-3 -top-1.5 inline-flex min-h-5 min-w-5 items-center justify-center rounded-full px-1 text-[12px] font-bold leading-none",
                        on ? "bg-sand text-brick" : "bg-brick text-sand",
                      )}
                    >
                      {unread > 9 ? "9+" : unread}
                    </span>
                  ) : null}
                </span>
                <span className={cn("leading-none tracking-wide", big ? "text-[13px]" : "text-[12px]")}>{item.label}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
