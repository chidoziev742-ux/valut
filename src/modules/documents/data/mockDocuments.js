export const mockDocuments = [
  { id: "doc-admission", name: "Admission Letter", category: "Personal Documents", fileType: "PDF", fileSize: "245 KB", uploadedAt: "2026-10-17", academicSession: "2025/2026", description: "Sample admission letter for the fictional student profile." },
  { id: "doc-schedule", name: "Course Schedule", category: "Course Materials", fileType: "PDF", fileSize: "120 KB", uploadedAt: "2026-10-14", academicSession: "2025/2026", description: "Illustrative weekly course schedule." },
  { id: "doc-id-card", name: "Student ID Card", category: "Personal Documents", fileType: "JPG", fileSize: "340 KB", uploadedAt: "2026-10-12", academicSession: "Not session-specific", description: "Fictional student identity card metadata; no image is stored." },
  { id: "doc-result-2425", name: "Semester Result · 2024/2025", category: "Academic Records", fileType: "PDF", fileSize: "210 KB", uploadedAt: "2026-10-10", academicSession: "2024/2025", description: "Sample semester result record." },
  { id: "doc-tuition", name: "Tuition Payment Receipt", category: "Financial Documents", fileType: "PDF", fileSize: "180 KB", uploadedAt: "2026-10-05", academicSession: "2025/2026", description: "Illustrative tuition receipt metadata." },
  { id: "doc-registration", name: "Course Registration Form", category: "Academic Records", fileType: "PDF", fileSize: "198 KB", uploadedAt: "2026-10-02", academicSession: "2025/2026", description: "Sample course registration form." },
  { id: "doc-transcript", name: "Academic Transcript", category: "Academic Records", fileType: "PDF", fileSize: "1.2 MB", uploadedAt: "2026-09-27", academicSession: "2024/2025", description: "Fictional transcript entry for the document library prototype." },
  { id: "doc-timetable", name: "Examination Timetable", category: "Course Materials", fileType: "PDF", fileSize: "160 KB", uploadedAt: "2026-09-23", academicSession: "2025/2026", description: "Illustrative examination timetable." },
  { id: "doc-scholarship", name: "Scholarship Award Letter", category: "Academic Records", fileType: "PDF", fileSize: "260 KB", uploadedAt: "2026-09-18", academicSession: "2025/2026", description: "Sample award letter for a fictional student." },
  { id: "doc-vaccination", name: "Health Record", category: "Personal Documents", fileType: "JPG", fileSize: "420 KB", uploadedAt: "2026-09-12", academicSession: "Not session-specific", description: "Fictional personal document metadata; no image is stored." },
  { id: "doc-certificate", name: "Certificate of Participation", category: "Certificates", fileType: "PDF", fileSize: "540 KB", uploadedAt: "2026-08-20", academicSession: "2024/2025", description: "Sample certificate metadata." },
  { id: "doc-hostel", name: "Hostel Allocation Letter", category: "Other", fileType: "PDF", fileSize: "200 KB", uploadedAt: "2026-08-12", academicSession: "2025/2026", description: "Illustrative accommodation letter." },
  { id: "doc-fees", name: "Fee Statement", category: "Financial Documents", fileType: "PDF", fileSize: "225 KB", uploadedAt: "2026-08-05", academicSession: "2024/2025", description: "Fictional fee statement metadata." },
];

export const documentCategories = [
  "Personal Documents", "Academic Records", "Financial Documents",
  "Course Materials", "Certificates", "Other",
];

export function filterAndSortDocuments({
  documents = mockDocuments,
  query = "",
  category = "all",
  fileType = "all",
  academicSession = "all",
  sort = "newest",
  view = "active",
} = {}) {
  const searchTerm = query.trim().toLocaleLowerCase();
  const result = documents.filter((document) => {
    const searchable = [document.name, document.category, document.fileType, document.academicSession, document.description]
      .join(" ").toLocaleLowerCase();
    const archived = Boolean(document.archived);
    return (view === "archived" ? archived : !archived)
      && (!searchTerm || searchable.includes(searchTerm))
      && (category === "all" || document.category === category)
      && (fileType === "all" || document.fileType === fileType)
      && (academicSession === "all" || document.academicSession === academicSession);
  });

  result.sort((a, b) => {
    if (sort === "oldest") return a.uploadedAt.localeCompare(b.uploadedAt);
    if (sort === "alphabetical") return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
    return b.uploadedAt.localeCompare(a.uploadedAt);
  });
  return result;
}

const configuredUploadLimit = Number(import.meta.env?.VITE_MAX_UPLOAD_BYTES);
export const MAX_UPLOAD_BYTES = Number.isSafeInteger(configuredUploadLimit)
  && configuredUploadLimit >= 1
  && configuredUploadLimit <= 50 * 1024 * 1024
  ? configuredUploadLimit
  : 10 * 1024 * 1024;
const acceptedFileTypes = {
  pdf: ["application/pdf"],
  jpg: ["image/jpeg"],
  jpeg: ["image/jpeg"],
  png: ["image/png"],
};

export function validateSelectedFile(file) {
  if (!file) return "Choose a file to continue.";
  const extension = String(file.name ?? "").split(".").pop()?.toLowerCase();
  const allowedMimeTypes = acceptedFileTypes[extension];
  if (!allowedMimeTypes) return "Choose a PDF, JPG, JPEG, or PNG file.";
  if (file.type && !allowedMimeTypes.includes(file.type.toLowerCase())) return "The selected file type does not match its filename extension.";
  if (!Number.isFinite(file.size) || file.size <= 0) return "The selected file appears to be empty.";
  if (file.size > MAX_UPLOAD_BYTES) return `Choose a file smaller than ${Math.round(MAX_UPLOAD_BYTES / (1024 * 1024))} MB.`;
  return "";
}

export function fileExtension(fileName) {
  const match = String(fileName ?? "").match(/\.([^.\\/]+)$/);
  return match ? `.${match[1].toLowerCase()}` : "";
}

export function defaultDocumentName(fileName) {
  const safeName = String(fileName ?? "").split(/[\\/]/).pop().replace(/[\u0000-\u001f]/g, "").trim();
  const extension = fileExtension(safeName);
  return extension ? safeName.slice(0, -extension.length).trim() : safeName;
}

export function validateDocumentName(value, extension = "") {
  let name = String(value ?? "").replace(/[\u0000-\u001f]/g, "").trim().replace(/\s+/g, " ");
  if (extension) {
    const suffix = extension.toLowerCase();
    while (name.toLowerCase().endsWith(suffix)) name = name.slice(0, -suffix.length).trimEnd();
  }
  if (!name) return { error: "Enter a document name." };
  if (name.length > 100) return { error: "Use 100 characters or fewer for the document name." };
  return { name };
}

export function canDownloadDocument(document) {
  return Boolean(document?.attachment || document?.storageBacked);
}

export function documentReducer(state, action) {
  switch (action.type) {
    case "add":
      return [action.document, ...state];
    case "rename":
      return state.map((document) => document.id === action.id ? { ...document, name: action.name } : document);
    case "archive":
      return state.map((document) => document.id === action.id ? { ...document, archived: true } : document);
    case "restore":
      return state.map((document) => document.id === action.id ? { ...document, archived: false } : document);
    case "move":
      return state.map((document) => document.id === action.id ? { ...document, folderId: action.folderId ?? null } : document);
    case "category":
      return state.map((document) => document.id === action.id ? { ...document, category: action.category } : document);
    case "delete":
      return state.filter((document) => document.id !== action.id);
    default:
      return state;
  }
}
