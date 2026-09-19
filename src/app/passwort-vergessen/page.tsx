"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { AuthLayout, eingabe, knopf } from "@/components/AuthLayout";

export default function PasswortVergessen() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [gesendet, setGesendet] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);

  async function absenden(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setFehler(null);
    const { error } = await createClient().auth.resetPasswordForEmail(email, {
      redirectTo: `${location.origin}/auth/callback?next=/passwort-neu`,
    });
    setBusy(false);
    if (error) return setFehler("Das hat nicht geklappt. Bitte probiere es gleich nochmal.");
    setGesendet(true);
  }

  return (
    <AuthLayout titel="Passwort vergessen">
      {gesendet ? (
        <p className="text-sm text-green-700" role="status">
          Wenn es ein Konto mit dieser E-Mail gibt, haben wir dir einen Link zum Zurücksetzen geschickt.
        </p>
      ) : (
        <form onSubmit={absenden} className="flex flex-col gap-3">
          <input className={eingabe} type="email" placeholder="E-Mail" autoComplete="email" required
            value={email} onChange={(e) => setEmail(e.target.value)} />
          <button className={knopf} type="submit" disabled={busy}>Link schicken</button>
          {fehler && <p className="text-sm text-red-600">{fehler}</p>}
        </form>
      )}
      <Link className="text-sm underline" href="/login">Zurück zur Anmeldung</Link>
    </AuthLayout>
  );
}
