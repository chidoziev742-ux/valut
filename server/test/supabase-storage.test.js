import assert from "node:assert/strict";
import test from "node:test";
import { createSupabaseStorage } from "../src/services/supabaseStorage.js";

const storageConfig = {
  supabaseUrl: "https://storage.example",
  serviceRoleKey: "test-secret-key",
  bucket: "student-documents",
};
const objectPath = "11111111-1111-4111-8111-111111111111/33333333-3333-4333-8333-333333333333.pdf";
const requestId = "55555555-5555-4555-8555-555555555555";

test("Supabase Storage uploads successfully without logging diagnostics", async () => {
  const logged = [];
  const originalError = console.error;
  console.error = (...args) => logged.push(args.join(" "));
  try {
    const storage = createSupabaseStorage({
      storageConfig,
      fetchImpl: async () => new Response(null, { status: 200 }),
    });
    await storage.uploadObject(objectPath, Buffer.from("%PDF-test"), "application/pdf", { requestId });
    assert.deepEqual(logged, []);
  } finally {
    console.error = originalError;
  }
});

test("Supabase Storage failure logs only status, allowlisted code, and request ID", async () => {
  const logged = [];
  const originalError = console.error;
  console.error = (...args) => logged.push(args.join(" "));
  try {
    const storage = createSupabaseStorage({
      storageConfig,
      fetchImpl: async () => new Response(JSON.stringify({
        code: "BucketNotFound",
        message: "provider detail containing private text",
      }), { status: 404, headers: { "Content-Type": "application/json" } }),
    });
    await assert.rejects(
      storage.uploadObject(objectPath, Buffer.from("%PDF-test"), "application/pdf", { requestId }),
      (error) => {
        assert.equal(error.status, 503);
        assert.equal(error.code, "STORAGE_UNAVAILABLE");
        assert.equal(error.message, "Document storage could not complete the request.");
        return true;
      },
    );
    assert.equal(logged.length, 1);
    assert.deepEqual(JSON.parse(logged[0]), {
      level: "error",
      requestId,
      message: "Supabase Storage upload failed",
      status: 404,
      storageErrorCode: "BucketNotFound",
    });
    assert.equal(logged[0].includes("private text"), false);
    assert.equal(logged[0].includes(storageConfig.serviceRoleKey), false);
  } finally {
    console.error = originalError;
  }
});

test("Supabase Storage failure replaces unrecognized provider codes with UNKNOWN", async () => {
  const logged = [];
  const originalError = console.error;
  console.error = (...args) => logged.push(args.join(" "));
  try {
    const storage = createSupabaseStorage({
      storageConfig,
      fetchImpl: async () => new Response(JSON.stringify({
        code: "unexpected-provider-value",
      }), { status: 500, headers: { "Content-Type": "application/json" } }),
    });
    await assert.rejects(
      storage.uploadObject(objectPath, Buffer.from("%PDF-test"), "application/pdf", { requestId }),
      (error) => error.message === "Document storage could not complete the request.",
    );
    assert.equal(JSON.parse(logged[0]).storageErrorCode, "UNKNOWN");
    assert.equal(logged[0].includes("unexpected-provider-value"), false);
  } finally {
    console.error = originalError;
  }
});
