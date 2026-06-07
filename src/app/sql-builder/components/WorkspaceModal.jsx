'use client';

export function WorkspaceModal({
  isOpen,
  newWorkspaceName,
  setNewWorkspaceName,
  onConfirm,
  onClose,
}) {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-content s-sql-project-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="workspace-modal-title"
      >
        <div className="modal-header">
          <h4 id="workspace-modal-title">Create New Workspace</h4>
          <button className="s-close-btn" onClick={onClose} aria-label="Close">
            <i className="fa-solid fa-xmark"></i>
          </button>
        </div>
        <div className="modal-body">
          <p className="modal-desc">Enter a name for your new database schema workspace:</p>
          <input
            type="text"
            className="s-combobox-input s-full-width"
            value={newWorkspaceName}
            onChange={(e) => setNewWorkspaceName(e.target.value)}
            placeholder="e.g., E-commerce DB"
            autoFocus
            onKeyDown={(e) => e.key === 'Enter' && onConfirm()}
          />
        </div>
        <div className="modal-footer">
          <button className="secondary-button" onClick={onClose}>Cancel</button>
          <button className="primary-button" onClick={onConfirm}>Create</button>
        </div>
      </div>
    </div>
  );
}