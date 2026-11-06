import { useEffect, useState } from "react";
import {
  ArrowLeft, Archive, CalendarDays, Download, File, FileImage, FileText,
  FileType2, Folder, Pencil, RotateCcw, Trash2,
} from "lucide-react";
import { canDownloadDocument, documentCategories } from "../data/mockDocuments.js";
import { downloadDocumentFile, getDocumentDownloadFilename } from "../downloadDocument.js";
import { DeleteDialog, RenameDialog } from "../components/DocumentOperationDialogs.jsx";
import "../styles/documents.css";

function iconFor(fileType) {
  const type = String(fileType ?? "").toUpperCase();
  if (["JPG", "JPEG", "PNG"].includes(type)) return FileImage;
  if (["DOC", "DOCX"].includes(type)) return FileType2;
  if (type === "PDF") return FileText;
  return File;
}

function formatDate(value) {
  if (!value) return "Not available";
  return new Date(`${value}T12:00:00`).toLocaleDateString("en", { day: "numeric", month: "long", year: "numeric" });
}

function getReturnLocation(folders) {
  const params = new URLSearchParams(window.location.search);
  if (params.get("from") !== "/folders") {
    return { href: "/documents", label: "Documents", crumb: [{ label: "Documents", href: "/documents" }] };
  }
  const folderParam = params.get("folder");
  if (folderParam === "unfiled") {
    return {
      href: "/folders?folder=unfiled",
      label: "Unfiled documents",
      crumb: [{ label: "Folders", href: "/folders" }, { label: "Unfiled documents", href: "/folders?folder=unfiled" }],
    };
  }
  const folder = folders.find((item) => item.id === folderParam);
  if (folder) {
    const href = `/folders?folder=${encodeURIComponent(folder.id)}`;
    return { href, label: folder.name, crumb: [{ label: "Folders", href: "/folders" }, { label: folder.name, href }] };
  }
  return { href: "/folders", label: "Folders", crumb: [{ label: "Folders", href: "/folders" }] };
}

function PreviewFallback({ document, failed = false, previewError = "" }) {
  const Icon = iconFor(document.fileType);
  let message = "A preview isn't available for this file type.";
  if (previewError) message = previewError;
  else if (!document.attachment && !document.storageBacked) message = "No file is attached, so a preview is unavailable.";
  else if (failed) message = document.fileType === "PDF"
    ? "This browser could not display the PDF preview. You can download the selected file."
    : "The selected file preview could not be loaded.";
  else if (["DOC", "DOCX"].includes(document.fileType)) message = "Download the document to view it.";
  else if (["JPG", "JPEG", "PNG"].includes(document.fileType)) message = "Image preview isn't available. You can download the selected file.";
  return (
    <div className="detail-preview-fallback" role="status">
      <span className="detail-preview-icon"><Icon size={32} aria-hidden="true" /></span>
      <strong>{document.fileType || "File"} preview unavailable</strong>
      <p>{message}</p>
    </div>
  );
}

function DocumentPreview({ document, previewUrl, previewError }) {
  const [failed, setFailed] = useState(false);
  const type = String(document.fileType ?? "").toUpperCase();
  const isImage = ["JPG", "JPEG", "PNG"].includes(type);
  const isPdf = type === "PDF";
  useEffect(() => setFailed(false), [document.id, previewUrl]);

  if ((!document.attachment && !document.storageBacked) || !previewUrl || failed || previewError) {
    return <PreviewFallback document={document} failed={failed} previewError={previewError} />;
  }
  if (isImage) {
    return <div className="detail-preview-image-wrap"><img className="detail-preview-image" src={previewUrl} alt={`Preview of ${document.name}`} onError={() => setFailed(true)} /></div>;
  }
  if (isPdf) {
    return (
      <div className="detail-pdf-wrap">
        <iframe className="detail-pdf-frame" src={previewUrl} title={`PDF preview of ${document.name}`} onError={() => setFailed(true)} />
        <p>PDF display uses your browser’s built-in viewer. If the page is blank, use Download selected file.</p>
      </div>
    );
  }
  return <PreviewFallback document={document} />;
}

