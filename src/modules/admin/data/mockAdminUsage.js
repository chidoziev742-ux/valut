// Fictional aggregate-only figures for the Admin frontend prototype.
// No student-level activity, actual storage, quota, or cloud limit is represented.
export const mockAdminUsage = {
  storageConsumedGb: 384.7,
  documentCount: 28460,
  documentTypes: [
    { id: "pdf", label: "PDF documents", count: 17120, share: 60, color: "forest" },
    { id: "office", label: "Word documents", count: 6260, share: 22, color: "gold" },
    { id: "image", label: "Image documents", count: 4140, share: 15, color: "coral" },
    { id: "other", label: "Other file types", count: 940, share: 3, color: "slate" },
  ],
  monthlyStorageTrend: [
    { month: "May", period: "May 2026", storageGb: 338.1 },
    { month: "Jun", period: "June 2026", storageGb: 347.9 },
    { month: "Jul", period: "July 2026", storageGb: 359.8 },
    { month: "Aug", period: "August 2026", storageGb: 371.4 },
    { month: "Sep", period: "September 2026", storageGb: 376.5 },
    { month: "Oct", period: "October 2026", storageGb: 384.7 },
  ],
};
