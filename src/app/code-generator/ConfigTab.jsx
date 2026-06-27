'use client';

import { FRAMEWORKS, ARCHITECTURE_PATTERNS, VERBOSITY_LEVELS } from './utils.js';
import { LANGUAGES } from '@/lib/index.js';

export default function ConfigTab({ config, setConfig }) {

  const handleChange = (key, value) => {
    if (key === 'framework') {
      // Reset sub-options whenever the framework switches
      setConfig(prev => ({ ...prev, framework: value, frameworkSubOptions: {} }));
    } else {
      setConfig(prev => ({ ...prev, [key]: value }));
    }
  };

  const handleSubOptionChange = (key, value) => {
    setConfig(prev => ({
      ...prev,
      frameworkSubOptions: { ...prev.frameworkSubOptions, [key]: value },
    }));
  };

  const selectedFramework = FRAMEWORKS.find(f => f.value === config.framework);
  const activeSubOptions  = selectedFramework?.subOptions || [];

  return (
    <>
      <h3 className="g-heading">
        <i className="fa-solid fa-sliders"></i>
        Configuration
      </h3>

      <div className="g-config-fields">
        <div className="g-control">
          <span className="g-label">Language</span>
          <select value={config.language} onChange={(e) => handleChange('language', e.target.value)}>
            {LANGUAGES.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>

        <div className="g-control">
          <span className="g-label">Framework</span>
          <select value={config.framework} onChange={(e) => handleChange('framework', e.target.value)}>
            {FRAMEWORKS.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>

        {activeSubOptions.length > 0 && (
          <div className="g-sub-options">
            {activeSubOptions.map(sub => (
              <div key={sub.key} className="g-control g-sub-control">
                <span className="g-label">
                  <i className="fa-solid fa-chevron-right g-sub-arrow"></i>
                  {sub.label}
                </span>
                <select
                  value={config.frameworkSubOptions?.[sub.key] || sub.options[0]}
                  onChange={(e) => handleSubOptionChange(sub.key, e.target.value)}
                >
                  {sub.options.map(opt => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        )}

        <div className="g-control">
          <span className="g-label">Architecture</span>
          <select value={config.architecture} onChange={(e) => handleChange('architecture', e.target.value)}>
            {ARCHITECTURE_PATTERNS.map(opt => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
        </div>

        <div className="g-control">
          <span className="g-label">Verbosity</span>
          <select value={config.verbosity} onChange={(e) => handleChange('verbosity', e.target.value)}>
            {VERBOSITY_LEVELS.map(level => (
              <option key={level.value} value={level.value}>{level.label}</option>
            ))}
          </select>
        </div>

        <div className="g-checks">
          <label className="custom-check">
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

        <div className="g-control">
          <span className="g-label">Custom Stack & Dependencies</span>
          <p className="g-config-hint">Libraries, databases, or extra tooling.</p>
          <textarea
            className="g-stack-textarea"
            value={config.customStack}
            onChange={(e) => handleChange('customStack', e.target.value)}
            placeholder="e.g., PostgreSQL, Redis, Docker, TailwindCSS..."
          />
        </div>
      </div>

      <p className="g-ps">Explicit instructions in your prompt take priority over these settings.</p>
    </>
  );
}