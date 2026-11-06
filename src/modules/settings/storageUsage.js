export function formatStorageBytes(bytes) {
  const value = Number(bytes);
  if (!Number.isFinite(value) || value <= 0) return "0 KB";
  if (value < 1024 * 1024) return `${Math.max(1, Math.round(value / 1024))} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

export function getStorageCategoryWidths(categories, totalBytes) {
  if (!Array.isArray(categories) || totalBytes <= 0) return [];
  return categories.map((item) => ({
    ...item,
    width: Math.min(100, Math.max(0, (item.storageBytes / totalBytes) * 100)),
  }));
}
