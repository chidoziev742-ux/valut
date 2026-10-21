export const initialStudentProfile = {
  fullName: "Chido",
  university: "Sample University",
  faculty: "Faculty of Computing",
  department: "Computer Science",
  program: "BSc Computer Science",
  studyYear: "Year 3",
  academicSession: "2025/2026",
  email: "chido@example.com",
};

export const initialNotificationPreferences = {
  documentUpdates: true,
  accountUpdates: true,
};

export const studentProfileFields = [
  { name: "fullName", label: "Full name", required: true, autoComplete: "name" },
  { name: "email", label: "Email address", type: "email", autoComplete: "email" },
  { name: "university", label: "University", autoComplete: "organization" },
  { name: "faculty", label: "Faculty" },
  { name: "department", label: "Department" },
  { name: "program", label: "Course or programme", autoComplete: "organization-title" },
  { name: "studyYear", label: "Academic level", placeholder: "e.g. Year 3 or 300 level" },
  { name: "academicSession", label: "Academic session", placeholder: "e.g. 2025/2026" },
];

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const profileFields = ["fullName", "university", "faculty", "department", "program", "studyYear", "academicSession", "email"];

export function validateStudentProfile(values) {
  const errors = {};
  for (const field of profileFields) {
    const value = String(values[field] ?? "").trim();
    if (value.length > 120) errors[field] = "Use 120 characters or fewer.";
  }
  if (!String(values.fullName ?? "").trim()) errors.fullName = "Enter your full name.";
  if (values.email && !emailPattern.test(String(values.email).trim())) errors.email = "Enter a valid email address.";
  return errors;
}