export default function DocumentDetailPage({
  document,
  documentId,
  folders,
  onNavigate,
  onRename,
  onCategory,
  onMove,
  onArchive,
  onRestore,
  onDelete,
  onGetDownloadUrl,
  onNotice,
  foldersLoading = false,
  foldersError = "",
  onRetryFolders,
  loading = false,
  loadError = "",
  onRetry,
}) {
  const [operation, setOperation] = useState(null);
  const [operationError, setOperationError] = useState("");
  const [previewUrl, setPreviewUrl] = useState("");
  const [previewError, setPreviewError] = useState("");
  const returnLocation = getReturnLocation(folders);
  const attached = canDownloadDocument(document);
  const Icon = iconFor(document?.fileType);

  useEffect(() => {
    let active = true;
    setPreviewUrl("");
    setPreviewError("");
    if (!document?.id || !document.storageBacked) return () => { active = false; };
    onGetDownloadUrl(document.id)
      .then((url) => {
        if (active) setPreviewUrl(url);
      })
      .catch((error) => {
        if (active) setPreviewError(error.message || "A secure preview link is unavailable.");
      });
    return () => {
      active = false;
    };
  }, [document?.id, document?.storageBacked, onGetDownloadUrl]);

  if (!document) {
    if (loading) {
      return <div className="content-wrap detail-content"><section className="detail-missing panel" role="status"><h1>Loading document…</h1></section></div>;
    }
    return (
      <div className="content-wrap detail-content">
        <section className="detail-missing panel" role="status">
          <span className="detail-preview-icon"><File size={30} aria-hidden="true" /></span>
          <p className="library-eyebrow">DOCUMENT UNAVAILABLE</p>
          <h1>We couldn’t find that document</h1>
          <p>{loadError || "The document may have been removed, or this link may be invalid. No other document was opened."}</p>
          {loadError && <button className="button-secondary" type="button" onClick={onRetry}>Try again</button>}
          <a className="button-primary detail-back-button" href={returnLocation.href}><ArrowLeft size={16} /> Back to {returnLocation.label}</a>
          <small>Document reference: {documentId || "invalid"}</small>
        </section>
      </div>
    );
  }

  const download = async () => {
    if (!attached) return;
    try {
      const url = await onGetDownloadUrl(document.id);
      await downloadDocumentFile(url, getDocumentDownloadFilename(document));
      onNotice("Document downloaded.");
    } catch (error) {
      setOperationError(error.message || "The document could not be downloaded.");
    }
  };

  const saveName = async (id, name) => {
    try {
      await onRename(id, name);
      setOperation(null);
      setOperationError("");
      onNotice("Document name updated.");
    } catch (error) {
      setOperationError(error.message || "The document name could not be updated.");
    }
  };
  const confirmDelete = async (id) => {
    try {
      await onDelete(id);
      setOperation(null);
      onNavigate(returnLocation.href);
    } catch (error) {
      setOperationError(error.message || "The document could not be deleted.");
    }
  };
  const moveDocument = async (folderId) => {
    try {
      await onMove(document.id, folderId);
      setOperationError("");
      onNotice("Document moved.");
    } catch (error) {
      setOperationError(error.message || "The document could not be moved.");
    }
  };
  const toggleArchive = async () => {
    try {
      if (document.archived) { await onRestore(document.id); onNotice("Document restored to the active library."); }
      else { await onArchive(document.id); onNotice("Document archived."); }
      setOperationError("");
    } catch (error) {
      setOperationError(error.message || "The document could not be updated.");
    }
  };
  const categoryChange = async (category) => {
    try {
      await onCategory(document.id, category);
      onNotice("Document category updated.");
      setOperationError("");
    } catch (error) {
      setOperationError(error.message || "The document category could not be updated.");
    }
  };
  const currentFolder = folders.find((folder) => folder.id === document.folderId) ?? null;

  return (
    <div className="content-wrap detail-content">
      <nav className="detail-breadcrumbs" aria-label="Breadcrumb">
        {returnLocation.crumb.map((item) => <a key={`${item.label}-${item.href}`} href={item.href}>{item.label}</a>)}
        <span aria-hidden="true">/</span><span aria-current="page">{document.name}</span>
      </nav>
      <div className="detail-page-heading">
        <a className="detail-back-link" href={returnLocation.href}><ArrowLeft size={16} /> Back to {returnLocation.label}</a>
        {document.archived && <span className="detail-archived-badge"><Archive size={14} /> Archived</span>}
      </div>
      <header className="detail-title-row">
        <span className="detail-title-icon"><Icon size={25} aria-hidden="true" /></span>
        <div><p className="library-eyebrow">DOCUMENT DETAILS</p><h1>{document.name}</h1><p>{document.description}</p></div>
      </header>
      <div className="detail-page-grid">
        <section className="detail-preview-panel panel" aria-label="Document preview">
          <div className="detail-section-heading"><div><p className="library-eyebrow">PREVIEW</p><h2>{document.fileType} file</h2></div></div>
          <div className="detail-preview-area"><DocumentPreview document={document} previewUrl={previewUrl} previewError={previewError} /></div>
        </section>
        <aside className="detail-side-column">
          <section className="detail-metadata-panel panel" aria-labelledby="metadata-heading">
            <div className="detail-section-heading"><div><p className="library-eyebrow">FILE INFORMATION</p><h2 id="metadata-heading">Document details</h2></div></div>
            <dl className="detail-metadata-list">
              <div><dt>Category</dt><dd><label className="sr-only" htmlFor="detail-category">Change document category</label><select id="detail-category" value={document.category} onChange={(event) => categoryChange(event.target.value)}>{documentCategories.map((category) => <option key={category} value={category}>{category}</option>)}</select></dd></div>
              <div><dt>Academic session</dt><dd>{document.academicSession || "Not specified"}</dd></div>
              <div><dt>Date added</dt><dd><CalendarDays size={14} aria-hidden="true" /> {formatDate(document.uploadedAt)}</dd></div>
              <div><dt>File type</dt><dd>{document.fileType}</dd></div>
              <div><dt>File size</dt><dd>{document.fileSize || "Not available"}</dd></div>
              <div><dt>Folder</dt><dd><Folder size={14} aria-hidden="true" /> {currentFolder?.name ?? "Unfiled"}</dd></div>
            </dl>
            {!attached && <p className="detail-sample-note">No file is attached. Preview and download are unavailable.</p>}
          </section>
          <section className="detail-actions-panel panel" aria-labelledby="actions-heading">
            <div className="detail-section-heading"><div><p className="library-eyebrow">ORGANIZE</p><h2 id="actions-heading">Actions</h2></div></div>
            <button className="detail-action-button" type="button" onClick={() => setOperation("rename")}><Pencil size={16} /> Rename</button>
            <label className="detail-action-label" htmlFor="detail-folder">Move to folder</label>
            <select className="detail-action-select" id="detail-folder" value={document.folderId ?? ""} onChange={(event) => moveDocument(event.target.value || null)} disabled={foldersLoading || Boolean(foldersError)}>
              <option value="">Unfiled</option>
              {folders.map((folder) => <option key={folder.id} value={folder.id}>{folder.name}</option>)}
            </select>
            {foldersLoading && <small role="status">Loading folders…</small>}
            {foldersError && <div className="operation-error" role="alert"><p>{foldersError}</p><button className="detail-action-button" type="button" onClick={onRetryFolders}>Retry folder loading</button></div>}
            <button className="detail-action-button" type="button" disabled={!attached} onClick={download}><Download size={16} /> {attached ? "Download selected file" : "Download unavailable"}</button>
            <button className="detail-action-button" type="button" onClick={toggleArchive}>{document.archived ? <RotateCcw size={16} /> : <Archive size={16} />}{document.archived ? "Restore document" : "Archive document"}</button>
            <button className="detail-action-button detail-delete-action" type="button" onClick={() => setOperation("delete")}><Trash2 size={16} /> Delete record…</button>
          </section>
          {operationError && <p className="operation-error" role="alert">{operationError}</p>}
        </aside>
      </div>
      {operation === "rename" && <RenameDialog document={document} onClose={() => setOperation(null)} onSave={saveName} />}
      {operation === "delete" && <DeleteDialog document={document} onClose={() => setOperation(null)} onConfirm={confirmDelete} />}
    </div>
  );
}
