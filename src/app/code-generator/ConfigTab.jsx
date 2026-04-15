'use client';

import { LANGUAGES, FRAMEWORKS, ARCHITECTURE_PATTERNS, VERBOSITY_LEVELS } from './utils.js';

export default function ConfigTab({ config, setConfig }) {
  const handleChange = (key, value) => {
    setConfig(prev => ({ ...prev, [key]: value }));
  };

  return (
    <div className="panel config-panel">
      <h3>
        <i className="fa-solid fa-sliders"></i>
        Project Configuration
      </h3>

      <div className="config-grid">
        <div className="config-section">
          <h4>Core Technology</h4>

          <div className="control-field config-control">
            <span className="label-text">Primary Language</span>
            <select
              value={config.language}
              onChange={(e) => handleChange('language', e.target.value)}
            >
              {LANGUAGES.map(opt => <option key={opt} value={opt}>{opt}</option>)}
            </select>
          </div>

          <div className="control-field config-control">
            <span className="label-text">Framework / Ecosystem</span>
            <select
              value={config.framework}
              onChange={(e) => handleChange('framework', e.target.value)}
            >
              {FRAMEWORKS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
            </select>
          </div>

          <div className="control-field">
            <span className="label-text">Architecture Pattern</span>
            <select
              value={config.architecture}
              onChange={(e) => handleChange('architecture', e.target.value)}
            >
              {ARCHITECTURE_PATTERNS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
            </select>
          </div>
        </div>

        <div className="config-section">
          <h4>Quality & Standards</h4>

          <div className="control-field config-control-lg">
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

          <label className="custom-check config-check">
            <input
              type="checkbox"
              checked={config.includeReadme}
              onChange={(e) => handleChange('includeReadme', e.target.checked)}
            />
            <div className="box"><i className="fa-solid fa-check"></i></div>
            <span className="label-text">Generate README.md</span>
          </label>

          <label className="custom-check config-check">
            <input
              type="checkbox"
              checked={config.includeDocs}
              onChange={(e) => handleChange('includeDocs', e.target.checked)}
            />
            <div className="box"><i className="fa-solid fa-check"></i></div>
            <span className="label-text">Include Code Documentation</span>
          </label>
          
          <label className="custom-check">
            <input
              type="checkbox"
              checked={config.includeTests}
              onChange={(e) => handleChange('includeTests', e.target.checked)}
            />
            <div className="box"><i className="fa-solid fa-check"></i></div>
            <span className="label-text">Generate Unit Tests</span>
          </label>
        </div>

        <div className="config-section full-width-grid">
          <h4>Custom Stack & Extra Dependencies</h4>
          <p className="config-description">
            Stack multiple libraries, databases, or specific tooling here.
          </p>
          <textarea
            className="output-textarea config-textarea"
            value={config.customStack}
            onChange={(e) => handleChange('customStack', e.target.value)}
            placeholder="e.g., PostgreSQL, Redis, Docker, TailwindCSS..."
          />
        </div>
      </div>

      <p className="ps-message">These settings guide the generation, but explicit instructions in your main prompt will always take priority.</p>
    </div>
  );
}