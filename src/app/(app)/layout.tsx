import { NavBar } from "@/components/NavBar";
import { createClient } from "@/lib/supabase/server";
import { PAGINE, leggiPermessi, puoVedere } from "@/lib/permessi";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Il middleware (proxy.ts) garantisce già che qui arrivi solo un utente
  // loggato; il controllo "user ?" è solo una guardia difensiva.
  const permessi = user ? await leggiPermessi(supabase, user.id) : null;
  const voci = permessi
    ? PAGINE.filter((p) => puoVedere(permessi, p.id)).map((p) => ({ href: p.href, label: p.label }))
    : [];

  return (
    <div className="flex min-h-screen flex-col bg-neutral-50">
      <NavBar voci={voci} mostraUtenti={permessi?.isAdmin ?? false} />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6">
        {children}
      </main>
    </div>
  );
}
