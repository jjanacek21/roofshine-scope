import {
  Outlet,
  Link,
  createRootRoute,
  HeadContent,
  Scripts,
  useNavigate,
  useRouterState,
} from "@tanstack/react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import Landing from "@/pages/marketing/Landing";
import { CbSessionProvider } from "@/components/auth/CbSessionProvider";
import { CbCompanyProvider } from "@/components/auth/CbCompanyProvider";
import { getSurface, isClaimBuddyPath } from "@/lib/cbMode";
import { getRequestHostname, resolveSurfaceFromHost, surfaceMeta } from "@/lib/surfaceHead";
import { Toaster } from "@/components/ui/sonner";

import appCss from "../styles.css?url";


function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="btn-brand inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-semibold"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRoute({
  loader: () => ({ surface: resolveSurfaceFromHost(getRequestHostname()) }),
  head: ({ loaderData }) => {
    const surface = loaderData?.surface ?? "platform";
    return {
      meta: [
        { charSet: "utf-8" },
        {
          name: "viewport",
          content: "width=device-width, initial-scale=1, viewport-fit=cover",
        },
        ...surfaceMeta(surface),
        ...(surface === "standalone"
          ? [
              { name: "mobile-web-app-capable", content: "yes" },
              { name: "apple-mobile-web-app-capable", content: "yes" },
              { name: "apple-mobile-web-app-status-bar-style", content: "black-translucent" },
            ]
          : []),
      ],
      links: [
        { rel: "preconnect", href: "https://fonts.googleapis.com" },
        { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
        {
          rel: "stylesheet",
          href: "https://fonts.googleapis.com/css2?family=Archivo:wght@400;500;600;700;800;900&family=JetBrains+Mono:wght@400;500;600;700&family=Instrument+Serif:ital@0;1&family=Bricolage+Grotesque:wght@600;700;800&family=Hanken+Grotesk:wght@400;500;600;700&display=swap",
        },
        { rel: "stylesheet", href: appCss },
        ...(surface === "standalone"
          ? [
              { rel: "manifest", href: "/claim-buddy.webmanifest" },
              { rel: "apple-touch-icon", href: "/cb-icon-192.png" },
              { rel: "icon", href: "/cb-icon-192.png", type: "image/png" },
            ]
          : []),
      ],
    };
  },
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

/**
 * On the standalone Claim Buddy domain (gcn.claims) the rest of the app is
 * unreachable — every other path lands on the Claim Buddy home. The one
 * exception is "/" for signed-out visitors: they get the marketing landing page.
 */
function StandaloneGate() {
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { user, loading } = useAuth();

  useEffect(() => {
    if (getSurface() !== "standalone") return;
    if (isClaimBuddyPath(pathname)) return;
    if (pathname === "/" && (loading || !user)) return;
    navigate({ to: "/cb", replace: true });
  }, [pathname, navigate, user, loading]);

  return null;
}

/** Renders the marketing landing page on gcn.claims "/" for signed-out visitors. */
function SurfaceOutlet() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { user, loading } = useAuth();
  const [standalone, setStandalone] = useState(false);

  useEffect(() => {
    setStandalone(getSurface() === "standalone");
  }, []);

  if (standalone && pathname === "/") {
    if (loading) return null;
    if (!user) return <Landing />;
    return null;
  }

  return <Outlet />;
}

function RootComponent() {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: { queries: { staleTime: 30_000, refetchOnWindowFocus: false } },
  }));

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <CbSessionProvider>
          <CbCompanyProvider>
            <StandaloneGate />
            <SurfaceOutlet />
            <Toaster />
          </CbCompanyProvider>
        </CbSessionProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

