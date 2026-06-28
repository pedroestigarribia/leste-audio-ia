const { createServer } = require("http");
const next = require("next");

const port = Number(process.env.PORT || 3000);
const hostname = process.env.HOSTNAME || "0.0.0.0";
const app = next({ dev: false, hostname, port });
const handle = app.getRequestHandler();

app
  .prepare()
  .then(() => {
    createServer((req, res) => {
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
