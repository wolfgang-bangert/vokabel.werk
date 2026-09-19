import { createClient } from "@/lib/supabase/server";

export default async function Home() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col gap-4 p-6">
      <h1 className="text-2xl font-bold">vokabel.werk</h1>
      <p>Angemeldet als {user?.email}</p>
      <form action="/auth/signout" method="post">
        <button className="rounded border px-3 py-1 text-sm" type="submit">Abmelden</button>
      </form>
    </main>
  );
}
