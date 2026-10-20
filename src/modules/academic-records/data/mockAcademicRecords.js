export const academicRecordTypes = [
  "Programme information",
  "Semester result",
  "Course record",
];

export const mockAcademicRecords = [
  {
    id: "record-programme-sample",
    recordType: "Programme information",
    institution: "Sample University",
    programme: "BSc Computer Science",
    academicSession: "2025/2026",
    semester: "",
    level: "300 level",
    title: "Current programme",
    details: "Illustrative programme information for the Student Vault prototype.",
    createdAt: "2026-10-01",
    updatedAt: "2026-10-01",
  },
  {
    id: "record-result-sample",
    recordType: "Semester result",
    institution: "Sample University",
    programme: "BSc Computer Science",
    academicSession: "2024/2025",
    semester: "Second semester",
    level: "200 level",
    title: "Second semester results",
    details: "Sample record only. No result has been verified by an institution.",
    createdAt: "2026-09-22",
    updatedAt: "2026-09-22",
  },
];

export function academicRecordReducer(state, action) {
  switch (action.type) {
    case "create":
      return [action.record, ...state];
    case "update":
      return state.map((record) => record.id === action.id ? { ...record, ...action.changes } : record);
    case "delete":
      return state.filter((record) => record.id !== action.id);
    default:
      return state;
  }
}

export function validateAcademicRecord(values) {
  const required = ["recordType", "institution", "programme", "academicSession", "title"];
  if (values.recordType === "Semester result") required.push("semester");
  for (const field of required) {
    if (!String(values[field] ?? "").trim()) return { error: "Complete all required fields." };
  }
  for (const field of required) {
    if (String(values[field]).trim().length > (field === "title" ? 100 : 100)) {
      return { error: "Keep required fields to 100 characters or fewer." };
    }
  }
  if (String(values.details ?? "").length > 1000) return { error: "Details must be 1,000 characters or fewer." };
  return {
    record: {
      recordType: String(values.recordType).trim(),
      institution: String(values.institution).trim(),
      programme: String(values.programme).trim(),
      academicSession: String(values.academicSession).trim(),
      semester: String(values.semester ?? "").trim(),
      level: String(values.level ?? "").trim(),
      title: String(values.title).trim(),
      details: String(values.details ?? "").trim(),
    },
  };
}
