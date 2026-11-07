import { createApp } from "./app.js";
import { closePool } from "./db/pool.js";

const app = createApp();
const port = process.env.PORT || 4000;
const host = "0.0.0.0";
const server = app.listen(port, host, () => {
  console.log(`Student Vault API listening at http://${host}:${port}`);
});

function shutdown(signal) {
  console.log(`Received ${signal}; closing the API server.`);
  server.close((error) => {
    if (error) {
      console.error("The API server did not close cleanly.");
      process.exitCode = 1;
    }

    closePool().catch(() => {
      console.error("The database pool did not close cleanly.");
      process.exitCode = 1;
    });
  });
}

process.once("SIGINT", () => shutdown("SIGINT"));
process.once("SIGTERM", () => shutdown("SIGTERM"));
