'use client';

import React, { useState, useRef, useEffect } from 'react';

export function ConverterTabs({ files, activeTabId, setActiveTabId, removeFile, renameFile, readOnly = false }) {
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState('');
  const inputRef = useRef(null);

  useEffect(() => {
    if (editingId && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editingId]);

  const handleDoubleClick = (e, f) => {
    if (readOnly) return;
    e.stopPropagation();
    setEditingId(f.id);
    setEditName(f.name);
  };

  const handleRenameSubmit = (id) => {
    if (editName.trim()) {
      renameFile(id, editName.trim());
    }
    setEditingId(null);
  };

  const handleInputKeyDown = (e, id) => {
    if (e.key === 'Enter') handleRenameSubmit(id);
    if (e.key === 'Escape') setEditingId(null);
  };

  return (
    <div className="c-tabs" aria-label="Open files">
      {files.map((f) => (
        <button
          key={f.id}
          role="tab"
          aria-selected={activeTabId === f.id}
          tabIndex={0}
          className={`c-tab${activeTabId === f.id ? ' c-tab--active' : ''}`}
          onClick={() => { if (editingId !== f.id) setActiveTabId(f.id); }}
          onDoubleClick={(e) => !readOnly && handleDoubleClick(e, f)}
          title={!readOnly ? "Double click to rename" : ""}
        >
          <i className="fa-solid fa-file-code"></i>

          <span className="c-tab__name">
            {editingId === f.id ? (
              <input
                ref={inputRef}
                className="c-tab-input"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                onBlur={() => handleRenameSubmit(f.id)}
                onKeyDown={(e) => handleInputKeyDown(e, f.id)}
                onClick={(e) => e.stopPropagation()}
                autoFocus
              />
            ) : (
              f.name || 'untitled'
            )}
          </span>

          {!readOnly && files.length > 1 && (
            <span
              className="c-tab__close"
              aria-label={`Close ${f.name}`}
              onClick={(e) => { e.stopPropagation(); removeFile(f.id); }}
              title="Remove file"
            >
              <i className="fa-solid fa-xmark"></i>
            </span>
          )}
        </button>
      ))}
    </div>
  );
}