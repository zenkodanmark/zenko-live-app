import { useEffect } from "react";
import { useYard } from "./store";

export function useDeepOpen(setTab: (id: string) => void, master: boolean) {
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const open = q.get("open");
    if (!open) return;
    if (open === "chat") setTab("chat");
    else if (open === "todo") setTab(master ? "board" : "today");
    else if (open === "ks") setTab(master ? "reports" : "ks");
    else if (open === "folk" || open === "tid") setTab(master ? "folk" : "today");
    else if (open === "ma") {
      setTab(master ? "sager" : "today");
      const id = q.get("id");
      if (id) useYard.getState().setOpenMa(id);
    }
  }, [setTab, master]);
}
