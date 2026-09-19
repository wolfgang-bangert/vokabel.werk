"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { AuthLayout, eingabe, knopf } from "@/components/AuthLayout";

function deutsch(msg: string) {
  if (/invalid login credentials/i.test(msg)) return "E-Mail oder Passwort stimmt nicht.";
  if (/email not confirmed/i.test(msg)) return "Bitte bestätige zuerst deine E-Mail-Adresse (Link in der Mail).";
  if (/already registered/i.test(msg)) return "Diese E-Mail ist schon registriert. Bitte melde dich an.";
  if (/at least/i.test(msg)) return "Das Passwort muss mindestens 8 Zeichen haben.";
  if (/rate limit/i.test(msg)) return "Zu viele Versuche. Bitte warte kurz und probiere es dann nochmal.";
  return msg;
}

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState("");
  const [passwort, setPasswort] = useState("");
  const [registrieren, setRegistrieren] = useState(false);
  const [busy, setBusy] = useState(false);
  const [meldung, setMeldung] = useState<{ text: string; fehler: boolean } | null>(
    params.get("fehler") === "link"
      ? { text: "Der Link ist abgelaufen oder ungültig. Bitte fordere einen neuen an.", fehler: true }
      : null,
  );

  async function absenden(e: React.FormEvent) {
    e.preventDefault();
    setMeldung(null);
    setBusy(true);
    const supabase = createClient();
    if (registrieren) {
      const { data, error } = await supabase.auth.signUp({
        email,
        password: passwort,
        options: { emailRedirectTo: `${location.origin}/auth/callback` },
      });
      setBusy(false);
      if (error) return setMeldung({ text: deutsch(error.message), fehler: true });
      if (data.session) return router.replace("/");
      return setMeldung({ text: "Fast geschafft! Wir haben dir eine Mail geschickt. Klicke auf den Link darin.", fehler: false });
    }
    const { error } = await supabase.auth.signInWithPassword({ email, password: passwort });
    setBusy(false);
    if (error) return setMeldung({ text: deutsch(error.message), fehler: true });
    router.replace("/");
    router.refresh();
  }

  return (
    <AuthLayout titel={registrieren ? "Konto erstellen" : "Anmelden"}>
      <form onSubmit={absenden} className="flex flex-col gap-3">
        <input className={eingabe} type="email" placeholder="E-Mail" autoComplete="email" required
          value={email} onChange={(e) => setEmail(e.target.value)} />
        <input className={eingabe} type="password" placeholder="Passwort (mind. 8 Zeichen)" required minLength={8}
          autoComplete={registrieren ? "new-password" : "current-password"}
          value={passwort} onChange={(e) => setPasswort(e.target.value)} />
        <button className={knopf} type="submit" disabled={busy}>
          {registrieren ? "Registrieren" : "Anmelden"}
        </button>
      </form>
      {meldung && (
        <p className={`text-sm ${meldung.fehler ? "text-red-600" : "text-green-700"}`} role="status">{meldung.text}</p>
      )}
      <div className="flex flex-col gap-2 text-sm">
        <button className="text-left underline" onClick={() => { setRegistrieren(!registrieren); setMeldung(null); }}>
          {registrieren ? "Schon ein Konto? Anmelden" : "Neu hier? Konto erstellen"}
        </button>
        {!registrieren && <Link className="underline" href="/passwort-vergessen">Passwort vergessen?</Link>}
      </div>
    </AuthLayout>
  );
}

export default function LoginPage() {
  return <Suspense><LoginForm /></Suspense>;
}
