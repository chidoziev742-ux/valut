import { useMemo, useState } from "react";
import { ArrowLeft, File, Folder, FolderPlus, Pencil, Trash2 } from "lucide-react";
import { useDialogFocus } from "../../../hooks/useDialogFocus.js";
import { validateFolderName } from "../data/mockFolders.js";
import "../../../organization.css";

function FolderDialog({ mode, folders, folder, onClose, onSave }) {
  const [name, setName] = useState(folder?.name ?? "");
  const [error, setError] = useState("");
  const ref = useDialogFocus(onClose);
  const submit = (event) => {
    event.preventDefault();
    const checked = validateFolderName(name, folders, folder?.id);
    if (checked.error) { setError(checked.error); return; }
    onSave(checked.name);
  };
  return (
    <div className="organization-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section ref={ref} className="organization-dialog" role="dialog" aria-modal="true" aria-labelledby="folder-dialog-title">
        <button className="organization-close" type="button" onClick={onClose} aria-label="Close folder dialog">×</button>
        <span className="organization-dialog-icon"><Folder size={22} /></span>
        <p className="organization-eyebrow">FOLDERS · PROTOTYPE</p>
        <h2 id="folder-dialog-title">{mode === "rename" ? "Rename folder" : "Create a folder"}</h2>
        <p>Folder changes stay in this browser session only.</p>
        <form onSubmit={submit} noValidate>
          <label className="organization-field" htmlFor="folder-name">Folder name
            <input data-dialog-initial-focus id="folder-name" value={name} maxLength={60} onChange={(event) => { setName(event.target.value); setError(""); }} aria-invalid={Boolean(error)} aria-describedby={error ? "folder-name-error" : "folder-name-help"} />
          </label>
          {error ? <p id="folder-name-error" className="organization-error" role="alert">{error}</p> : <small id="folder-name-help">Use a clear name, up to 60 characters. Names must be unique.</small>}
          <div className="organization-dialog-actions"><button className="organization-button secondary" type="button" onClick={onClose}>Cancel</button><button className="organization-button primary" type="submit">{mode === "rename" ? "Save name" : "Create folder"}</button></div>
        </form>
      </section>
    </div>
  );
}

function DeleteFolderDialog({ folder, onClose, onConfirm }) {
  const ref = useDialogFocus(onClose);
  return (
    <div className="organization-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section ref={ref} className="organization-dialog" role="alertdialog" aria-modal="true" aria-labelledby="folder-delete-title" aria-describedby="folder-delete-copy">
        <button className="organization-close" type="button" onClick={onClose} aria-label="Cancel folder deletion">×</button>
        <span className="organization-dialog-icon danger-icon"><Trash2 size={21} /></span>
        <p className="organization-eyebrow">CONFIRM REMOVAL</p>
        <h2 id="folder-delete-title">Delete “{folder.name}”?</h2>
        <p id="folder-delete-copy">This empty folder will be removed from the current prototype session. Documents are never deleted by removing a folder.</p>
        <div className="organization-dialog-actions"><button data-dialog-initial-focus className="organization-button secondary" type="button" onClick={onClose}>Keep folder</button><button className="organization-button destructive" type="button" onClick={onConfirm}>Delete folder</button></div>
      </section>
    </div>
  );
}

