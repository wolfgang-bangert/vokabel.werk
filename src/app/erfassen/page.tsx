"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { eingabe, knopf } from "@/components/AuthLayout";

type Sprache = "en" | "la";
type Vokabel = { id: string; wort: string; deutsch: string; fach: number };
type Vorschlag = { wort: string; deutsch: string };

const SPRACHEN: { id: Sprache; name: string }[] = [
  { id: "en", name: "Englisch" },
  { id: "la", name: "Latein" },
];

export default function Erfassen() {
  const supabase = useRef(createClient()).current;
  const [sprache, setSprache] = useState<Sprache>("en");
  const [wort, setWort] = useState("");
  const [deutsch, setDeutsch] = useState("");
  const [vorschlaege, setVorschlaege] = useState<Vorschlag[]>([]);
  const [liste, setListe] = useState<Vokabel[]>([]);
  const [busy, setBusy] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  const [bruecken, setBruecken] = useState<string[]>([]);
  const wortRef = useRef<HTMLInputElement>(null);

  const laden = useCallback(async () => {
    const { data } = await supabase
      .from("vokabel")
      .select("id, wort, deutsch, fach")
      .eq("sprache", sprache)
      .order("created_at", { ascending: false })
      .limit(50);
    setListe(data ?? []);
  }, [supabase, sprache]);

  useEffect(() => {
    laden();
  }, [laden]);

  // Rechtschreibhilfe: ähnliche Wörter aus der zentralen Quelle
  useEffect(() => {
    if (wort.trim().length < 3) {
      setVorschlaege([]);
      return;
    }
    const t = setTimeout(async () => {
      const { data } = await supabase.rpc("vokabel_vorschlaege", { p_sprache: sprache, p_wort: wort });
      setVorschlaege(data ?? []);
    }, 300);
    return () => clearTimeout(t);
  }, [wort, sprache, supabase]);

  async function speichern(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setFehler(null);
    setBruecken([]);
    const { data, error } = await supabase
      .from("vokabel")
      .insert({ sprache, wort: wort.trim(), deutsch: deutsch.trim() })
      .select("zentral_id")
      .single();
    setBusy(false);
    if (error) return setFehler("Das Speichern hat nicht geklappt. Bitte versuche es nochmal.");

    if (data?.zentral_id) {
      const { data: tipps } = await supabase
        .from("eselsbruecke")
        .select("text")
        .eq("zentral_id", data.zentral_id);
      setBruecken((tipps ?? []).map((t) => t.text));
    }
    setWort("");
    setDeutsch("");
    setVorschlaege([]);
    wortRef.current?.focus();
    laden();
  }

  async function loeschen(id: string) {
    await supabase.from("vokabel").delete().eq("id", id);
    setListe((l) => l.filter((v) => v.id !== id));
  }

  // Nur die Schreibweise des Fremdworts, die Bedeutung tippt das Kind immer selbst
  const passendeVorschlaege = [...new Set(vorschlaege.map((v) => v.wort))]
    .filter((w) => w.toLowerCase() !== wort.trim().toLowerCase())
    .map((w) => ({ wort: w }));

  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col gap-5 p-6">
      <Link href="/" className="text-sm underline">← Zurück</Link>
      <h1 className="text-2xl font-bold">Neue Vokabeln erfassen</h1>

      <div className="grid grid-cols-2 gap-2" role="tablist">
        {SPRACHEN.map((s) => (
          <button
            key={s.id}
            role="tab"
            aria-selected={sprache === s.id}
            onClick={() => { setSprache(s.id); setVorschlaege([]); setBruecken([]); }}
            className={`rounded-lg border p-3 font-medium ${sprache === s.id ? "border-black bg-black text-white" : "border-neutral-300"}`}
          >
            {s.name}
          </button>
        ))}
      </div>

      <form onSubmit={speichern} className="flex flex-col gap-3">
        <input ref={wortRef} className={eingabe} placeholder={sprache === "en" ? "Englisches Wort" : "Lateinisches Wort"}
          autoCapitalize="off" autoCorrect="off" spellCheck={false} required
          value={wort} onChange={(e) => setWort(e.target.value)} />

        {passendeVorschlaege.length > 0 && (
          <div className="rounded-lg bg-amber-50 p-3 text-sm">
            <p className="mb-2 font-medium">Meinst du vielleicht:</p>
            <ul className="flex flex-col gap-1">
              {passendeVorschlaege.map((v) => (
                <li key={v.wort}>
                  <button type="button" className="underline"
                    onClick={() => { setWort(v.wort); setVorschlaege([]); }}>
                    {v.wort}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        <input className={eingabe} placeholder="Deutsche Bedeutung" required
          value={deutsch} onChange={(e) => setDeutsch(e.target.value)} />
        <button className={knopf} type="submit" disabled={busy}>Speichern</button>
        {fehler && <p className="text-sm text-red-600">{fehler}</p>}
      </form>

      {bruecken.length > 0 && (
        <div className="rounded-lg bg-green-50 p-4 text-sm">
          <p className="mb-1 font-medium">Eselsbrücke zur letzten Vokabel</p>
          {bruecken.map((b) => <p key={b}>{b}</p>)}
        </div>
      )}

      <section>
        <h2 className="mb-2 font-semibold">Meine Vokabeln ({liste.length})</h2>
        {liste.length === 0 ? (
          <p className="text-sm text-neutral-600">Hier ist noch nichts. Trag oben deine erste Vokabel ein.</p>
        ) : (
          <ul className="divide-y divide-neutral-200 rounded-lg border border-neutral-200">
            {liste.map((v) => (
              <li key={v.id} className="flex items-center justify-between gap-3 p-3">
                <div>
                  <p className="font-medium">{v.wort}</p>
                  <p className="text-sm text-neutral-600">{v.deutsch}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-neutral-500">{v.fach === 6 ? "gelernt" : `Fach ${v.fach}`}</span>
                  <button className="text-sm text-red-600 underline" onClick={() => loeschen(v.id)}
                    aria-label={`${v.wort} löschen`}>
                    Löschen
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
