export function normalizeDocumentPreviewUrl(value) {
  const url = new URL(value);
  if (url.pathname.startsWith("/object/sign/")) {
    url.pathname = `/storage/v1${url.pathname}`;
  }
  return url.toString();
}
