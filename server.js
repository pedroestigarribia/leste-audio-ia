const { createServer } = require("http");
const { createReadStream, existsSync, readdirSync } = require("fs");
const next = require("next");
const path = require("path");

const port = Number(process.env.PORT || 3000);
const hostname = process.env.HOSTNAME || "0.0.0.0";
const app = next({ dev: false, hostname, port });
const handle = app.getRequestHandler();
const nextStaticDir = path.join(__dirname, ".next", "static");

function findFirstFile(directory, matcher) {
  try {
    return readdirSync(directory)
      .filter(matcher)
      .sort()
      .at(0);
  } catch {
    return undefined;
  }
}

function getLegacyAssetFallback(requestUrl) {
  const pathname = new URL(requestUrl || "/", "http://localhost").pathname;

  if (/^\/_next\/static\/css\/[^/]+\.css$/.test(pathname)) {
    const cssFile = findFirstFile(path.join(nextStaticDir, "css"), (fileName) =>
      fileName.endsWith(".css"),
    );
    return cssFile
      ? {
          contentType: "text/css; charset=utf-8",
          filePath: path.join(nextStaticDir, "css", cssFile),
        }
      : undefined;
  }

  if (/^\/_next\/static\/chunks\/app\/page-[^/]+\.js$/.test(pathname)) {
    const pageChunk = findFirstFile(path.join(nextStaticDir, "chunks", "app"), (fileName) =>
      /^page-[\w-]+\.js$/.test(fileName),
    );
    return pageChunk
      ? {
          contentType: "application/javascript; charset=utf-8",
          filePath: path.join(nextStaticDir, "chunks", "app", pageChunk),
        }
      : undefined;
  }

  if (/^\/_next\/static\/chunks\/(?:491|771)-[^/]+\.js$/.test(pathname)) {
    const clientChunk = findFirstFile(path.join(nextStaticDir, "chunks"), (fileName) =>
      /^498-[\w-]+\.js$/.test(fileName),
    );
    return clientChunk
      ? {
          contentType: "application/javascript; charset=utf-8",
          filePath: path.join(nextStaticDir, "chunks", clientChunk),
        }
      : undefined;
  }

  return undefined;
}

function serveFile(res, fallback) {
  if (!fallback || !existsSync(fallback.filePath)) {
    return false;
  }

  res.statusCode = 200;
  res.setHeader("Content-Type", fallback.contentType);
  res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
  createReadStream(fallback.filePath).pipe(res);
  return true;
}

app
  .prepare()
  .then(() => {
    createServer((req, res) => {
      if (req.url?.startsWith("/_next/static/")) {
        const fallback = getLegacyAssetFallback(req.url);

        if (serveFile(res, fallback)) {
          return;
        }
      }

      if (req.url === "/" || req.url?.startsWith("/?")) {
        res.setHeader("Cache-Control", "no-store, max-age=0");
      }

      handle(req, res);
    }).listen(port, hostname, () => {
      console.log(`Leste Audio IA running on http://${hostname}:${port}`);
    });
  })
  .catch((error) => {
    console.error("Failed to start Leste Audio IA.");
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
