import assert from "node:assert/strict";
import { createServer } from "node:http";
import test from "node:test";Approved. Implement `server/scripts/verify-db-connection.js` using the proposed read-only approach.

Before implementation:
1. Confirm whether `query()` already invokes `readDatabaseUrl()` validation. Reuse the existing validation path; avoid redundant configuration logic.
2. Load `server/.env` without printing its contents.
3. Query only `current_database()`, `current_user`, and `version()`.
4. Print only those three result fields. Never log `DATABASE_URL`, passwords, or raw connection errors.
5. Always close the pool, including on failure.
6. Do not apply migrations or modify database data.

After creating the script, run the connection check only. Report the database name, role, PostgreSQL version, and success/failure. Do not print connection details or credentials.
import express from "express";

const allowedOrigin = "http://localhost:5173";
process.env.FRONTEND_ORIGIN = allowedOrigin;
process.env.JSON_BODY_LIMIT = "100kb";
process.env.STUDENT_VAULT_TEST_SECRET = "do-not-expose-this-test-secret";

const { createApp, safeErrorHandler } = await import("../src/app.js");

async function withServer(app, run) {
  const server = createServer(app);
  server.listen(0, "127.0.0.1");
  await new Promise((resolve, reject) => {
    server.once("listening", resolve);
    server.once("error", reject);
  });

  const address = server.address();
  const baseUrl = "http://127.0.0.1:" + address.port;

  try {
    await run(baseUrl);
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
      server.closeAllConnections?.();
    });
  }
}

test("GET /api/health returns the expected healthy response", async () => {
  await withServer(createApp(), async (baseUrl) => {
    const response = await fetch(baseUrl + "/api/health");
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {
      status: "ok",
      service: "student-vault-api",
    });
  });
});

test("the configured frontend origin receives CORS permission", async () => {
  await withServer(createApp(), async (baseUrl) => {
    const response = await fetch(baseUrl + "/api/health", {
      headers: { Origin: allowedOrigin },
    });
    assert.equal(response.headers.get("access-control-allow-origin"), allowedOrigin);
    assert.match(response.headers.get("vary") ?? "", /Origin/i);
  });
});

test("a disallowed browser origin receives no CORS permission", async () => {
  await withServer(createApp(), async (baseUrl) => {
    const response = await fetch(baseUrl + "/api/health", {
      headers: { Origin: "https://untrusted.example" },
    });
    assert.equal(response.headers.get("access-control-allow-origin"), null);
  });
});

test("malformed JSON returns a safe HTTP 400 response", async () => {
  await withServer(createApp(), async (baseUrl) => {
    const response = await fetch(baseUrl + "/api/health", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{ malformed",
    });
    const body = await response.json();
    assert.equal(response.status, 400);
    assert.equal(body.error.code, "INVALID_REQUEST");
    assert.equal(body.error.message, "The request body is invalid.");
    assert.ok(body.error.requestId);
  });
});

test("oversized JSON returns HTTP 413", async () => {
  await withServer(createApp(), async (baseUrl) => {
    const body = JSON.stringify({ payload: "x".repeat(101 * 1024) });
    const response = await fetch(baseUrl + "/api/health", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
    });
    const result = await response.json();
    assert.equal(response.status, 413);
    assert.equal(result.error.code, "REQUEST_TOO_LARGE");
    assert.equal(result.error.message, "The request body exceeds the allowed size.");
  });
});

test("unknown routes return the expected 404 error structure", async () => {
  await withServer(createApp(), async (baseUrl) => {
    const response = await fetch(baseUrl + "/api/not-a-route");
    const body = await response.json();
    assert.equal(response.status, 404);
    assert.equal(body.error.code, "NOT_FOUND");
    assert.equal(body.error.message, "The requested API route was not found.");
    assert.equal(body.error.requestId, response.headers.get("x-request-id"));
  });
});

test("unexpected errors do not expose stack, internal messages, or environment secrets", async () => {
  const app = express();
  app.use((req, res, next) => {
    req.requestId = "test-request-id";
    next();
  });
  app.get("/trigger-error", () => {
    throw new Error("internal failure: " + process.env.STUDENT_VAULT_TEST_SECRET);
  });
  app.use(safeErrorHandler);

  await withServer(app, async (baseUrl) => {
    const response = await fetch(baseUrl + "/trigger-error");
    const text = await response.text();
    assert.equal(response.status, 500);
    assert.doesNotMatch(text, /internal failure/i);
    assert.doesNotMatch(text, /do-not-expose-this-test-secret/);
    assert.doesNotMatch(text, /Error:|at /);
    assert.deepEqual(JSON.parse(text), {
      error: {
        code: "INTERNAL_ERROR",
        message: "An unexpected server error occurred.",
        requestId: "test-request-id",
      },
    });
  });
});
