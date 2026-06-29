export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function buildCacheRefreshScript() {
  return `
(() => {
  const target = "/?v=" + Date.now();

  try {
    const key = "leste-audio-refresh-at";
    const now = Date.now();
    const lastRefresh = Number(window.sessionStorage.getItem(key) || 0);

    if (now - lastRefresh > 5000) {
      window.sessionStorage.setItem(key, String(now));
      window.location.replace(target);
    }
  } catch {
    window.location.href = target;
  }
})();
`;
}

export async function GET() {
  return new Response(buildCacheRefreshScript(), {
    headers: {
      "Cache-Control": "no-store, max-age=0",
      "Content-Type": "application/javascript; charset=utf-8",
    },
  });
}
