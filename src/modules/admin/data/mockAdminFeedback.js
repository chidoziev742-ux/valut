// Fictional Admin-only records for the frontend prototype. No actual students,
// submissions, survey responses, or live service data are represented here.
export const adminFeedbackCategories = [
  "Bug report",
  "Feature request",
  "Usability",
  "General feedback",
];

export const adminFeedbackStatuses = ["New", "Reviewed", "Resolved"];

export const mockAdminFeedback = [
  {
    id: "feedback-sample-01",
    subject: "Search could include folder names",
    category: "Feature request",
    submittedBy: "Sample student 01",
    submittedAt: "2026-10-17",
    rating: 5,
    status: "New",
    context: "Document library",
    message: "It would be useful if a search could also find a folder by its name, not only a document.",
  },
  {
    id: "feedback-sample-02",
    subject: "Upload dialog is hard to use on a small screen",
    category: "Usability",
    submittedBy: "Sample student 02",
    submittedAt: "2026-10-15",
    rating: 3,
    status: "Reviewed",
    context: "Document upload",
    message: "The form fields feel cramped on my phone. More breathing room would help.",
  },
  {
    id: "feedback-sample-03",
    subject: "Archived document count looks incorrect",
    category: "Bug report",
    submittedBy: "Sample student 03",
    submittedAt: "2026-10-12",
    rating: 2,
    status: "New",
    context: "Document library",
    message: "After restoring a sample document, the archived count did not change until I refreshed the page.",
  },
  {
    id: "feedback-sample-04",
    subject: "Academic records are easier to find now",
    category: "General feedback",
    submittedBy: "Sample student 04",
    submittedAt: "2026-10-10",
    rating: 5,
    status: "Resolved",
    context: "Academic records",
    message: "The record categories make it easier to keep result documents together.",
  },
  {
    id: "feedback-sample-05",
    subject: "Add a way to preview Word documents",
    category: "Feature request",
    submittedBy: "Sample student 05",
    submittedAt: "2026-10-08",
    rating: null,
    status: "Reviewed",
    context: "Document preview",
    message: "An in-app preview for Word documents would save a few steps when checking a file.",
  },
  {
    id: "feedback-sample-06",
    subject: "Folder action menu overlaps the title",
    category: "Bug report",
    submittedBy: "Sample student 06",
    submittedAt: "2026-10-04",
    rating: 2,
    status: "New",
    context: "Folders",
    message: "At a narrow browser width, the menu button can sit close to the folder title.",
  },
  {
    id: "feedback-sample-07",
    subject: "A calmer reminder for missing records",
    category: "General feedback",
    submittedBy: "Sample student 07",
    submittedAt: "2026-09-28",
    rating: 4,
    status: "Resolved",
    context: "Dashboard",
    message: "A gentle checklist for important records could be helpful during the school year.",
  },
  {
    id: "feedback-sample-08",
    subject: "Make the selected filter easier to spot",
    category: "Usability",
    submittedBy: "Sample student 08",
    submittedAt: "2026-09-24",
    rating: null,
    status: "New",
    context: "Document library",
    message: "A visible selected state would help me remember which document filters are active.",
  },
];

export const mockAdminSurveys = [
  { id: "survey-sample-01", title: "Document organization pulse check", status: "Active", responseCount: 26, updatedAt: "2026-10-16" },
  { id: "survey-sample-02", title: "New student setup feedback", status: "Closed", responseCount: 41, updatedAt: "2026-10-02" },
  { id: "survey-sample-03", title: "Academic records workflow", status: "Draft", responseCount: null, updatedAt: "2026-09-21" },
];

export const adminSurveyStatuses = ["Draft", "Active", "Closed"];

export function filterAdminFeedback(records, { query = "", category = "", status = "" } = {}) {
  const term = query.trim().toLocaleLowerCase();
  return records.filter((item) => {
    const searchable = [item.subject, item.message, item.category, item.context, item.submittedBy, item.id]
      .join(" ")
      .toLocaleLowerCase();
    return (!term || searchable.includes(term))
      && (!category || item.category === category)
      && (!status || item.status === status);
  });
}
