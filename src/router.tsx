import { createRouter } from "@tanstack/react-router";
import { AppErrorComponent } from "@/lib/error-component";
import { LoginSplash } from "@/components/pin-login";
import { routeTree } from "./routeTree.gen";

const basepath = (import.meta.env.BASE_URL || "/").replace(/\/$/, "") || undefined;

export function getRouter() {
  return createRouter({
    routeTree,
    defaultErrorComponent: AppErrorComponent,
    defaultPendingComponent: LoginSplash,
    defaultPendingMs: 0,
    defaultPendingMinMs: 0,
    ...(basepath ? { basepath } : {}),
  });
}