Deno.serve((req: Request) => {
  const headers = {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "Access-Control-Allow-Origin": "https://borjansaric.github.io",
    "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "X-Content-Type-Options": "nosniff"
  };
  if (req.method === "OPTIONS") return new Response("ok", { headers });
  return new Response(JSON.stringify({
    error: "Ovaj zastarjeli API endpoint je deaktiviran."
  }), { status: 410, headers });
});