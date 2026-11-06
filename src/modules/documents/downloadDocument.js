function safeDownloadFilename(filename, fallback) {
  const cleaned = String(filename ?? "")
    .split(/[\\/]/)
    .pop()
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .trim();
  return cleaned || fallback;
}

export function getDocumentDownloadFilename(document) {
  const extension = document.fileExtension
    || `.${String(document.fileType ?? "").toLowerCase()}`;
  return `${document.name}${extension}`;
}

export async function downloadDocumentFile(url, filename, {
  fetchImpl = fetch,
  documentRef = globalThis.document,
  URLApi = globalThis.URL,
  schedule = globalThis.setTimeout,
} = {}) {
  let response;
  try {
    response = await fetchImpl(url);
  } catch {
    throw new Error("The document could not be downloaded. Please try again.");
  }
  if (!response.ok) {
    throw new Error("The document could not be downloaded. Please try again.");
  }

  const blob = await response.blob();
  const objectUrl = URLApi.createObjectURL(blob);
  const link = documentRef.createElement("a");
  link.href = objectUrl;
  link.download = safeDownloadFilename(filename, "document");
  link.hidden = true;
  documentRef.body.append(link);
  try {
    link.click();
  } finally {
    link.remove();
    schedule(() => URLApi.revokeObjectURL(objectUrl), 1000);
  }
}
