import assert from "node:assert/strict";
import test from "node:test";
import { normalizeFolderName, validateFolderName } from "./folderValidation.js";

test("folder names are normalized and validated against persisted folders", () => {
  const folders = [{ id: "folder-1", name: "Course Notes" }];
  assert.equal(normalizeFolderName("  Course   Notes "), "Course Notes");
  assert.deepEqual(validateFolderName("New Folder", folders), { name: "New Folder" });
  assert.deepEqual(validateFolderName(" course NOTES ", folders), {
    error: "A folder with this name already exists.",
  });
  assert.deepEqual(validateFolderName("Course Notes", folders, "folder-1"), { name: "Course Notes" });
  assert.deepEqual(validateFolderName(" ".repeat(2), folders), { error: "Enter a folder name." });
  assert.deepEqual(validateFolderName("x".repeat(61), folders), { error: "Use 60 characters or fewer." });
});
