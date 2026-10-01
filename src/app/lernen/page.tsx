"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { eingabe, knopf } from "@/components/AuthLayout";
import { AufsagenKnopf } from "@/components/Sprachknoepfe";
import { STANDARD_STUNDEN, faelligAm, naechstesFach, pruefe, type Ergebnis } from "@/lib/lernen";

type Karte = {
  id: string;
  sprache: "en" | "la";
  wort: string;
  deutsch: string;
  fach: number;
  zentral_id: string | null;
  kapitel_id: string | null;
};

const SPRACHE = { en: "Englisch", la: "Latein" } as const;
const PRO_RUNDE = 20;
const OHNE = "ohne";

function Lernen() {
  const supabase = useRef(createClient()).current;
  const kapitelParam = useSearchParams().get("kapitel");
  const kapitelFilter = kapitelParam ? new Set(kapitelParam.split(",")) : null;

  const [karten, setKarten] = useState<Karte[] | null>(null);
  const [stunden, setStunden] = useState<number[]>([...STANDARD_STUNDEN]);
  const [pos, setPos] = useState(0);
  const [antwort, setAntwort] = useState("");
  const [ergebnis, setErgebnis] = useState<Ergebnis | null>(null);
  const [tipps, setTipps] = useState<string[]>([]);
  const [richtige, setRichtige] = useState(0);
  const [tagesziel, setTagesziel] = useState<{ heute: number; ziel: number; neu: number } | null>(null);
  const [verteilung, setVerteilung] = useState<number[] | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  const feldRef = useRef<HTMLInputElement>(null);

  const schaechteLaden = useCallback(async () => {
    const { data } = await supabase.from("vokabel").select("fach");
    const v = [0, 0, 0, 0, 0, 0];
    (data ?? []).forEach((r) => v[r.fach - 1]++);
    setVerteilung(v);
  }, [supabase]);

  useEffect(() => {
    schaechteLaden();
  }, [schaechteLaden]);

  useEffect(() => {
    (async () => {
      const [{ data: k, error }, { data: iv }] = await Promise.all([
        supabase
          .from("vokabel")
          .select("id, sprache, wort, deutsch, fach, zentral_id, kapitel_id")
          .lt("fach", 6)
          .lte("faellig_am", new Date().toISOString())
          .order("faellig_am")
          .limit(200),
        supabase.from("lernintervall").select("fach, stunden"),
      ]);
      if (error) return setFehler("Die Vokabeln konnten nicht geladen werden.");
      const eigene = [...STANDARD_STUNDEN] as number[];
      (iv ?? []).forEach((r) => (eigene[r.fach - 1] = r.stunden));
      setStunden(eigene);
      const gefiltert = kapitelFilter
        ? (k ?? []).filter((r) => kapitelFilter.has(r.kapitel_id ?? OHNE))
        : (k ?? []);
      setKarten(gefiltert.slice(0, PRO_RUNDE));
    })();
    // kapitelParam als String vergleichen, nicht das bei jedem Render neue Set-Objekt
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase, kapitelParam]);

  useEffect(() => {
    if (ergebnis === null) feldRef.current?.focus();
  }, [ergebnis, pos, karten]);

  const karte = karten?.[pos];

  async function werten(res: Ergebnis) {
    if (!karte || ergebnis) return;
    const gewusst = res !== "falsch";
    const fach = naechstesFach(karte.fach, gewusst);
    setErgebnis(res);
    if (gewusst) setRichtige((n) => n + 1);

    const { error } = await supabase
      .from("vokabel")
      .update({ fach, faellig_am: faelligAm(fach, stunden) })
      .eq("id", karte.id);
    if (error) setFehler("Das Ergebnis konnte nicht gespeichert werden.");
    schaechteLaden();

    await supabase.from("lernversuch").insert({
      vokabel_id: karte.id, richtig: gewusst, ergebnis: res, wort: karte.wort, deutsch: karte.deutsch,
    });
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

  async function abgeben(e: React.FormEvent) {
    e.preventDefault();
    await werten(pruefe(antwort, karte?.wort ?? ""));
  }

  function aufgeben() {
    setAntwort("");
    werten("falsch");
  }

  function weiter() {
    setPos((p) => p + 1);
    setAntwort("");
    setErgebnis(null);
    setTipps([]);
  }

  const kopf = <Link href="/kapitel" className="text-sm underline">← Meine Kapitel</Link>;

  const schaechte = verteilung && (
    <div className="grid grid-cols-6 gap-1 text-center text-xs">
      {[1, 2, 3, 4, 5, 6].map((f) => (
        <div key={f} className={`rounded p-2 ${karte?.fach === f ? "bg-black text-white" : "bg-neutral-100"}`}>
          <p className="font-semibold">{verteilung[f - 1]}</p>
          <p className={karte?.fach === f ? "text-neutral-300" : "text-neutral-500"}>{f === 6 ? "fertig" : `S${f}`}</p>
        </div>
      ))}
    </div>
  );

  if (fehler && !karten) return <main className="mx-auto max-w-xl p-6">{kopf}<p className="mt-4 text-red-600">{fehler}</p></main>;
  if (!karten) return <main className="mx-auto max-w-xl p-6">{kopf}<p className="mt-4">Lade …</p></main>;

  if (karten.length === 0)
    return (
      <main className="mx-auto flex max-w-xl flex-col gap-4 p-6">
        {kopf}
        <h1 className="text-2xl font-bold">Lernen</h1>
        {schaechte}
        <p>Heute ist hier nichts fällig. Super!</p>
        <Link className={`${knopf} block text-center`} href="/kapitel">Zu meinen Kapiteln</Link>
      </main>
    );

  if (!karte)
    return (
      <main className="mx-auto flex max-w-xl flex-col gap-4 p-6">
        {kopf}
        <h1 className="text-2xl font-bold">Geschafft!</h1>
        {schaechte}
        <p>{richtige} von {karten.length} gewusst.</p>
        <Link className={`${knopf} block text-center`} href="/">Zur Startseite</Link>
      </main>
    );

  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col gap-5 p-6">
      {kopf}
      {schaechte}
      <p className="text-sm text-neutral-500">
        {pos + 1} / {karten.length} · {SPRACHE[karte.sprache]} · Schacht {karte.fach}
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
        {!ergebnis && (
          <button type="button" className="self-center text-sm text-neutral-500 underline" onClick={aufgeben}>
            Ich weiß es nicht
          </button>
        )}
      </form>

      {ergebnis && (
        <>
          <div className={`rounded-lg p-4 ${ergebnis === "falsch" ? "bg-red-50" : "bg-green-50"}`} role="status">
            {ergebnis === "richtig" && <p className="font-semibold">Richtig!</p>}
            {ergebnis === "tippfehler" && (
              <>
                <p className="font-semibold">Richtig, achte auf die Schreibweise:</p>
                <p className="font-bold" style={{ fontSize: "8mm" }}>{karte.wort}</p>
              </>
            )}
            {ergebnis === "falsch" && (
              <>
                <p className="font-semibold">Nicht ganz. Es heißt:</p>
                <p className="font-bold" style={{ fontSize: "8mm" }}>{karte.wort}</p>
                <p className="text-sm">Die Vokabel kommt wieder in Schacht 1.</p>
              </>
            )}
          </div>
          {tipps.length > 0 && (
            <div className="rounded-lg bg-amber-50 p-5">
              <p className="mb-2 text-lg font-semibold">💡 Eselsbrücke</p>
              {tipps.map((t) => <p key={t} className="text-lg leading-snug">{t}</p>)}
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

export default function LernenSeite() {
  return <Suspense><Lernen /></Suspense>;
}
