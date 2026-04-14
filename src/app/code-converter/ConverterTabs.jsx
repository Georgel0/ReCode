import React from 'react';

export default function ConverterTabs({ files, activeTabId, setActiveTabId, removeFile, readOnly = false }) {
 return (
  <div className="tabs-container">
   {files.map(f => (
    <button
     key={f.id}
     className={`tab-btn ${activeTabId === f.id ? 'active' : ''}`}
     onClick={() => setActiveTabId(f.id)}
    >
     <i className="fa-solid fa-file-code"></i> {f.name}
     {!readOnly && files.length > 1 && (
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
