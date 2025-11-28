"use client";

import { useEffect, useState, FormEvent } from "react";
import Image from "next/image";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

type Actor = {
  id: string;
  created_at: string | null;
  name: string;
  profile_image: string | null;
};

let supabase: SupabaseClient | null = null;

function getSupabaseClient() {
  if (!supabase) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    supabase = createClient(url, anonKey);
  }
  return supabase;
}

export default function DashboardPage() {
  const [actors, setActors] = useState<Actor[]>([]);
  const [supportingActors, setSupportingActors] = useState<Actor[]>([]); // actors2

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Form-States: Hauptdarsteller
  const [actorName, setActorName] = useState("");
  const [actorImageUrl, setActorImageUrl] = useState("");

  // Form-States: Nebendarsteller
  const [supportName, setSupportName] = useState("");
  const [supportImageUrl, setSupportImageUrl] = useState("");

  useEffect(() => {
    const client = getSupabaseClient();

    const loadData = async () => {
      try {
        setLoading(true);
        setError(null);

        const [actorsRes, actors2Res] = await Promise.all([
          client.from("actors").select("id, created_at, name, profile_image").order("created_at", { ascending: true }),
          client.from("actors2").select("id, created_at, name, profile_image").order("created_at", { ascending: true }),
        ]);

        if (actorsRes.error) throw actorsRes.error;
        if (actors2Res.error) throw actors2Res.error;

        setActors((actorsRes.data || []) as Actor[]);
        setSupportingActors((actors2Res.data || []) as Actor[]);
      } catch (err: any) {
        console.error(err);
        setError(err.message ?? "Fehler beim Laden der Daten.");
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  const handleAddActor = async (e: FormEvent) => {
    e.preventDefault();
    const name = actorName.trim();
    const img = actorImageUrl.trim();

    if (!name) return;

    const client = getSupabaseClient();

    const { data, error } = await client
      .from("actors")
      .insert({
        name,
        profile_image: img !== "" ? img : null,
      })
      .select("id, created_at, name, profile_image")
      .single();

    if (error) {
      console.error(error);
      setError(error.message);
      return;
    }

    if (data) {
      setActors((prev) => [...prev, data as Actor]);
      setActorName("");
      setActorImageUrl("");
    }
  };

  const handleAddSupportingActor = async (e: FormEvent) => {
    e.preventDefault();
    const name = supportName.trim();
    const img = supportImageUrl.trim();

    if (!name) return;

    const client = getSupabaseClient();

    const { data, error } = await client
      .from("actors2")
      .insert({
        name,
        profile_image: img !== "" ? img : null,
      })
      .select("id, created_at, name, profile_image")
      .single();

    if (error) {
      console.error(error);
      setError(error.message);
      return;
    }

    if (data) {
      setSupportingActors((prev) => [...prev, data as Actor]);
      setSupportName("");
      setSupportImageUrl("");
    }
  };

  return (
    <main className="min-h-screen bg-slate-950 text-slate-50 px-4 py-8">
      <div className="mx-auto w-full max-w-5xl space-y-8">
        {/* Kopfbereich – kannst du an dein Login/Header anpassen */}
        <header className="flex flex-col gap-2 border-b border-slate-800 pb-4 mb-4">
          <h1 className="text-3xl font-semibold tracking-tight">
            Film-Dashboard – Darstellerverwaltung
          </h1>
          <p className="text-sm text-slate-400">
            Hier kannst du Hauptdarsteller (<code>actors</code>) und
            Nebendarsteller (<code>actors2</code>) verwalten. Für beide gibt es
            optional ein Profilbild.
          </p>
        </header>

        {error && (
          <div className="rounded-lg border border-red-500 bg-red-950/40 px-4 py-3 text-sm text-red-100">
            Fehler: {error}
          </div>
        )}

        {loading ? (
          <div className="text-sm text-slate-300">Lade Daten…</div>
        ) : (
          <div className="grid gap-8 md:grid-cols-2">
            {/* Hauptdarsteller */}
            <section className="rounded-2xl border border-slate-800 bg-slate-900/40 p-4 md:p-5 space-y-4">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-xl font-semibold">Hauptdarsteller (actors)</h2>
                <span className="text-xs text-slate-400">
                  Gesamt: {actors.length}
                </span>
              </div>

              <form onSubmit={handleAddActor} className="space-y-3 border-b border-slate-800 pb-4">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-300">
                    Name
                  </label>
                  <input
                    type="text"
                    value={actorName}
                    onChange={(e) => setActorName(e.target.value)}
                    className="w-full rounded-md bg-slate-900 border border-slate-700 px-2 py-1.5 text-sm outline-none focus:border-sky-500"
                    placeholder="Name des Darstellers"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-300">
                    Profilbild-URL (optional)
                  </label>
                  <input
                    type="text"
                    value={actorImageUrl}
                    onChange={(e) => setActorImageUrl(e.target.value)}
                    className="w-full rounded-md bg-slate-900 border border-slate-700 px-2 py-1.5 text-sm outline-none focus:border-sky-500"
                    placeholder="https://…"
                  />
                  <p className="text-[10px] text-slate-500">
                    Du kannst hier direkt eine public URL aus Supabase Storage oder
                    extern eintragen. Leer lassen, wenn kein Bild.
                  </p>
                </div>

                <button
                  type="submit"
                  className="inline-flex items-center justify-center rounded-md bg-sky-600 px-3 py-1.5 text-xs font-medium hover:bg-sky-500 disabled:opacity-50"
                  disabled={!actorName.trim()}
                >
                  Hauptdarsteller hinzufügen
                </button>
              </form>

              <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
                {actors.length === 0 ? (
                  <p className="text-xs text-slate-500">
                    Noch keine Hauptdarsteller eingetragen.
                  </p>
                ) : (
                  actors.map((a) => (
                    <div
                      key={a.id}
                      className="flex items-center gap-3 rounded-lg border border-slate-800 bg-slate-950/40 px-3 py-2"
                    >
                      {a.profile_image ? (
                        <div className="relative h-10 w-10 overflow-hidden rounded-full border border-slate-700">
                          <Image
                            src={a.profile_image}
                            alt={a.name}
                            fill
                            sizes="40px"
                            className="object-cover"
                          />
                        </div>
                      ) : (
                        <div className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-700 bg-slate-900 text-xs text-slate-400">
                          N/A
                        </div>
                      )}
                      <div className="flex flex-col">
                        <span className="text-sm font-medium">{a.name}</span>
                        <span className="text-[10px] text-slate-500">
                          {a.created_at
                            ? new Date(a.created_at).toLocaleString()
                            : "—"}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </section>

            {/* Nebendarsteller */}
            <section className="rounded-2xl border border-slate-800 bg-slate-900/40 p-4 md:p-5 space-y-4">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-xl font-semibold">Nebendarsteller (actors2)</h2>
                <span className="text-xs text-slate-400">
                  Gesamt: {supportingActors.length}
                </span>
              </div>

              <form onSubmit={handleAddSupportingActor} className="space-y-3 border-b border-slate-800 pb-4">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-300">
                    Name
                  </label>
                  <input
                    type="text"
                    value={supportName}
                    onChange={(e) => setSupportName(e.target.value)}
                    className="w-full rounded-md bg-slate-900 border border-slate-700 px-2 py-1.5 text-sm outline-none focus:border-sky-500"
                    placeholder="Name des Nebendarstellers"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-300">
                    Profilbild-URL (optional)
                  </label>
                  <input
                    type="text"
                    value={supportImageUrl}
                    onChange={(e) => setSupportImageUrl(e.target.value)}
                    className="w-full rounded-md bg-slate-900 border border-slate-700 px-2 py-1.5 text-sm outline-none focus:border-sky-500"
                    placeholder="https://…"
                  />
                  <p className="text-[10px] text-slate-500">
                    Wird nur für Nebendarsteller genutzt. Leer lassen, wenn kein Bild.
                  </p>
                </div>

                <button
                  type="submit"
                  className="inline-flex items-center justify-center rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-medium hover:bg-emerald-500 disabled:opacity-50"
                  disabled={!supportName.trim()}
                >
                  Nebendarsteller hinzufügen
                </button>
              </form>

              <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
                {supportingActors.length === 0 ? (
                  <p className="text-xs text-slate-500">
                    Noch keine Nebendarsteller eingetragen.
                  </p>
                ) : (
                  supportingActors.map((a) => (
                    <div
                      key={a.id}
                      className="flex items-center gap-3 rounded-lg border border-slate-800 bg-slate-950/40 px-3 py-2"
                    >
                      {a.profile_image ? (
                        <div className="relative h-10 w-10 overflow-hidden rounded-full border border-slate-700">
                          <Image
                            src={a.profile_image}
                            alt={a.name}
                            fill
                            sizes="40px"
                            className="object-cover"
                          />
                        </div>
                      ) : (
                        <div className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-700 bg-slate-900 text-xs text-slate-400">
                          N/A
                        </div>
                      )}
                      <div className="flex flex-col">
                        <span className="text-sm font-medium">{a.name}</span>
                        <span className="text-[10px] text-slate-500">
                          {a.created_at
                            ? new Date(a.created_at).toLocaleString()
                            : "—"}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </section>
          </div>
        )}
      </div>
    </main>
  );
}
