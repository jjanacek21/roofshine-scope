import { createFileRoute } from "@tanstack/react-router";
// Bundle the signing HTML at build time as a raw string so the worker can serve it
// without filesystem access at runtime.
// eslint-disable-next-line import/no-unresolved
import signHtml from "../sign/GCN-Sign.html?raw";

export const Route = createFileRoute("/api/public/sign")({
  server: {
    handlers: {
      GET: async () => {
        return new Response(signHtml, {
          status: 200,
          headers: {
            "content-type": "text/html; charset=utf-8",
            "cache-control": "no-store",
            // Allow embedding in our own app's iframe
            "x-frame-options": "SAMEORIGIN",
          },
        });
      },
    },
  },
});
