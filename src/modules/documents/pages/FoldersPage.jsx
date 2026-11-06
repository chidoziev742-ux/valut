import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, File, Folder, FolderPlus, Pencil, Trash2 } from "lucide-react";
import { useDialogFocus } from "../../../hooks/useDialogFocus.js";
import { validateFolderName } from "../data/folderValidation.js";
import "../../../organization.css";

function FolderDialog({ mode, folders, folder, onClose, onSave }) {
  const [name, setName] = useState(folder?.name ?? "");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const ref = useDialogFocus(onClose);
  const submit = async (event) => {
    event.preventDefault();
    const checked = validateFolderName(name, folders, folder?.id);
    if (checked.error) { setError(checked.error); return; }
    setSaving(true);
    try {
      await onSave(checked.name);
    } catch (saveError) {
      setError(saveError.message || "The folder could not be saved. Please try again.");
    } finally {
      setSaving(false);
    }
  };
  return (
    <div className="organization-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section ref={ref} className="organization-dialog" role="dialog" aria-modal="true" aria-labelledby="folder-dialog-title">
        <button className="organization-close" type="button" onClick={onClose} aria-label="Close folder dialog">×</button>
        <span className="organization-dialog-icon"><Folder size={22} /></span>
        <p className="organization-eyebrow">FOLDERS</p>
        <h2 id="folder-dialog-title">{mode === "rename" ? "Rename folder" : "Create a folder"}</h2>
        <p>Organize your documents with a clear folder name.</p>
        <form onSubmit={submit} noValidate>
          <label className="organization-field" htmlFor="folder-name">Folder name
            <input data-dialog-initial-focus id="folder-name" value={name} maxLength={60} onChange={(event) => { setName(event.target.value); setError(""); }} aria-invalid={Boolean(error)} aria-describedby={error ? "folder-name-error" : "folder-name-help"} />
          </label>
          {error ? <p id="folder-name-error" className="organization-error" role="alert">{error}</p> : <small id="folder-name-help">Use a clear name, up to 60 characters. Names must be unique.</small>}
          <div className="organization-dialog-actions"><button className="organization-button secondary" type="button" onClick={onClose} disabled={saving}>Cancel</button><button className="organization-button primary" type="submit" disabled={saving}>{saving ? "Saving…" : mode === "rename" ? "Save name" : "Create folder"}</button></div>
        </form>
      </section>
    </div>
  );
}

function DeleteFolderDialog({ folder, onClose, onConfirm }) {
  const [error, setError] = useState("");
  const [deleting, setDeleting] = useState(false);
  const ref = useDialogFocus(onClose);
  const confirm = async () => {
    setDeleting(true);
    setError("");
    try {
      await onConfirm();
    } catch (deleteError) {
      setError(deleteError.message || "The folder could not be deleted. Please try again.");
      setDeleting(false);
    }
  };
  return (
    <div className="organization-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section ref={ref} className="organization-dialog" role="alertdialog" aria-modal="true" aria-labelledby="folder-delete-title" aria-describedby="folder-delete-copy">
        <button className="organization-close" type="button" onClick={onClose} aria-label="Cancel folder deletion">×</button>
        <span className="organization-dialog-icon danger-icon"><Trash2 size={21} /></span>
        <p className="organization-eyebrow">CONFIRM REMOVAL</p>
        <h2 id="folder-delete-title">Delete “{folder.name}”?</h2>
        <p id="folder-delete-copy">This empty folder will be removed. Documents are not deleted when a folder is removed.</p>
        {error && <p className="organization-error" role="alert">{error}</p>}
        <div className="organization-dialog-actions"><button data-dialog-initial-focus className="organization-button secondary" type="button" onClick={onClose} disabled={deleting}>Keep folder</button><button className="organization-button destructive" type="button" onClick={confirm} disabled={deleting}>{deleting ? "Deleting…" : "Delete folder"}</button></div>
      </section>
    </div>
  );
}

