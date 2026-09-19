"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { eingabe, knopf } from "@/components/AuthLayout";
import { STANDARD_STUNDEN } from "@/lib/lernen";

type Einheit = "stunden" | "tage" | "wochen";
type Zeile = { wert: string; einheit: Einheit };

const FAKTOR: Record<Einheit, number> = { stunden: 1, tage: 24, wochen: 168 };
const MAX_STUNDEN = 8760;

function zuZeile(h: number): Zeile {
  if (h % 168 === 0) return { wert: String(h / 168), einheit: "wochen" };
  if (h % 24 === 0) return { wert: String(h / 24), einheit: "tage" };
  return { wert: String(h), einheit: "stunden" };
}

export default function Einstellungen() {
  const supabase = useRef(createClient()).current;
  const [zeilen, setZeilen] = useState<Zeile[] | null>(null);
  const [meldung, setMeldung] = useState<{ text: string; fehler: boolean } | null>(null);

  async function laden() {
    const { data } = await supabase.from("lernintervall").select("fach, stunden");
    const h = [...STANDARD_STUNDEN] as number[];
    (data ?? []).forEach((r) => (h[r.fach - 1] = r.stunden));
    setZeilen(h.map(zuZeile));
  }

  useEffect(() => {
    laden();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function aendern(i: number, teil: Partial<Zeile>) {
    setZeilen((z) => z && z.map((r, j) => (j === i ? { ...r, ...teil } : r)));
  }

  async function speichern(e: React.FormEvent) {
    e.preventDefault();
    if (!zeilen) return;
    const stunden = zeilen.map((z) => Math.round(Number(z.wert) * FAKTOR[z.einheit]));
    if (stunden.some((h) => !Number.isFinite(h) || h < 1 || h > MAX_STUNDEN))
      return setMeldung({ text: "Bitte überall eine Zahl ab 1 eingeben (höchstens ein Jahr).", fehler: true });

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { error } = await supabase
      .from("lernintervall")
      .upsert(stunden.map((h, i) => ({ user_id: user.id, fach: i + 1, stunden: h })), { onConflict: "user_id,fach" });
    setMeldung(error
      ? { text: "Das Speichern hat nicht geklappt.", fehler: true }
      : { text: "Gespeichert. Es gilt ab der nächsten Antwort.", fehler: false });
  }

  async function zuruecksetzen() {
    await supabase.from("lernintervall").delete().gte("fach", 1);
    setMeldung({ text: "Wieder auf die Standard-Abstände gestellt.", fehler: false });
    laden();
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col gap-5 p-6">
      <Link href="/" className="text-sm underline">← Zurück</Link>
      <h1 className="text-2xl font-bold">Wiederholungs-Abstände</h1>
      <p className="text-neutral-600">
        Wenn du eine Vokabel weißt, rückt sie ein Fach weiter und kommt erst nach dieser Zeit wieder.
        Weißt du sie nicht, geht sie zurück in Fach 1. Fach 6 heißt: gelernt.
      </p>

      {zeilen === null ? (
        <p>Lade …</p>
      ) : (
        <form onSubmit={speichern} className="flex flex-col gap-3">
          {zeilen.map((z, i) => (
            <div key={i} className="grid grid-cols-[5rem_1fr_7rem] items-center gap-2">
              <span className="font-medium">Fach {i + 1}</span>
              <input className={eingabe} type="number" min={1} inputMode="numeric" value={z.wert}
                aria-label={`Fach ${i + 1} Abstand`} onChange={(e) => aendern(i, { wert: e.target.value })} />
              <select className={eingabe} value={z.einheit} aria-label={`Fach ${i + 1} Einheit`}
                onChange={(e) => aendern(i, { einheit: e.target.value as Einheit })}>
                <option value="stunden">Stunden</option>
                <option value="tage">Tage</option>
                <option value="wochen">Wochen</option>
              </select>
            </div>
          ))}
          <button className={knopf} type="submit">Speichern</button>
          <button type="button" className="text-sm underline" onClick={zuruecksetzen}>Standard wiederherstellen</button>
          {meldung && <p className={`text-sm ${meldung.fehler ? "text-red-600" : "text-green-700"}`} role="status">{meldung.text}</p>}
        </form>
      )}
    </main>
  );
}
