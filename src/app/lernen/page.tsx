import Link from "next/link";

export default function Seite() {
  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col gap-4 p-6">
      <Link href="/" className="text-sm underline">← Zurück</Link>
      <h1 className="text-2xl font-bold">Lernen</h1>
      <p className="text-neutral-600">Kommt als Nächstes.</p>
    </main>
  );
}
