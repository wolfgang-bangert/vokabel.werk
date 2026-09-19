export function AuthLayout({ titel, children }: { titel: string; children: React.ReactNode }) {
  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-5 p-6">
      <div>
        <p className="text-sm font-medium text-neutral-500">vokabel.werk</p>
        <h1 className="text-2xl font-bold">{titel}</h1>
      </div>
      {children}
    </main>
  );
}

export const eingabe = "w-full rounded-lg border border-neutral-300 p-3 text-base";
export const knopf = "w-full rounded-lg bg-black p-3 text-base font-medium text-white disabled:opacity-50";
