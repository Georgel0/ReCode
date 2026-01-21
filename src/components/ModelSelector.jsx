import React from 'react';

export default function ModelSelector({ isOpen, onClose, onSelect }) {
 if (!isOpen) return null;
 
 return (
  <div className="modal-overlay">
   <div className="modal-content model-selector-modal">
    <div className="modal-header">
     <h2><i className="fas fa-microchip"></i> Select AI Model</h2>
     {onClose && <button className="close-btn" onClick={onClose}>✕</button>}
    </div>
    
    <p className="modal-desc">Choose how ReCode processes your requests. You can change this later.</p>
    
    <div className="model-options-grid">
     <div className="model-card fast" onClick={() => onSelect('fast')}>
      <div className="card-icon"><i className="fas fa-stopwatch"></i></div>
      <div className="card-info">
       <h3>Fast Response</h3>
       <p>Fast response but lower code quality</p>
       <ul className="specs">
        <li><i className="fas fa-check"></i> Instant response time</li>
        <li><i className="fas fa-check"></i> Good for simple tasks</li>
        <li><i className="fas fa-check"></i> Lower latency</li>
       </ul>
      </div>
     </div>
     
      <div className="model-card quality" onClick={() => onSelect('quality')}>
      <div className="card-icon"><i className="fas fa-gem"></i></div>
      <div className="card-info">
       <h3>High Quality</h3>
       <p>Slower response but higher code quality</p>
       <ul className="specs">
        <li><i className="fas fa-check"></i> Instant response time</li>
        <li><i className="fas fa-check"></i> Good for simple tasks</li>
        <li><i className="fas fa-check"></i> Lower latency</li>
       </ul>
      </div>
     </div>
    </div>
   </div>
  </div>
 );
}