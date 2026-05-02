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

 const handleKeyDown = (e, id) => {
   if (e.key === 'Enter') handleRenameSubmit(id);
   if (e.key === 'Escape') setEditingId(null);
 };

 return (
  <div className="tabs-container">
   {files.map(f => (
    <button
     key={f.id}
     className={`tab-btn ${activeTabId === f.id ? 'active' : ''}`}
     onClick={() => setActiveTabId(f.id)}
     onDoubleClick={(e) => handleDoubleClick(e, f)}
     title={!readOnly ? "Double click to rename" : ""}
    >
     <i className="fa-solid fa-file-code"></i>
     
     {editingId === f.id ? (
       <input
         ref={inputRef}
         className="tab-input"
         value={editName}
         onChange={(e) => setEditName(e.target.value)}
         onBlur={() => handleRenameSubmit(f.id)}
         onKeyDown={(e) => handleKeyDown(e, f.id)}
         onClick={(e) => e.stopPropagation()}
       />
     ) : (
       <span>{f.name}</span>
     )}

     {!readOnly && files.length > 0 && (
      <span 
       className="close-tab" 
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