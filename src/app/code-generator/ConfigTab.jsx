'use client';

import { STYLING_OPTIONS, STATE_MANAGEMENT, VERBOSITY_LEVELS } from './utils.js';

export default function ConfigTab({ config, setConfig }) {
 const handleChange = (key, value) => {
  setConfig(prev => ({ ...prev, [key]: value }));
 };
 
 return (
  <div className="panel config-panel">
   <h3>
    <i className="fa-solid fa-sliders" style={{ marginRight: '8px' }}></i>
    Project Configuration
   </h3>
      
   <div className="config-grid">
    <div className="config-section">
     <h4>Core Tech</h4>
          
     <label className="custom-check" style={{ marginBottom: '1rem' }}>
      <input 
       type="checkbox" 
       checked={config.typescript} 
       onChange={(e) => handleChange('typescript', e.target.checked)} 
      />
      <div className="box"><i className="fa-solid fa-check"></i></div>
      <span className="label-text">Use TypeScript</span>
     </label>

     <div className="control-field">
      <span className="label-text">Styling Engine</span>
       <select 
        value={config.styling} 
        onChange={(e) => handleChange('styling', e.target.value)}
       >
        {STYLING_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
       </select>
      </div>

      <div className="control-field">
       <span className="label-text">State Management (React)</span>
       <select 
        value={config.stateManagement} 
        onChange={(e) => handleChange('stateManagement', e.target.value)}
       >
        {STATE_MANAGEMENT.map(opt => <option key={opt} value={opt}>{opt}</option>)}
       </select>
      </div>
     </div>
     
     <div className="config-section">
          <h4>Quality & Standards</h4>
          
          <div className="control-field" style={{ marginBottom: '1rem' }}>
            <span className="label-text">Code Verbosity</span>
            <select 
              value={config.verbosity} 
              onChange={(e) => handleChange('verbosity', e.target.value)}
            >
              {VERBOSITY_LEVELS.map(level => (
                <option key={level.value} value={level.value}>{level.label}</option>
              ))}
            </select>
          </div>

          <label className="custom-check" style={{ marginBottom: '0.75rem' }}>
            <input 
              type="checkbox" 
              checked={config.includeReadme} 
              onChange={(e) => handleChange('includeReadme', e.target.checked)} 
            />
            <div className="box"><i className="fa-solid fa-check"></i></div>
            <span className="label-text">Generate README.md</span>
          </label>

     <label className="custom-check">
      <input 
       type="checkbox" 
       checked={config.includeJSDoc} 
       onChange={(e) => handleChange('includeJSDoc', e.target.checked)} 
      />
      <div className="box"><i className="fa-solid fa-check"></i></div>
      <span className="label-text">Include JSDoc/TypeDoc Comments</span>
     </label>
    </div>
        
    <div className="config-section full-width-grid">
     <h4>Custom Stack & Extra Dependencies</h4>
     <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: 0, marginBottom: '0.5rem' }}>
      Stack multiple frameworks, libraries, or specific architectural patterns here.
     </p>
     <textarea 
      className="output-textarea"
      style={{ minHeight: '100px' }}
      value={config.customStack}
      onChange={(e) => handleChange('customStack', e.target.value)}
      placeholder="e.g., Next.js App Router, Prisma, PostgreSQL, Framer Motion for animations..."
     />
    </div>
   </div>
   
   <p className="ps-message">These are just optional, your main prompt will be prioritized. Make sure to be as detailed as possible.</p>
  </div>
 );
}