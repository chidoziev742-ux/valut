import { useState } from "react";
import { X } from "lucide-react";
import { validateDocumentName } from "../data/mockDocuments.js";
import { useDialogFocus } from "../../../hooks/useDialogFocus.js";
import "../styles/documents.css";

export function RenameDialog({ document, onClose, onSave }) {
  const [name, setName] = useState(document.name);
  const [error, setError] = useState("");
  const dialogRef = useDialogFocus(onClose);
  const submit = (event) => {
    event.preventDefault();
    const checked = validateDocumentName(name, document.fileExtension ?? "");
    if (checked.error) { setError(checked.error); return; }
    onSave(document.id, checked.name);
  };
  return (
    <div className="document-dialog-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section ref={dialogRef} className="document-dialog operation-dialog" role="dialog" aria-modal="true" aria-labelledby="rename-title">
        <button className="document-dialog-close" type="button" onClick={onClose} aria-label="Close rename dialog"><X size={19} /></button>
        <p className="library-eyebrow">RENAME DOCUMENT</p>
        <h2 id="rename-title">Update document name</h2>
        <form onSubmit={submit} noValidate>
          <label className="operation-field" htmlFor="rename-document-name"><span>Document name</span><input data-dialog-initial-focus id="rename-document-name" value={name} maxLength={100} onChange={(event) => { setName(event.target.value); setError(""); }} aria-invalid={Boolean(error)} aria-describedby={error ? "rename-error" : "rename-help"} /></label>
          <small id="rename-help" className="operation-help">{document.fileExtension ? `The existing ${document.fileExtension} extension will be kept automatically.` : "Use a clear name of up to 100 characters."}</small>
          {error && <p id="rename-error" className="operation-error" role="alert">{error}</p>}
          <div className="dialog-actions"><button className="button-secondary" type="button" onClick={onClose}>Cancel</button><button className="button-primary" type="submit">Save name</button></div>
        </form>
      </section>
    </div>
  );
}

export function DeleteDialog({ document, onClose, onConfirm }) {
  const dialogRef = useDialogFocus(onClose);
  return (
    <div className="document-dialog-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section ref={dialogRef} className="document-dialog delete-dialog" role="alertdialog" aria-modal="true" aria-labelledby="delete-title" aria-describedby="delete-description">
        <button className="document-dialog-close" type="button" onClick={onClose} aria-label="Cancel delete"><X size={19} /></button>
        <p className="library-eyebrow">CONFIRM REMOVAL</p>
        <h2 id="delete-title">Delete this document record?</h2>
        <p id="delete-description" className="document-dialog-description">Remove “{document.name}”? This does not delete a file from your computer.</p>
        <div className="dialog-actions"><button data-dialog-initial-focus className="button-secondary" type="button" onClick={onClose}>Keep document</button><button className="document-delete-confirm" type="button" onClick={() => onConfirm(document.id)}>Delete record</button></div>
      </section>
    </div>
  );
}
