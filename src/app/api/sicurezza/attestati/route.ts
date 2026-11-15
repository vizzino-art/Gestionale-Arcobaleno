import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { elencaCartella, tokenDropbox } from "@/lib/dropbox";

// Modulo Sicurezza, passo 5 (15/11/2026): elenco dei PDF nella cartella
// Dropbox degli attestati, per sceglierli dal modulo "corso" invece di
// scrivere il percorso a mano. Solo lettura, solo admin.
export const runtime = "nodejs";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ errore: "Non autenticato" }, { status: 401 });
  const { data: profilo } = await supabase
    .from("profili_utente")
    .select("is_admin")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!profilo?.is_admin) return NextResponse.json({ errore: "Solo amministratori" }, { status: 403 });

  try {
    const radice = process.env.DROPBOX_CARTELLA_ARCOBALENO?.trim() || "/Arcobaleno";
    const voci = await elencaCartella(await tokenDropbox(), `${radice}/Sicurezza`);
    const file = voci
      .filter((v) => v[".tag"] === "file")
      .map((v) => v.path_display)
      .sort((a, b) => a.localeCompare(b, "it"));
    return NextResponse.json({ file });
  } catch (e) {
    return NextResponse.json({ errore: e instanceof Error ? e.message : "Errore Dropbox" }, { status: 500 });
  }
}
