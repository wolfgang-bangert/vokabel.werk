export type Ergebnis = "richtig" | "tippfehler" | "falsch";

/** Standard-Wiederholungsabstände in Stunden für Fach 1-5 (Kind kann sie ändern). */
export const STANDARD_STUNDEN = [24, 72, 168, 336, 720] as const;

/** Klein, ohne Akzente/Längenzeichen (ā -> a), einfache Leerzeichen. */
export function normalisiere(t: string): string {
  return t
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[.!?¿¡…"„“”]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function abstand(a: string, b: string): number {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      d[i][j] = Math.min(
        d[i - 1][j] + 1,
        d[i][j - 1] + 1,
        d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
  return d[a.length][b.length];
}

/** Erlaubte Tippfehler: 0 bei kurzen Wörtern, 1 ab 4 Zeichen, 2 ab 9 Zeichen. */
function toleranz(laenge: number): number {
  return laenge >= 9 ? 2 : laenge >= 4 ? 1 : 0;
}

/** Mehrere Lösungen mit , ; / getrennt: jede zählt. */
export function pruefe(eingabe: string, loesung: string): Ergebnis {
  const e = normalisiere(eingabe);
  if (!e) return "falsch";
  const kandidaten = loesung.split(/[,;/]/).map(normalisiere).filter(Boolean);
  if (kandidaten.includes(e)) return "richtig";
  return kandidaten.some((k) => abstand(e, k) <= toleranz(k.length)) ? "tippfehler" : "falsch";
}

/** Gewusst: ein Fach weiter (6 = gelernt). Nicht gewusst: zurück in Fach 1. */
export function naechstesFach(fach: number, gewusst: boolean): number {
  return gewusst ? Math.min(fach + 1, 6) : 1;
}

export function faelligAm(fach: number, stunden: readonly number[]): string {
  const h = fach >= 6 ? 0 : stunden[fach - 1];
  return new Date(Date.now() + h * 3600_000).toISOString();
}
