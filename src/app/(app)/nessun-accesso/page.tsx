// Pagina di ripiego per un utente con accesso limitato a cui non è ancora
// stata concessa nessuna pagina (punto 13, 19/9) — evita che finisca su un
// redirect a vuoto o in un loop.
export default function NessunAccessoPage() {
  return (
    <div>
      <h1 className="mb-1 text-lg font-semibold text-neutral-900">Nessun accesso</h1>
      <p className="text-sm text-neutral-500">
        Il tuo account non ha ancora nessuna pagina abilitata. Chiedi a un amministratore di assegnarti
        l&apos;accesso dalla pagina Utenti.
      </p>
    </div>
  );
}
