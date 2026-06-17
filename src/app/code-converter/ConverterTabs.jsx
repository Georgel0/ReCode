'use client';

import React, { useState, useRef, useEffect } from 'react';

export function ConverterTabs({ files, activeTabId, setActiveTabId, removeFile, renameFile, readOnly = false }) {
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState('');

  const isClosingRef = useRef(false);
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

  const startEdit = (f) => {
    if (readOnly) return;
    setEditingId(f.id);
    setEditName(f.name);
  };

  const handleRenameSubmit = (id) => {
    isClosingRef.current = true;
    if (editName.trim()) {
      renameFile(id, editName.trim());
    }
    setEditingId(null);
  };

  const handleInputKeyDown = (e, id) => {
    if (e.key === 'Enter') handleRenameSubmit(id);
    if (e.key === 'Escape') {
      isClosingRef.current = true;
      setEditingId(null);
    }
  };

  const handleTabKeyDown = (e, f, index) => {
    if (editingId === f.id) return;

    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      setActiveTabId(f.id);
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      setActiveTabId(files[(index + 1) % files.length].id);
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      setActiveTabId(files[(index - 1 + files.length) % files.length].id);
    } else if (e.key === 'F2' && !readOnly) {
      e.preventDefault();
      startEdit(f);
    }
  };

  return (
    <div className="c-tabs" role="tablist" aria-label="Open files">
      {files.map((f, index) => (
        <div
          key={f.id}
          role="tab"
          aria-selected={activeTabId === f.id}
          tabIndex={0}
          className={`c-tab${activeTabId === f.id ? ' c-tab--active' : ''}`}
          onClick={() => { if (editingId !== f.id) setActiveTabId(f.id); }}
          onDoubleClick={(e) => !readOnly && handleDoubleClick(e, f)}
          onKeyDown={(e) => handleTabKeyDown(e, f, index)}
          title={!readOnly ? "Double-click or F2 to rename" : ""}
        >
          <i className="fa-solid fa-file-code"></i>

          <span className="c-tab__name">
            {editingId === f.id ? (
              <input
                ref={inputRef}
                className="c-tab-input"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                onBlur={() => {
                  if (isClosingRef.current) {
                    isClosingRef.current = false;
                    return;
                  }
                  handleRenameSubmit(f.id);
                }}
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
        </div>
      ))}
    </div>
  );
}