function DocumentRow({ document, folders, onMove, originFolderId }) {
  const folderLocation = new URLSearchParams({ from: "/folders", folder: originFolderId === "" ? "unfiled" : originFolderId ?? document.folderId ?? "unfiled" }).toString();
  const documentHref = `/documents/${encodeURIComponent(document.id)}?${folderLocation}`;
  return (
    <li className="organization-document-row">
      <span className="organization-file-icon"><File size={19} aria-hidden="true" /></span>
      <span className="organization-document-copy"><a className="organization-document-link" href={documentHref}>{document.name}</a><small>{document.fileType} · {document.fileSize}{document.archived ? " · Archived" : ""}</small></span>
      <label className="organization-move-select"><span className="sr-only">Move {document.name} to folder</span><select value={document.folderId ?? ""} onChange={(event) => onMove(document.id, event.target.value || null)}><option value="">Unfiled</option>{folders.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
    </li>
  );
}

export default function FoldersPage({ folders, documents, onCreate, onRename, onDelete, onMove, onNotice, onNavigate }) {
  const [selectedId, setSelectedId] = useState(() => {
    const requested = new URLSearchParams(window.location.search).get("folder");
    if (requested === "unfiled") return "";
    return folders.some((folder) => folder.id === requested) ? requested : null;
  });
  const [dialog, setDialog] = useState(null);
  const selectedFolder = folders.find((folder) => folder.id === selectedId) ?? null;
  const selectedDocuments = useMemo(() => documents.filter((document) => (selectedId ? document.folderId === selectedId : !document.folderId)), [documents, selectedId]);
  const foldersWithCounts = folders.map((folder) => ({ ...folder, count: documents.filter((document) => document.folderId === folder.id).length }));
  const saveFolder = (name) => {
    if (dialog?.mode === "rename") {
      onRename(dialog.folder.id, name);
      onNotice("Folder name updated for this session.");
    } else {
      const id = globalThis.crypto?.randomUUID?.() ?? `folder-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      onCreate({ id, name, createdAt: new Date().toISOString().slice(0, 10) });
      onNotice("Folder created for this session.");
    }
    setDialog(null);
  };

  return (
    <div className="content-wrap organization-content">
      <header className="organization-heading">
        <div><p className="organization-eyebrow">YOUR ORGANIZATION</p><h1>Folders</h1><p>Group documents in a way that works for your university life.</p></div>
        <button className="organization-button primary" type="button" onClick={() => setDialog({ mode: "create" })}><FolderPlus size={17} /> Create folder</button>
      </header>
      <p className="organization-sample-note">Illustrative sample folders · your changes last for this browser session only.</p>

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
          </section>
          <section className="organization-unfiled panel">
            <div><h2>Unfiled documents</h2><p>Documents that are not in a folder remain available in your library.</p></div>
            <button className="organization-button secondary" type="button" onClick={() => setSelectedId("")}>{documents.filter((document) => !document.folderId).length} documents <ArrowLeft size={15} /></button>
          </section>
        </>
      ) : (
        <section className="organization-folder-view panel" aria-labelledby="folder-view-title">
          <div className="organization-folder-view-heading"><div><h2 id="folder-view-title">{selectedFolder?.name ?? "Unfiled documents"}</h2><p>{selectedDocuments.length} {selectedDocuments.length === 1 ? "document" : "documents"} · move documents with the menu on each row</p></div>{selectedFolder && <button className="organization-button secondary" type="button" onClick={() => setDialog({ mode: "rename", folder: selectedFolder })}><Pencil size={15} /> Rename</button>}</div>
          {selectedDocuments.length ? <ul className="organization-document-list">{selectedDocuments.map((document) => <DocumentRow key={document.id} document={document} folders={folders} originFolderId={selectedId} onMove={(id, folderId) => { onMove(id, folderId); onNotice("Document moved for this session."); }} />)}</ul> : <div className="organization-empty"><FolderOpenFallback /><h3>This folder is empty</h3><p>Move documents here from the list below or from another folder.</p></div>}
          <div className="organization-folder-footer"><button type="button" className="organization-text-link" onClick={() => onNavigate("/documents")}>Open document library</button><button type="button" className="organization-text-link" onClick={() => onNavigate("/academic-records")}>View academic records</button></div>
        </section>
      )}

      {selectedId !== null && <section className="organization-all-documents panel"><div className="organization-folder-view-heading"><div><h2>All documents</h2><p>Choose a destination to organize any document.</p></div></div><ul className="organization-document-list">{documents.map((document) => <DocumentRow key={document.id} document={document} folders={folders} originFolderId={selectedId} onMove={(id, folderId) => { onMove(id, folderId); onNotice("Document moved for this session."); }} />)}</ul></section>}
      <section className="organization-category-summary panel"><div><p className="organization-eyebrow">CATEGORIES</p><h2>Keep categories consistent</h2><p>Categories describe the kind of document; folders are your own groupings.</p></div><button className="organization-text-link" type="button" onClick={() => onNavigate("/documents")}>Edit a document category</button></section>
      {dialog?.mode === "create" && <FolderDialog mode="create" folders={folders} onClose={() => setDialog(null)} onSave={saveFolder} />}
      {dialog?.mode === "rename" && <FolderDialog key={dialog.folder.id} mode="rename" folder={dialog.folder} folders={folders} onClose={() => setDialog(null)} onSave={saveFolder} />}
      {dialog?.mode === "delete" && <DeleteFolderDialog folder={dialog.folder} onClose={() => setDialog(null)} onConfirm={() => { onDelete(dialog.folder.id); setDialog(null); onNotice("Empty folder deleted for this session."); }} />}
    </div>
  );
}

function FolderOpenFallback() {
  return <span className="organization-empty-icon"><Folder size={22} aria-hidden="true" /></span>;
}
