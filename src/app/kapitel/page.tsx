"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { eingabe, knopf } from "@/components/AuthLayout";

type Sprache = "en" | "la";
type Kapitel = { id: string; sprache: Sprache; name: string; anzahl: number };
const OHNE = "ohne";
const SPRACHE_NAME: Record<Sprache, string> = { en: "Englisch", la: "Latein" };

export default function KapitelUebersicht() {
  const supabase = useRef(createClient()).current;
  const router = useRouter();
  const [kapitel, setKapitel] = useState<Kapitel[] | null>(null);
  const [ohneAnzahl, setOhneAnzahl] = useState(0);
  const [ausgewaehlt, setAusgewaehlt] = useState<Set<string>>(new Set());
  const [sprache, setSprache] = useState<Sprache>("en");
  const [name, setName] = useState("");
  const [fehler, setFehler] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const laden = useCallback(async () => {
    const [{ data: k }, { data: v }] = await Promise.all([
      supabase.from("kapitel").select("id, sprache, name").order("created_at"),
      supabase.from("vokabel").select("kapitel_id"),
    ]);
    const zaehler = new Map<string, number>();
    let ohne = 0;
    (v ?? []).forEach((r) => {
      if (r.kapitel_id) zaehler.set(r.kapitel_id, (zaehler.get(r.kapitel_id) ?? 0) + 1);
      else ohne++;
    });
    const liste = (k ?? []).map((r) => ({ ...r, anzahl: zaehler.get(r.id) ?? 0 }) as Kapitel);
    setKapitel(liste);
    setOhneAnzahl(ohne);
    setAusgewaehlt((alt) => (alt.size === 0 ? new Set([...liste.map((r) => r.id), OHNE]) : alt));
  }, [supabase]);

  useEffect(() => {
    laden();
  }, [laden]);

  async function anlegen(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setFehler(null);
    const { error } = await supabase.from("kapitel").insert({ sprache, name: name.trim() });
    setBusy(false);
    if (error) return setFehler(error.code === "23505" ? "Dieses Kapitel gibt es schon." : "Anlegen hat nicht geklappt.");
    setName("");
    laden();
  }

  function umschalten(id: string) {
    setAusgewaehlt((s) => {
      const neu = new Set(s);
      if (neu.has(id)) neu.delete(id);
      else neu.add(id);
      return neu;
    });
  }

  function lernen() {
    if (ausgewaehlt.size === 0) return;
    router.push(`/lernen?kapitel=${[...ausgewaehlt].join(",")}`);
  }

  if (!kapitel) return <main className="mx-auto max-w-xl p-6"><p>Lade …</p></main>;

  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col gap-5 p-6">
      <Link href="/" className="text-sm underline">← Zurück</Link>
      <h1 className="text-2xl font-bold">Meine Kapitel</h1>
      <p className="text-neutral-600">
        Wähle Kapitel zum Lernen aus (auch mehrere), oder tippe bei einem Kapitel auf &bdquo;Erfassen&ldquo;, um dort neue Vokabeln einzutragen.
      </p>

      <div className="flex flex-col gap-2">
        {kapitel.length === 0 && ohneAnzahl === 0 && (
          <p className="text-sm text-neutral-600">Noch kein Kapitel angelegt. Leg unten dein erstes an.</p>
        )}
        {kapitel.map((k) => (
          <div key={k.id} className="flex items-center justify-between gap-3 rounded-lg border border-neutral-300 p-3">
            <label className="flex flex-1 items-center gap-3">
              <input type="checkbox" checked={ausgewaehlt.has(k.id)} onChange={() => umschalten(k.id)} />
              <span>
                <span className="font-medium">{k.name}</span>{" "}
                <span className="text-xs text-neutral-500">({SPRACHE_NAME[k.sprache]} · {k.anzahl})</span>
              </span>
            </label>
            <Link href={`/erfassen?kapitel=${k.id}`} className="shrink-0 text-sm underline">Erfassen</Link>
          </div>
        ))}
        {ohneAnzahl > 0 && (
          <div className="flex items-center justify-between gap-3 rounded-lg border border-neutral-300 p-3">
            <label className="flex flex-1 items-center gap-3">
              <input type="checkbox" checked={ausgewaehlt.has(OHNE)} onChange={() => umschalten(OHNE)} />
              <span>
                <span className="font-medium">Ohne Kapitel</span>{" "}
                <span className="text-xs text-neutral-500">({ohneAnzahl})</span>
              </span>
            </label>
            <Link href="/erfassen" className="shrink-0 text-sm underline">Erfassen</Link>
          </div>
        )}
      </div>

      <button className={knopf} onClick={lernen} disabled={ausgewaehlt.size === 0}>
        Ausgewählte Kapitel lernen
      </button>

      <form onSubmit={anlegen} className="flex flex-col gap-2 rounded-lg border border-neutral-300 p-4">
        <p className="text-sm font-medium">Neues Kapitel anlegen</p>
        <div className="grid grid-cols-2 gap-2">
          {(["en", "la"] as const).map((s) => (
            <button key={s} type="button" onClick={() => setSprache(s)}
              className={`rounded-lg border p-2 text-sm font-medium ${sprache === s ? "border-black bg-black text-white" : "border-neutral-300"}`}>
              {SPRACHE_NAME[s]}
            </button>
          ))}
        </div>
        <input className={eingabe} placeholder="Name, z. B. Unit 3" required value={name} onChange={(e) => setName(e.target.value)} />
        <button className={knopf} type="submit" disabled={busy || !name.trim()}>Anlegen</button>
        {fehler && <p className="text-sm text-red-600">{fehler}</p>}
      </form>
    </main>
  );
}
