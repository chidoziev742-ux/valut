// Fictional Admin-only examples. These records are not delivered messages or live student data.
export const communicationStatuses = ["Draft", "Sent"];

export const mockAdminCommunications = [
  {
    id: "communication-sample-01",
    subject: "Welcome to the new academic session",
    message: "Keep your important university documents together as you get ready for the new session.",
    recipients: "All students",
    channels: ["Email", "In-app notification"],
    status: "Sent",
    createdAt: "2026-10-16",
  },
  {
    id: "communication-sample-02",
    subject: "Document organization tips",
    message: "Create folders for course materials, personal documents, and academic records.",
    recipients: "Year 3",
    channels: ["In-app notification"],
    status: "Draft",
    createdAt: "2026-10-12",
  },
];
