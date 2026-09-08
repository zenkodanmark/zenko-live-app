import { createRootRoute, HeadContent, Outlet, Scripts } from "@tanstack/react-router";
import { AuthProvider } from "@/lib/auth/provider";
import { PreviewHostBridge } from "@/components/preview-host-bridge";
import appCss from "../styles.css?url";

const APP_NAME = "Zenko Plads";
const asset = (path: string) =>
  `${(import.meta.env.BASE_URL || "/").replace(/\/$/, "")}${path.startsWith("/") ? path : `/${path}`}`;

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { title: APP_NAME },
      { name: "theme-color", content: "#1a2b33" },
      { name: "description", content: "Zenko Danmark — møde, KS-billeder, tavle og Dataløn-port." },
      { name: "apple-mobile-web-app-title", content: APP_NAME },
    ],
    links: [
      { rel: "icon", type: "image/svg+xml", href: asset("/favicon.svg") },
      { rel: "icon", type: "image/png", sizes: "512x512", href: asset("/icons/icon-512.png") },
      { rel: "apple-touch-icon", sizes: "180x180", href: asset("/__grok/icon-180.png") },
      { rel: "apple-touch-icon", sizes: "180x180", href: asset("/icons/apple-touch-icon.png") },
      { rel: "stylesheet", href: appCss },
      { rel: "manifest", href: asset("/manifest.webmanifest") },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@500;600;700&family=Source+Sans+3:ital,wght@0,400;0,500;0,600;0,700;1,400&family=Inter:wght@400;500;600;700&family=Caveat:wght@500;600;700&display=swap" },
    ],
  }),
  component: () => (
    <html lang="da" className="antialiased" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body className="min-h-dvh bg-sand font-sans text-ink">
        <PreviewHostBridge />
        <AuthProvider>
          <Outlet />
        </AuthProvider>
        <Scripts />
      </body>
    </html>
  ),
});