"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { eingabe, knopf } from "@/components/AuthLayout";
import { AufsagenKnopf, VorlesenKnopf } from "@/components/Sprachknoepfe";
import { STANDARD_STUNDEN, faelligAm, naechstesFach, pruefe, type Ergebnis } from "@/lib/lernen";

type Karte = { id: string; sprache: "en" | "la"; wort: string; deutsch: string; fach: number; zentral_id: string | null };

const SPRACHE = { en: "Englisch", la: "Latein" } as const;
const PRO_RUNDE = 20;

export default function Lernen() {
  const supabase = useRef(createClient()).current;
  const [karten, setKarten] = useState<Karte[] | null>(null);
  const [stunden, setStunden] = useState<number[]>([...STANDARD_STUNDEN]);
  const [pos, setPos] = useState(0);
  const [antwort, setAntwort] = useState("");
  const [ergebnis, setErgebnis] = useState<Ergebnis | null>(null);
  const [tipps, setTipps] = useState<string[]>([]);
  const [richtige, setRichtige] = useState(0);
  const [tagesziel, setTagesziel] = useState<{ heute: number; ziel: number; neu: number } | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  const feldRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    (async () => {
      const [{ data: k, error }, { data: iv }] = await Promise.all([
        supabase
          .from("vokabel")
          .select("id, sprache, wort, deutsch, fach, zentral_id")
          .lt("fach", 6)
          .lte("faellig_am", new Date().toISOString())
          .order("faellig_am")
          .limit(PRO_RUNDE),
        supabase.from("lernintervall").select("fach, stunden"),
      ]);
      if (error) return setFehler("Die Vokabeln konnten nicht geladen werden.");
      const eigene = [...STANDARD_STUNDEN] as number[];
      (iv ?? []).forEach((r) => (eigene[r.fach - 1] = r.stunden));
      setStunden(eigene);
      setKarten(k ?? []);
    })();
  }, [supabase]);

  useEffect(() => {
    if (ergebnis === null) feldRef.current?.focus();
  }, [ergebnis, pos, karten]);

  const karte = karten?.[pos];

  async function abgeben(e: React.FormEvent) {
    e.preventDefault();
    if (!karte || ergebnis) return;
    const res = pruefe(antwort, karte.wort);
    const gewusst = res !== "falsch";
    const fach = naechstesFach(karte.fach, gewusst);
    setErgebnis(res);
    if (gewusst) setRichtige((n) => n + 1);

    const { error } = await supabase
      .from("vokabel")
      .update({ fach, faellig_am: faelligAm(fach, stunden) })
      .eq("id", karte.id);
    if (error) setFehler("Das Ergebnis konnte nicht gespeichert werden.");

    await supabase.from("lernversuch").insert({ vokabel_id: karte.id, richtig: gewusst });
    const { data: st } = await supabase.rpc("tagesziel_status");
    if (st?.ziel != null) setTagesziel({ heute: st.heute, ziel: st.ziel, neu: st.neu_gutgeschrieben });

    // Eselsbrücke und Sprachbrücke erst nach der Antwort zeigen
    const gefunden: string[] = [];
    if (karte.zentral_id) {
      const [{ data: e1 }, { data: s1 }] = await Promise.all([
        supabase.from("eselsbruecke").select("text").eq("zentral_id", karte.zentral_id),
        supabase.from("sprachbruecke").select("text").or(`en_id.eq.${karte.zentral_id},la_id.eq.${karte.zentral_id}`),
      ]);
      gefunden.push(...(e1 ?? []).map((t) => t.text), ...(s1 ?? []).map((t) => t.text));
    }
    setTipps(gefunden);
  }

  function weiter() {
    setPos((p) => p + 1);
    setAntwort("");
    setErgebnis(null);
    setTipps([]);
  }

  const kopf = <Link href="/" className="text-sm underline">← Zurück</Link>;

  if (fehler && !karten) return <main className="mx-auto max-w-xl p-6">{kopf}<p className="mt-4 text-red-600">{fehler}</p></main>;
  if (!karten) return <main className="mx-auto max-w-xl p-6">{kopf}<p className="mt-4">Lade …</p></main>;

  if (karten.length === 0)
    return (
      <main className="mx-auto flex max-w-xl flex-col gap-4 p-6">
        {kopf}
        <h1 className="text-2xl font-bold">Lernen</h1>
        <p>Heute ist nichts fällig. Super! Du kannst neue Vokabeln erfassen.</p>
        <Link className={`${knopf} block text-center`} href="/erfassen">Neue Vokabeln erfassen</Link>
      </main>
    );

  if (!karte)
    return (
      <main className="mx-auto flex max-w-xl flex-col gap-4 p-6">
        {kopf}
        <h1 className="text-2xl font-bold">Geschafft!</h1>
        <p>{richtige} von {karten.length} gewusst.</p>
        <Link className={`${knopf} block text-center`} href="/">Zur Startseite</Link>
      </main>
    );

  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col gap-5 p-6">
      {kopf}
      <p className="text-sm text-neutral-500">
        {pos + 1} / {karten.length} · {SPRACHE[karte.sprache]} · Fach {karte.fach}
      </p>
      <div>
        <p className="text-sm text-neutral-600">Schreibe auf {SPRACHE[karte.sprache]}:</p>
        <p className="text-3xl font-bold">{karte.deutsch}</p>
      </div>

      <form onSubmit={abgeben} className="flex flex-col gap-3">
        <input ref={feldRef} className={eingabe} value={antwort} onChange={(e) => setAntwort(e.target.value)}
          autoCapitalize="off" autoCorrect="off" autoComplete="off" spellCheck={false} disabled={!!ergebnis}
          placeholder="Deine Antwort" />
        {!ergebnis && <AufsagenKnopf sprache={karte.sprache} onText={setAntwort} />}
        {!ergebnis && <button className={knopf} type="submit" disabled={!antwort.trim()}>Prüfen</button>}
      </form>

      {ergebnis && (
        <>
          <div className={`rounded-lg p-4 ${ergebnis === "falsch" ? "bg-red-50" : "bg-green-50"}`} role="status">
            {ergebnis === "richtig" && <p className="font-semibold">Richtig!</p>}
            {ergebnis === "tippfehler" && <p className="font-semibold">Richtig, achte auf die Schreibweise: {karte.wort}</p>}
            {ergebnis === "falsch" && <p className="font-semibold">Nicht ganz. Es heißt: {karte.wort}</p>}
            {ergebnis === "falsch" && <p className="text-sm">Die Vokabel kommt wieder in Fach 1.</p>}
            <div className="mt-3"><VorlesenKnopf text={karte.wort} sprache={karte.sprache} /></div>
          </div>
          {tipps.length > 0 && (
            <div className="rounded-lg bg-amber-50 p-4 text-sm">
              <p className="mb-1 font-medium">Eselsbrücke</p>
              {tipps.map((t) => <p key={t}>{t}</p>)}
            </div>
          )}
          {tagesziel && (
            <p className="text-sm text-neutral-600">
              {tagesziel.neu > 0
                ? `Tagesziel geschafft! ${tagesziel.neu} Minuten wurden deinem Zeitkonto gutgeschrieben.`
                : `Heute: ${tagesziel.heute} / ${tagesziel.ziel} richtig`}
            </p>
          )}
          {fehler && <p className="text-sm text-red-600">{fehler}</p>}
          <button className={knopf} onClick={weiter} autoFocus>Weiter</button>
        </>
      )}
    </main>
  );
}
