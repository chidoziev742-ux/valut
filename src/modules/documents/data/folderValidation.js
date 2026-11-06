export function normalizeFolderName(value) {
  return String(value ?? "").replace(/[\u0000-\u001f]/g, "").trim().replace(/\s+/g, " ");
}

export function validateFolderName(value, folders, excludeId = null) {
  const name = normalizeFolderName(value);
  if (!name) return { error: "Enter a folder name." };
  if (name.length > 60) return { error: "Use 60 characters or fewer." };
  if (folders.some((folder) => folder.id !== excludeId && folder.name.toLocaleLowerCase() === name.toLocaleLowerCase())) {
    return { error: "A folder with this name already exists." };
  }
  return { name };
}
