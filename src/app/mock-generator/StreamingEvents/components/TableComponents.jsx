'use client';
import React, { useEffect, useRef } from "react";

export function EventColBadge({ label }) {
  let cls = 'm-col-type-badge';
  if (label === 'UUID') cls += ' m-col-type-badge--uuid';
  if (label === 'TIMESTAMP') cls += ' m-col-type-badge--ts';
  if (label === 'EVENT') cls += ' m-col-type-badge--pk';
  if (label === 'CORR') cls += ' m-col-type-badge--fk';
  if (label === 'BOOL') cls += ' m-col-type-badge--bool';
  if (label === 'INT' || label === 'FLOAT') cls += ' m-col-type-badge--num';
  return <span className={cls}>{label}</span>;
}

export function EditableCell({ value, isEditing, editingValue, onStartEdit, onChange, onCommit, onCancel, onCopy }) {
  const inputRef = useRef(null);
  const cancelledRef = useRef(false);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const displayVal = typeof value === 'object' && value !== null
    ? JSON.stringify(value)
    : String(value ?? '');

  if (isEditing) {
    return (
      <td className="m-editable-cell">
        <input
          ref={inputRef}
          className="m-cell-edit-input"
          value={editingValue}
          onChange={e => onChange(e.target.value)}
          onBlur={() => {
            if (!cancelledRef.current) onCommit();
            cancelledRef.current = false;
          }}
          onKeyDown={e => {
            if (e.key === 'Enter') onCommit();
            if (e.key === 'Escape') {
              cancelledRef.current = true;
              onCancel();
            }
          }}
        />
      </td>
    );
  }

  return (
    <td
      className="m-editable-cell"
      title="Double-click to edit · Triple-click to copy"
      onDoubleClick={() => onStartEdit(displayVal)}
      onClick={e => { if (e.detail === 3) onCopy(value); }}
    >
      <div className="m-cell-content-wrapper">
        <span className="m-cell-value">{displayVal}</span>
        <i className="fas fa-pencil-alt m-cell-edit-icon" />
      </div>
    </td>
  );
}