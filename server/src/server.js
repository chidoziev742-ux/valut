import { createApp } from "./app.js";
import { config } from "./config.js";
import { closePool } from "./db/pool.js";

const app = createApp();
const server = app.listen(config.port, config.host, () => {
  console.log(`Student Vault API listening at http://${config.host}:${config.port}`);
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