function DocumentRow({ document, folders, onMove, onNotice, originFolderId }) {
  const [moving, setMoving] = useState(false);
  const [error, setError] = useState("");
  const folderLocation = new URLSearchParams({ from: "/folders", folder: originFolderId === "" ? "unfiled" : originFolderId ?? document.folderId ?? "unfiled" }).toString();
  const documentHref = `/documents/${encodeURIComponent(document.id)}?${folderLocation}`;
  const move = async (event) => {
    const folderId = event.target.value || null;
    setMoving(true);
    setError("");
    try {
      await onMove(document.id, folderId);
      onNotice("Document moved.");
    } catch (moveError) {
      setError(moveError.message || "The document could not be moved. Please try again.");
    } finally {
      setMoving(false);
    }
  };
  return (
    <li className="organization-document-row">
      <span className="organization-file-icon"><File size={19} aria-hidden="true" /></span>
      <span className="organization-document-copy"><a className="organization-document-link" href={documentHref}>{document.name}</a><small>{document.fileType} · {document.fileSize}{document.archived ? " · Archived" : ""}</small></span>
      <label className="organization-move-select"><span className="sr-only">Move {document.name} to folder</span><select value={document.folderId ?? ""} onChange={move} disabled={moving} aria-describedby={error ? `move-error-${document.id}` : undefined}><option value="">Unfiled</option>{folders.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
      {error && <small className="organization-inline-error" id={`move-error-${document.id}`} role="alert">{error}</small>}
    </li>
  );
}

export default function FoldersPage({
  folders,
  documents,
  loading = false,
  error = "",
  onRetry,
  onCreate,
  onRename,
  onDelete,
  onMove,
  onNotice,
  onNavigate,
}) {
  const [selectedId, setSelectedId] = useState(() => {
    const requested = new URLSearchParams(window.location.search).get("folder");
    if (requested === "unfiled") return "";
    return requested;
  });
  const [dialog, setDialog] = useState(null);
  useEffect(() => {
    if (!loading && selectedId && !folders.some((folder) => folder.id === selectedId)) {
      setSelectedId(null);
    }
  }, [folders, loading, selectedId]);
  const selectedFolder = folders.find((folder) => folder.id === selectedId) ?? null;
  const selectedDocuments = useMemo(() => documents.filter((document) => (selectedId ? document.folderId === selectedId : !document.folderId)), [documents, selectedId]);
  const foldersWithCounts = folders.map((folder) => ({ ...folder, count: documents.filter((document) => document.folderId === folder.id).length }));
  const saveFolder = async (name) => {
    if (dialog?.mode === "rename") {
      await onRename(dialog.folder.id, name);
      onNotice("Folder name updated.");
    } else {
      await onCreate(name);
      onNotice("Folder created.");
    }
    setDialog(null);
  };
  const deleteSelectedFolder = async (folderId) => {
    await onDelete(folderId);
    setDialog(null);
    onNotice("Folder deleted.");
  };
  const moveDocument = async (id, folderId) => onMove(id, folderId);

  return (
    <div className="content-wrap organization-content">
      <header className="organization-heading">
        <div><p className="organization-eyebrow">YOUR ORGANIZATION</p><h1>Folders</h1><p>Group documents in a way that works for your university life.</p></div>
        <button className="organization-button primary" type="button" onClick={() => setDialog({ mode: "create" })}><FolderPlus size={17} /> Create folder</button>
      </header>

      {loading && <p className="organization-data-state" role="status">Loading your folders and documents…</p>}
      {!loading && error && <div className="organization-data-state organization-data-error" role="alert"><p>{error}</p><button className="organization-button secondary" type="button" onClick={onRetry}>Try again</button></div>}

      {!loading && !error && <>
      {selectedId !== null && (
        <div className="organization-subheading"><button type="button" className="organization-back" onClick={() => setSelectedId(null)}><ArrowLeft size={16} /> All folders</button><span>/</span><strong>{selectedFolder?.name ?? "Unfiled"}</strong></div>
      )}

      {selectedId === null ? (
        <>
          <section className="organization-folder-grid" aria-label="Your folders">
            {foldersWithCounts.map((folder) => (
              <article className="organization-folder-card" key={folder.id}>
                <button className="organization-folder-open" type="button" onClick={() => setSelectedId(folder.id)}>
                  <span className="organization-folder-art"><Folder size={25} aria-hidden="true" /></span><strong>{folder.name}</strong><span>{folder.count} {folder.count === 1 ? "document" : "documents"}</span>
                </button>
                <div className="organization-folder-actions"><button type="button" onClick={() => setDialog({ mode: "rename", folder })}><Pencil size={15} /> Rename</button><button type="button" disabled={folder.count > 0} title={folder.count > 0 ? "Move all documents out before deleting this folder." : "Delete empty folder"} onClick={() => setDialog({ mode: "delete", folder })}><Trash2 size={15} /> Delete</button></div>
                {folder.count > 0 && <small className="organization-folder-hint">Move its documents elsewhere before deleting.</small>}
              </article>
            ))}
            {!foldersWithCounts.length && <div className="organization-empty panel"><FolderOpenFallback /><h3>No folders yet</h3><p>Create a folder to organize your saved documents.</p><button className="organization-button primary" type="button" onClick={() => setDialog({ mode: "create" })}><FolderPlus size={16} /> Create folder</button></div>}
          </section>
          <section className="organization-unfiled panel">
            <div><h2>Unfiled documents</h2><p>Documents that are not in a folder remain available in your library.</p></div>
            <button className="organization-button secondary" type="button" onClick={() => setSelectedId("")}>{documents.filter((document) => !document.folderId).length} {documents.filter((document) => !document.folderId).length === 1 ? "document" : "documents"} <ArrowLeft size={15} /></button>
          </section>
        </>
      ) : (
        <section className="organization-folder-view panel" aria-labelledby="folder-view-title">
          <div className="organization-folder-view-heading"><div><h2 id="folder-view-title">{selectedFolder?.name ?? "Unfiled documents"}</h2><p>{selectedDocuments.length} {selectedDocuments.length === 1 ? "document" : "documents"} · move documents with the menu on each row</p></div>{selectedFolder && <button className="organization-button secondary" type="button" onClick={() => setDialog({ mode: "rename", folder: selectedFolder })}><Pencil size={15} /> Rename</button>}</div>
          {selectedDocuments.length ? <ul className="organization-document-list">{selectedDocuments.map((document) => <DocumentRow key={document.id} document={document} folders={folders} originFolderId={selectedId} onMove={moveDocument} onNotice={onNotice} />)}</ul> : <div className="organization-empty"><FolderOpenFallback /><h3>{documents.length ? "This folder is empty" : "No documents yet"}</h3><p>{documents.length ? "Move documents here from the list below or from another folder." : "Upload a document before organizing it into a folder."}</p></div>}
          <div className="organization-folder-footer"><button type="button" className="organization-text-link" onClick={() => onNavigate("/documents")}>Open document library</button><button type="button" className="organization-text-link" onClick={() => onNavigate("/academic-records")}>View academic records</button></div>
        </section>
      )}

      {selectedId !== null && <section className="organization-all-documents panel"><div className="organization-folder-view-heading"><div><h2>All documents</h2><p>Choose a destination to organize any document.</p></div></div>{documents.length ? <ul className="organization-document-list">{documents.map((document) => <DocumentRow key={document.id} document={document} folders={folders} originFolderId={selectedId} onMove={moveDocument} onNotice={onNotice} />)}</ul> : <div className="organization-empty"><FolderOpenFallback /><h3>No documents yet</h3><p>Uploaded documents will appear here for organizing.</p></div>}</section>}
      <section className="organization-category-summary panel"><div><p className="organization-eyebrow">CATEGORIES</p><h2>Keep categories consistent</h2><p>Categories describe the kind of document; folders are your own groupings.</p></div><button className="organization-text-link" type="button" onClick={() => onNavigate("/documents")}>Edit a document category</button></section>
      </>}
      {dialog?.mode === "create" && <FolderDialog mode="create" folders={folders} onClose={() => setDialog(null)} onSave={saveFolder} />}
      {dialog?.mode === "rename" && <FolderDialog key={dialog.folder.id} mode="rename" folder={dialog.folder} folders={folders} onClose={() => setDialog(null)} onSave={saveFolder} />}
      {dialog?.mode === "delete" && <DeleteFolderDialog folder={dialog.folder} onClose={() => setDialog(null)} onConfirm={() => deleteSelectedFolder(dialog.folder.id)} />}
    </div>
  );
}

function FolderOpenFallback() {
  return <span className="organization-empty-icon"><Folder size={22} aria-hidden="true" /></span>;
}
