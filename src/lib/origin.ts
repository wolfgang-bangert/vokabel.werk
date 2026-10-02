import type { NextRequest } from "next/server";

/**
 * Öffentliche Adresse der App. Hinter dem Reverse Proxy (Caddy) liefert der
 * Standalone-Server in request.url nur HOSTNAME:PORT des Containers (0.0.0.0:3000),
 * daher kommt die Adresse aus den Proxy-Headern. Ohne Proxy (lokale Entwicklung)
 * fehlen sie, dann gilt die Adresse der Anfrage selbst.
 */
export function publicOrigin(request: NextRequest): string {
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? request.nextUrl.host;
  const proto = request.headers.get("x-forwarded-proto") ?? request.nextUrl.protocol.replace(":", "");
  return `${proto}://${host}`;
}
