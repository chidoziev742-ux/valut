export const academicRecordTypes = [
  "Programme information",
  "Semester result",
  "Course record",
];

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
