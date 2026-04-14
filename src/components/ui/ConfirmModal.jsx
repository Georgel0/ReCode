import React from 'react';

export function ConfirmModal({ 
  isOpen, 
  title, 
  message, 
  confirmText = "Confirm", 
  cancelText = "Cancel", 
  onConfirm, 
  onCancel,
  icon = "fa-circle-question"
}) {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div 
        className="modal-content" 
        onClick={e => e.stopPropagation()} 
        style={{ maxWidth: '500px', margin: '15vh auto' }}
      >
        <div className="modal-header">
          <h2><i className={`fa-solid ${icon}`}></i> {title}</h2>
        </div>
        
        <p className="modal-desc">{message}</p>
        
        <div className="action-row">
          <button className="secondary-button" onClick={onCancel}>
            {cancelText}
          </button>
          <button className="primary-button" onClick={onConfirm}>
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
