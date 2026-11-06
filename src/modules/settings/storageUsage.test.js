import assert from "node:assert/strict";
import test from "node:test";
import { formatStorageBytes, getStorageCategoryWidths } from "./storageUsage.js";

test("formats storage usage without assuming a quota", () => {
  assert.equal(formatStorageBytes(0), "0 KB");
  assert.equal(formatStorageBytes(741 * 1024), "741 KB");
  assert.equal(formatStorageBytes(2 * 1024 * 1024), "2.0 MB");
});

test("calculates category visualization from persisted byte totals", () => {
  assert.deepEqual(
    getStorageCategoryWidths([
      { category: "Academic Records", count: 2, storageBytes: 300 },
      { category: "Personal Documents", count: 1, storageBytes: 100 },
    ], 400).map(({ width }) => width),
    [75, 25],
  );
  assert.deepEqual(getStorageCategoryWidths([{ storageBytes: 100 }], 0), []);
});
