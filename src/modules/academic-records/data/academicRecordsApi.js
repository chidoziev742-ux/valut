import { apiRequest } from "../../../api/apiClient.js";
import { academicRecordTypes } from "./academicRecordValidation.js";

const endpoint = "/api/student/academic-records";
const recordFields = [
  "id",
  "recordType",
  "title",
  "institution",
  "programme",
  "academicSession",
  "semester",
  "level",
  "details",
  "createdAt",
  "updatedAt",
];

function isAcademicRecord(record) {
  return record
    && typeof record === "object"
    && typeof record.id === "string"
    && academicRecordTypes.includes(record.recordType)
    && recordFields.slice(2).every((field) => typeof record[field] === "string");
}

function requireRecord(payload) {
  if (!isAcademicRecord(payload?.record)) {
    throw new Error("The server returned invalid academic record data.");
  }
  return payload.record;
}

export async function listAcademicRecords(request = apiRequest) {
  const payload = await request(endpoint);
  if (!Array.isArray(payload?.records) || payload.records.some((record) => !isAcademicRecord(record))) {
    throw new Error("The server returned invalid academic record data.");
  }
  return payload.records;
}

export async function createAcademicRecord(values, csrfToken, request = apiRequest) {
  return requireRecord(await request(endpoint, {
    method: "POST",
    body: values,
    csrfToken,
  }));
}

export async function updateAcademicRecord(recordId, values, csrfToken, request = apiRequest) {
  return requireRecord(await request(`${endpoint}/${encodeURIComponent(recordId)}`, {
    method: "PATCH",
    body: values,
    csrfToken,
  }));
}

export async function deleteAcademicRecord(recordId, csrfToken, request = apiRequest) {
  await request(`${endpoint}/${encodeURIComponent(recordId)}`, {
    method: "DELETE",
    csrfToken,
  });
}
