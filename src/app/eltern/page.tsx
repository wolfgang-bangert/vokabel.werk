"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { eingabe, knopf } from "@/components/AuthLayout";

type Tag = { datum: string; richtig: number; falsch: number };
type Uebersicht = {
  name: string;
  faecher: Record<string, number>;
  heute: number;
  ziel: number | null;
  minuten: number | null;
  saldo: number;
  tage: Tag[];
};
type Kind = { id: string; u: Uebersicht };

function KindKarte({ kind, neuLaden }: { kind: Kind; neuLaden: () => void }) {
  const supabase = useRef(createClient()).current;
  const u = kind.u;
  const [ziel, setZiel] = useState(String(u.ziel ?? 15));
  const [minuten, setMinuten] = useState(String(u.minuten ?? 30));
  const [einloesen, setEinloesen] = useState("");
  const [meldung, setMeldung] = useState<string | null>(null);

  async function regelSpeichern() {
    const { error } = await supabase
      .from("zeitregel")
      .update({ tagesziel: Number(ziel), minuten: Number(minuten) })
      .eq("kind_id", kind.id);
    setMeldung(error ? "Bitte Werte zwischen 1 und 500 (Ziel) und 0 bis 600 (Minuten) eingeben." : "Gespeichert.");
    if (!error) neuLaden();
  }

  async function zeitEinloesen() {
    setMeldung(null);
    const { error } = await supabase.rpc("zeit_einloesen", { p_kind: kind.id, p_minuten: Number(einloesen) });
    if (error) return setMeldung(error.message);
    setEinloesen("");
    neuLaden();
  }

  async function trennen() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user || !confirm(`Verknüpfung mit ${u.name} wirklich lösen?`)) return;
    await supabase.rpc("verknuepfung_loesen", { p_eltern: user.id, p_kind: kind.id });
    neuLaden();
  }

  return (
    <section className="flex flex-col gap-4 rounded-2xl border border-neutral-300 p-5">
      <h2 className="text-xl font-semibold">{u.name}</h2>

      <div className="grid grid-cols-2 gap-3 text-center">
        <div className="rounded-lg bg-neutral-100 p-3">
          <p className="text-2xl font-bold">{u.heute} / {u.ziel}</p>
          <p className="text-xs text-neutral-600">heute richtig</p>
        </div>
        <div className="rounded-lg bg-neutral-100 p-3">
          <p className="text-2xl font-bold">{u.saldo} Min.</p>
          <p className="text-xs text-neutral-600">Zeitkonto</p>
        </div>
      </div>

      <div>
        <p className="mb-1 text-sm font-medium">Vokabeln je Fach</p>
        <div className="grid grid-cols-6 gap-1 text-center text-sm">
          {[1, 2, 3, 4, 5, 6].map((f) => (
            <div key={f} className="rounded bg-neutral-100 p-2">
              <p className="font-semibold">{u.faecher[f] ?? 0}</p>
              <p className="text-xs text-neutral-500">{f === 6 ? "fertig" : `F${f}`}</p>
            </div>
          ))}
        </div>
      </div>

      <div>
        <p className="mb-1 text-sm font-medium">Letzte 7 Tage</p>
        {u.tage.length === 0 ? (
          <p className="text-sm text-neutral-600">Noch nicht gelernt.</p>
        ) : (
          <ul className="text-sm">
            {u.tage.map((t) => (
              <li key={t.datum} className="flex justify-between border-b border-neutral-100 py-1">
                <span>{new Date(t.datum).toLocaleDateString("de-DE", { weekday: "short", day: "2-digit", month: "2-digit" })}</span>
                <span>{t.richtig} richtig, {t.falsch} falsch</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <p className="text-sm font-medium">Zeit einlösen</p>
        <div className="flex gap-2">
          <input className={eingabe} type="number" min={1} inputMode="numeric" placeholder="Minuten"
            value={einloesen} onChange={(e) => setEinloesen(e.target.value)} />
          <button className="rounded-lg bg-black px-4 text-white disabled:opacity-50" onClick={zeitEinloesen}
            disabled={!einloesen}>Abbuchen</button>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <p className="text-sm font-medium">Regel: Tagesziel und Belohnung</p>
        <div className="grid grid-cols-2 gap-2">
          <label className="text-xs text-neutral-600">Richtige Antworten pro Tag
            <input className={eingabe} type="number" min={1} max={500} value={ziel} onChange={(e) => setZiel(e.target.value)} />
          </label>
          <label className="text-xs text-neutral-600">Minuten dafür
            <input className={eingabe} type="number" min={0} max={600} value={minuten} onChange={(e) => setMinuten(e.target.value)} />
          </label>
        </div>
        <button className="rounded-lg border border-neutral-300 p-2 text-sm" onClick={regelSpeichern}>Regel speichern</button>
      </div>

      {meldung && <p className="text-sm" role="status">{meldung}</p>}
      <button className="self-start text-sm text-red-600 underline" onClick={trennen}>Verknüpfung lösen</button>
    </section>
  );
}

export default function Eltern() {
  const supabase = useRef(createClient()).current;
  const [kinder, setKinder] = useState<Kind[] | null>(null);
  const [code, setCode] = useState("");
  const [fehler, setFehler] = useState<string | null>(null);

  const laden = useCallback(async () => {
    const { data: links } = await supabase.from("eltern_kind").select("kind_id");
    const liste = await Promise.all(
      (links ?? []).map(async (l) => {
        const { data } = await supabase.rpc("kind_uebersicht", { p_kind: l.kind_id });
        return data ? { id: l.kind_id as string, u: data as Uebersicht } : null;
      }),
    );
    setKinder(liste.filter((k): k is Kind => k !== null));
  }, [supabase]);

  useEffect(() => {
    laden();
  }, [laden]);

  async function verknuepfen(e: React.FormEvent) {
    e.preventDefault();
    setFehler(null);
    const { error } = await supabase.rpc("code_einloesen", { p_code: code });
    if (error) return setFehler(error.message);
    setCode("");
    laden();
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col gap-5 p-6">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Elternbereich</h1>
        <form action="/auth/signout" method="post">
          <button className="text-sm underline" type="submit">Abmelden</button>
        </form>
      </header>

      {kinder === null ? (
        <p>Lade …</p>
      ) : kinder.length === 0 ? (
        <p className="text-neutral-600">
          Noch kein Kind verknüpft. Dein Kind erzeugt in der App unter &bdquo;Mit einem Elternteil verknüpfen&ldquo; einen Code.
          Gib ihn hier ein.
        </p>
      ) : (
        kinder.map((k) => <KindKarte key={k.id} kind={k} neuLaden={laden} />)
      )}

      <form onSubmit={verknuepfen} className="flex flex-col gap-2">
        <p className="text-sm font-medium">Kind verknüpfen</p>
        <div className="flex gap-2">
          <input className={`${eingabe} uppercase tracking-widest`} placeholder="Code" maxLength={8} required
            autoCapitalize="characters" autoComplete="off" value={code} onChange={(e) => setCode(e.target.value)} />
          <button className={`${knopf} w-auto px-5`} type="submit">Verknüpfen</button>
        </div>
        {fehler && <p className="text-sm text-red-600">{fehler}</p>}
      </form>
    </main>
  );
}
