"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [passwort, setPasswort] = useState("");
  const [registrieren, setRegistrieren] = useState(false);
  const [meldung, setMeldung] = useState<string | null>(null);

  async function absenden(e: React.FormEvent) {
    e.preventDefault();
    setMeldung(null);
    const supabase = createClient();
    const { error } = registrieren
      ? await supabase.auth.signUp({ email, password: passwort })
      : await supabase.auth.signInWithPassword({ email, password: passwort });
    if (error) return setMeldung(error.message);
    if (registrieren) return setMeldung("Bitte bestätige deine E-Mail-Adresse.");
    router.push("/");
    router.refresh();
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-4 p-6">
      <h1 className="text-2xl font-bold">vokabel.werk</h1>
      <form onSubmit={absenden} className="flex flex-col gap-3">
        <input className="rounded border p-2" type="email" placeholder="E-Mail" required
          value={email} onChange={(e) => setEmail(e.target.value)} />
        <input className="rounded border p-2" type="password" placeholder="Passwort" required minLength={8}
          value={passwort} onChange={(e) => setPasswort(e.target.value)} />
        <button className="rounded bg-black p-2 text-white" type="submit">
          {registrieren ? "Registrieren" : "Anmelden"}
        </button>
      </form>
      <button className="text-sm underline" onClick={() => setRegistrieren(!registrieren)}>
        {registrieren ? "Schon ein Konto? Anmelden" : "Neu hier? Registrieren"}
      </button>
      {meldung && <p className="text-sm text-red-600">{meldung}</p>}
    </main>
  );
}
