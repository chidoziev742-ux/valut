import assert from "node:assert/strict";
import test from "node:test";
import { normalizeDocumentPreviewUrl } from "./previewUrl.js";

test("adds the Supabase Storage API prefix to signed object paths", () => {
  assert.equal(
    normalizeDocumentPreviewUrl("https://project.example/object/sign/student-document/page.png?token=secret"),
    "https://project.example/storage/v1/object/sign/student-document/page.png?token=secret",
  );
});

test("preserves already-prefixed signed URLs", () => {
  assert.equal(
    normalizeDocumentPreviewUrl("https://project.example/storage/v1/object/sign/student-document/page.pdf?token=secret"),
    "https://project.example/storage/v1/object/sign/student-document/page.pdf?token=secret",
  );
});

test("rejects malformed or non-URL preview links", () => {
  assert.throws(() => normalizeDocumentPreviewUrl("not a URL"), TypeError);
});
