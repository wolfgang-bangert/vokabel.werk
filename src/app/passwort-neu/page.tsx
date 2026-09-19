"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { AuthLayout, eingabe, knopf } from "@/components/AuthLayout";

export default function PasswortNeu() {
  const router = useRouter();
  const [passwort, setPasswort] = useState("");
  const [busy, setBusy] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);

  async function absenden(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setFehler(null);
    const { error } = await createClient().auth.updateUser({ password: passwort });
    setBusy(false);
    if (error) return setFehler("Das Passwort konnte nicht geändert werden. Mindestens 8 Zeichen, und es darf nicht das alte sein.");
    router.replace("/");
    router.refresh();
  }

  return (
    <AuthLayout titel="Neues Passwort">
      <form onSubmit={absenden} className="flex flex-col gap-3">
        <input className={eingabe} type="password" placeholder="Neues Passwort (mind. 8 Zeichen)" required minLength={8}
          autoComplete="new-password" value={passwort} onChange={(e) => setPasswort(e.target.value)} />
        <button className={knopf} type="submit" disabled={busy}>Passwort speichern</button>
        {fehler && <p className="text-sm text-red-600">{fehler}</p>}
      </form>
    </AuthLayout>
  );
}
