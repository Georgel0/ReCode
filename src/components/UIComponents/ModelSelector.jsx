'use client';

import React from 'react';

const MODEL_OPTIONS = [
{
 id: 'turbo',
 title: 'Turbo Speed',
 icon: 'fa-bolt',
 desc: 'Best for quick edits and basic syntax checks.',
 specs: ['Near-zero latency', 'Light resource usage', 'Ideal for simple tasks']
},
{
 id: 'fast',
 title: 'Balanced',
 icon: 'fa-stopwatch',
 desc: 'The sweet spot between speed and logic.',
 specs: ['Quick response time', 'Reliable for daily coding', 'Handles code better']
},
{
 id: 'quality',
 title: 'Deep Thought',
 icon: 'fa-gem',
 desc: 'Maximum reasoning for complex architectural tasks.',
 specs: ['Superior problem solving', 'Advanced logic & context', 'Higher latency (best for precision)']
}];

export default function ModelSelector({ isOpen, onClose, onSelect, currentMode }) {
 if (!isOpen) return null;
 
 return (
  <div className="modal-overlay">
   <div className="modal-content">
    <div className="modal-header">
     <h2><i className="fas fa-microchip"></i> Select AI Model</h2>
     {onClose && <button className="close-btn" onClick={onClose}>✕</button>}
    </div>
        
    <p className="modal-desc">Choose the processing power for your request.</p>
        
    <div className="model-options-grid">
     {MODEL_OPTIONS.map((model) => (
      <div 
       key={model.id} 
       className={`model-card ${model.id} ${currentMode === model.id ? 'active' : ''}`} 
       onClick={() => onSelect(model.id)} >
      <div className="card-icon"><i className={`fas ${model.icon}`}></i></div>
       <div className="card-info">
        <h3>{model.title}</h3>
        <p>{model.desc}</p>
        <ul className="specs">
         {model.specs.map((spec, i) => (
          <li key={i}><i className="fas fa-check"></i> {spec}</li>
         ))}
        </ul>
       </div>
              
       {currentMode === model.id && (
        <div className="active-badge">Current Selection</div>
       )}
      </div>
     ))}
    </div>
   </div>
  </div>
 );
}