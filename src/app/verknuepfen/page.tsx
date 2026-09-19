"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { knopf } from "@/components/AuthLayout";

type Elternteil = { id: string; name: string };

export default function Verknuepfen() {
  const supabase = useRef(createClient()).current;
  const [eltern, setEltern] = useState<Elternteil[]>([]);
  const [code, setCode] = useState<string | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);

  const laden = useCallback(async () => {
    const { data: links } = await supabase.from("eltern_kind").select("eltern_id");
    const ids = (links ?? []).map((l) => l.eltern_id);
    if (ids.length === 0) return setEltern([]);
    const { data: profile } = await supabase.from("profil").select("user_id, name").in("user_id", ids);
    setEltern((profile ?? []).map((p) => ({ id: p.user_id, name: p.name })));
  }, [supabase]);

  useEffect(() => {
    laden();
  }, [laden]);

  async function codeErzeugen() {
    setFehler(null);
    const { data, error } = await supabase.rpc("einladungscode_erzeugen");
    if (error) return setFehler(error.message);
    setCode(data);
  }

  async function loesen(elternId: string) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.rpc("verknuepfung_loesen", { p_eltern: elternId, p_kind: user.id });
    laden();
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col gap-5 p-6">
      <Link href="/" className="text-sm underline">← Zurück</Link>
      <h1 className="text-2xl font-bold">Eltern verknüpfen</h1>
      <p className="text-neutral-600">
        Deine Eltern können dann sehen, wie du lernst, und dir Bildschirmzeit gutschreiben. Erzeuge einen Code
        und gib ihn deinem Elternteil. Es muss sich vorher in der App als Elternteil registriert haben.
      </p>

      <button className={knopf} onClick={codeErzeugen}>Code erzeugen</button>
      {code && (
        <div className="rounded-lg bg-neutral-100 p-4 text-center">
          <p className="text-3xl font-bold tracking-widest">{code}</p>
          <p className="mt-1 text-sm text-neutral-600">24 Stunden gültig, nur einmal benutzbar.</p>
        </div>
      )}
      {fehler && <p className="text-sm text-red-600">{fehler}</p>}

      <section>
        <h2 className="mb-2 font-semibold">Verknüpft mit</h2>
        {eltern.length === 0 ? (
          <p className="text-sm text-neutral-600">Noch niemand.</p>
        ) : (
          <ul className="divide-y divide-neutral-200 rounded-lg border border-neutral-200">
            {eltern.map((e) => (
              <li key={e.id} className="flex items-center justify-between p-3">
                <span>{e.name}</span>
                <button className="text-sm text-red-600 underline" onClick={() => loesen(e.id)}>Trennen</button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
