import { createFileRoute } from "@tanstack/react-router";
// Bundle the signing HTML at build time as a raw string so the worker can serve
// it without filesystem access at runtime. Lives under /api/public/* so the
// preview proxy does not auth-gate it (the iframe runs inside an authenticated
// parent page, but the preview proxy still 302s any /api/* request to
// lovable.dev/auth-bridge, which then refuses to be framed).
// eslint-disable-next-line import/no-unresolved
import signHtml from "../../../sign/GCN-Sign.html?raw";

export const Route = createFileRoute("/api/public/sign")({
  server: {
    handlers: {
      GET: async () => {
        return new Response(signHtml, {
          status: 200,
          headers: {
            "content-type": "text/html; charset=utf-8",
            "cache-control": "no-store",
            "x-frame-options": "SAMEORIGIN",
          },
        });
      },
    },
  },
});
