export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return new Response("/* stale stylesheet recovered by Leste Audio IA */\n", {
    headers: {
      "Cache-Control": "no-store, max-age=0",
      "Content-Type": "text/css; charset=utf-8",
    },
  });
}
