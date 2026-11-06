import assert from "node:assert/strict";
import test from "node:test";
import {
  createAcademicRecord,
  deleteAcademicRecord,
  listAcademicRecords,
  updateAcademicRecord,
} from "./academicRecordsApi.js";

const record = {
  id: "a6caac4e-4e51-46c9-8be3-2b534cc1a799",
  recordType: "Programme information",
  title: "Current programme",
  institution: "Example University",
  programme: "BSc Computing",
  academicSession: "2026/2027",
  semester: "",
  level: "300 level",
  details: "",
  createdAt: "2026-11-06T10:00:00.000Z",
  updatedAt: "2026-11-06T10:00:00.000Z",
};

test("lists persisted academic records and rejects invalid response shapes", async () => {
  const listed = await listAcademicRecords(async (path) => {
    assert.equal(path, "/api/student/academic-records");
    return { records: [record] };
  });
  assert.deepEqual(listed, [record]);

  await assert.rejects(
    listAcademicRecords(async () => ({ records: [{ ...record, id: undefined }] })),
    /invalid academic record data/i,
  );
});

test("creates a record through the authenticated API with CSRF and no user ID", async () => {
  const values = {
    recordType: record.recordType,
    title: record.title,
    institution: record.institution,
    programme: record.programme,
    academicSession: record.academicSession,
    semester: "",
    level: record.level,
    details: "",
  };
  const created = await createAcademicRecord(values, "csrf-value", async (path, options) => {
    assert.equal(path, "/api/student/academic-records");
    assert.equal(options.method, "POST");
    assert.deepEqual(options.body, values);
    assert.equal(options.csrfToken, "csrf-value");
    assert.equal(Object.hasOwn(options.body, "user_id"), false);
    return { record };
  });
  assert.deepEqual(created, record);
});

test("edits a record using its encoded ID and applies the returned record", async () => {
  const updated = { ...record, title: "Updated programme" };
  const result = await updateAcademicRecord("record/id", { title: updated.title }, "csrf-value", async (path, options) => {
    assert.equal(path, "/api/student/academic-records/record%2Fid");
    assert.equal(options.method, "PATCH");
    assert.deepEqual(options.body, { title: updated.title });
    assert.equal(options.csrfToken, "csrf-value");
    return { record: updated };
  });
  assert.deepEqual(result, updated);
});

test("deletes a record only after the API confirms the request", async () => {
  let confirmed = false;
  await deleteAcademicRecord(record.id, "csrf-value", async (path, options) => {
    assert.equal(path, `/api/student/academic-records/${record.id}`);
    assert.equal(options.method, "DELETE");
    assert.equal(options.csrfToken, "csrf-value");
    confirmed = true;
  });
  assert.equal(confirmed, true);

  await assert.rejects(
    deleteAcademicRecord(record.id, "csrf-value", async () => {
      throw new Error("request rejected");
    }),
    /request rejected/,
  );
});

test("propagates API failures without converting them into successful results", async () => {
  const failure = new Error("server unavailable");
  await assert.rejects(listAcademicRecords(async () => { throw failure; }), failure);
  await assert.rejects(createAcademicRecord({}, "csrf-value", async () => { throw failure; }), failure);
  await assert.rejects(updateAcademicRecord(record.id, {}, "csrf-value", async () => { throw failure; }), failure);
});
