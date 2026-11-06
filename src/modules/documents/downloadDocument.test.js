import assert from "node:assert/strict";
import test from "node:test";
import { downloadDocumentFile, getDocumentDownloadFilename } from "./downloadDocument.js";

function createBrowserMocks() {
  const clicked = [];
  const appended = [];
  const removed = [];
  const revoked = [];
  const blob = new Blob(["document bytes"], { type: "image/png" });
  const documentRef = {
    body: { append: (element) => appended.push(element) },
    createElement: (tagName) => {
      assert.equal(tagName, "a");
      return {
        click() { clicked.push({ href: this.href, download: this.download }); },
        remove() { removed.push(true); },
      };
    },
  };
  const URLApi = {
    createObjectURL(value) {
      assert.equal(value, blob);
      return "blob:document-download";
    },
    revokeObjectURL(value) { revoked.push(value); },
  };
  const scheduled = [];
  return {
    blob,
    clicked,
    appended,
    removed,
    revoked,
    scheduled,
    documentRef,
    URLApi,
    schedule(callback, delay) { scheduled.push({ callback, delay }); },
  };
}

test("downloads a fetched document blob using its original filename", async () => {
  const browser = createBrowserMocks();
  let requestedUrl;
  await downloadDocumentFile("https://storage.example/signed", "student-id.png", {
    fetchImpl: async (url) => {
      requestedUrl = url;
      return { ok: true, blob: async () => browser.blob };
    },
    ...browser,
  });
  assert.equal(requestedUrl, "https://storage.example/signed");
  assert.deepEqual(browser.clicked, [{ href: "blob:document-download", download: "student-id.png" }]);
  assert.equal(browser.appended.length, 1);
  assert.equal(browser.removed.length, 1);
  assert.equal(browser.scheduled[0].delay, 1000);
  browser.scheduled[0].callback();
  assert.deepEqual(browser.revoked, ["blob:document-download"]);
});

test("strips path separators from the suggested download filename", async () => {
  const browser = createBrowserMocks();
  await downloadDocumentFile("https://storage.example/signed", "../transcript.pdf", {
    fetchImpl: async () => ({ ok: true, blob: async () => browser.blob }),
    ...browser,
  });
  assert.equal(browser.clicked[0].download, "transcript.pdf");
});

test("downloads a renamed document using its latest title and original extension", async () => {
  const browser = createBrowserMocks();
  const renamedDocument = {
    name: "My Admission Letter",
    fileType: "PNG",
    fileExtension: ".png",
    originalFilename: "old-admission-scan.png",
  };
  await downloadDocumentFile(
    "https://storage.example/signed",
    getDocumentDownloadFilename(renamedDocument),
    {
      fetchImpl: async () => ({ ok: true, blob: async () => browser.blob }),
      ...browser,
    },
  );
  assert.equal(browser.clicked[0].download, "My Admission Letter.png");
});

test("reports failed signed-file fetches without triggering a download", async () => {
  const browser = createBrowserMocks();
  await assert.rejects(
    downloadDocumentFile("https://storage.example/signed", "document.pdf", {
      fetchImpl: async () => ({ ok: false, blob: async () => browser.blob }),
      ...browser,
    }),
    { message: "The document could not be downloaded. Please try again." },
  );
  assert.deepEqual(browser.clicked, []);
  assert.deepEqual(browser.appended, []);
});
