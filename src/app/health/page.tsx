import { createClient } from "@/app/utils/supabase/server";

export default async function Health() {
    const supabase = await createClient();
  
    // Don't treat "Auth session missing!" as a failure
    const { data, error } = await supabase.auth.getUser();
    const user = data?.user ?? null;
  
    return (
      <main className="p-10">
        <h1 className="text-xl font-semibold">Supabase Health</h1>
        <p>Supabase connected</p>
        <p>{user ? `User: ${user.email}` : "No user session"}</p>
  
        {/* Debug info if it's a different error */}
        {error && error.message !== "Auth session missing!" && (
          <pre className="mt-4 text-sm">Error: {error.message}</pre>
        )}
      </main>
    );
  }