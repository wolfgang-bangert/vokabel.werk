import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export default async function Home() {
  const supabase = await createClient();
  const { count } = await supabase
    .from("vokabel")
    .select("id", { count: "exact", head: true })
    .lt("fach", 6)
    .lte("faellig_am", new Date().toISOString());
  const faellig = count ?? 0;

  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col gap-4 p-6">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">vokabel.werk</h1>
        <form action="/auth/signout" method="post">
          <button className="text-sm underline" type="submit">Abmelden</button>
        </form>
      </header>

      <Link href="/erfassen" className="rounded-2xl border border-neutral-300 p-6 active:bg-neutral-100">
        <p className="text-xl font-semibold">Neue Vokabeln erfassen</p>
        <p className="text-sm text-neutral-600">Englisch oder Latein eintragen</p>
      </Link>

      <Link href="/lernen" className="rounded-2xl border border-neutral-300 p-6 active:bg-neutral-100">
        <p className="text-xl font-semibold">Lernen</p>
        <p className="text-sm text-neutral-600">
          {faellig > 0 ? `${faellig} Vokabel${faellig === 1 ? "" : "n"} zum Wiederholen` : "Heute ist nichts fällig"}
        </p>
      </Link>
    </main>
  );
}
