"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
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
  kapitel: string | null;
};
type KapitelInfo = { schluessel: string; label: string; anzahl: number };

const SPRACHE = { en: "Englisch", la: "Latein" } as const;
const PRO_RUNDE = 20;
const OHNE_KAPITEL = "__ohne__";
const KAPITEL_KEY = "vokabel-werk:kapitel-auswahl";

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
  const [verteilung, setVerteilung] = useState<number[] | null>(null);
  const [kapitelListe, setKapitelListe] = useState<KapitelInfo[] | null>(null);
  const [kapitelAuswahl, setKapitelAuswahl] = useState<Set<string> | null>(null);
  const [kapitelWahlOffen, setKapitelWahlOffen] = useState(false);
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

  // Kapitel ermitteln: bei nur einem Kapitel (oder keinem) wird nichts gefragt
  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("vokabel").select("kapitel");
      const zaehler = new Map<string, number>();
      (data ?? []).forEach((r) => {
        const schluessel = r.kapitel ?? OHNE_KAPITEL;
        zaehler.set(schluessel, (zaehler.get(schluessel) ?? 0) + 1);
      });
      const liste = [...zaehler.entries()]
        .map(([schluessel, anzahl]) => ({ schluessel, anzahl, label: schluessel === OHNE_KAPITEL ? "Ohne Kapitel" : schluessel }))
        .sort((a, b) => a.label.localeCompare(b.label, "de"));
      setKapitelListe(liste);

      if (liste.length <= 1) {
        setKapitelAuswahl(new Set(liste.map((l) => l.schluessel)));
        return;
      }
      let gespeichert: string[] = [];
      try {
        gespeichert = JSON.parse(localStorage.getItem(KAPITEL_KEY) ?? "[]");
      } catch {
        gespeichert = [];
      }
      const gueltig = gespeichert.filter((s) => liste.some((l) => l.schluessel === s));
      if (gueltig.length > 0) {
        setKapitelAuswahl(new Set(gueltig));
      } else {
        setKapitelAuswahl(new Set(liste.map((l) => l.schluessel)));
        setKapitelWahlOffen(true);
      }
    })();
  }, [supabase]);

  // Fällige Vokabeln laden, sobald die Kapitelauswahl feststeht
  useEffect(() => {
    if (!kapitelAuswahl || kapitelWahlOffen) return;
    (async () => {
      const [{ data: k, error }, { data: iv }] = await Promise.all([
        supabase
          .from("vokabel")
          .select("id, sprache, wort, deutsch, fach, zentral_id, kapitel")
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
      const gefiltert = (k ?? []).filter((r) => kapitelAuswahl.has(r.kapitel ?? OHNE_KAPITEL)).slice(0, PRO_RUNDE);
      setKarten(gefiltert);
      setPos(0);
      setRichtige(0);
    })();
  }, [supabase, kapitelAuswahl, kapitelWahlOffen]);

  useEffect(() => {
    if (ergebnis === null) feldRef.current?.focus();
  }, [ergebnis, pos, karten]);

  const karte = karten?.[pos];

  function kapitelUmschalten(schluessel: string) {
    setKapitelAuswahl((s) => {
      const neu = new Set(s);
      if (neu.has(schluessel)) neu.delete(schluessel);
      else neu.add(schluessel);
      return neu;
    });
  }

  function kapitelBestaetigen() {
    try {
      localStorage.setItem(KAPITEL_KEY, JSON.stringify([...(kapitelAuswahl ?? [])]));
    } catch {
      // Speicher nicht verfügbar (z. B. privates Fenster) – kein Problem, gilt nur für diese Sitzung
    }
    setKarten(null);
    setKapitelWahlOffen(false);
  }

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

  const kopf = <Link href="/" className="text-sm underline">← Zurück</Link>;

  const kapitelAendernLink = kapitelListe && kapitelListe.length > 1 && (
    <button type="button" className="self-start text-xs text-neutral-500 underline" onClick={() => setKapitelWahlOffen(true)}>
      Kapitel ändern
    </button>
  );

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

  if (kapitelWahlOffen && kapitelListe)
    return (
      <main className="mx-auto flex min-h-screen max-w-xl flex-col gap-4 p-6">
        {kopf}
        <h1 className="text-2xl font-bold">Welche Kapitel?</h1>
        <p className="text-neutral-600">Wähle ein oder mehrere Kapitel zum Lernen aus.</p>
        <div className="flex flex-col gap-2">
          {kapitelListe.map((k) => (
            <label key={k.schluessel} className="flex items-center justify-between rounded-lg border border-neutral-300 p-3">
              <span className="flex items-center gap-2">
                <input type="checkbox" checked={kapitelAuswahl?.has(k.schluessel) ?? false}
                  onChange={() => kapitelUmschalten(k.schluessel)} />
                {k.label}
              </span>
              <span className="text-sm text-neutral-500">{k.anzahl}</span>
            </label>
          ))}
        </div>
        <button className={knopf} onClick={kapitelBestaetigen} disabled={!kapitelAuswahl || kapitelAuswahl.size === 0}>
          Los geht&apos;s
        </button>
      </main>
    );

  if (!karten) return <main className="mx-auto max-w-xl p-6">{kopf}<p className="mt-4">Lade …</p></main>;

  if (karten.length === 0)
    return (
      <main className="mx-auto flex max-w-xl flex-col gap-4 p-6">
        {kopf}
        <h1 className="text-2xl font-bold">Lernen</h1>
        {kapitelAendernLink}
        {schaechte}
        <p>Heute ist nichts fällig. Super! Du kannst neue Vokabeln erfassen.</p>
        <Link className={`${knopf} block text-center`} href="/erfassen">Neue Vokabeln erfassen</Link>
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
      {kapitelAendernLink}
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
