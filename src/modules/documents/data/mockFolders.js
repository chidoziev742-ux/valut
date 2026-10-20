export const mockFolders = [
  { id: "folder-admission", name: "Admission", createdAt: "2026-10-01" },
  { id: "folder-identification", name: "Identification", createdAt: "2026-10-01" },
  { id: "folder-results", name: "Results", createdAt: "2026-10-01" },
  { id: "folder-finance", name: "Finance", createdAt: "2026-10-01" },
];

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

export function folderReducer(state, action) {
  switch (action.type) {
    case "create":
      return [...state, action.folder];
    case "rename":
      return state.map((folder) => folder.id === action.id ? { ...folder, name: action.name } : folder);
    case "delete":
      return state.filter((folder) => folder.id !== action.id);
    default:
      return state;
  }
}
