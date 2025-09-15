import { createClient } from "@/app/utils/supabase/server";

export default async function Health() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();

  return (
    <main className="p-10">
      <h1 className="text-xl font-semibold">Supabase Health</h1>
      <p>{error ? `Error: ${error.message}` : "Supabase connected"}</p>
      <p>{user ? `User: ${user.email}` : "No user session"}</p>
    </main>
  );
}
