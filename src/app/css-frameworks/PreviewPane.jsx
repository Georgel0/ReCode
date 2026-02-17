import { useState, useEffect } from 'react';
import { generatePreviewDoc, TARGET_FRAMEWORKS } from './constants';

export default function PreviewPane({ inputHtml, inputCss, outputHtml, targetLang, loading }) {
  const [fullScreenView, setFullScreenView] = useState(null); 
  const targetLabel = TARGET_FRAMEWORKS.find(t => t.value === targetLang)?.label;

  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key === 'Escape') setFullScreenView(null);
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, []);
  
  const toggleFullScreen = (view) => {
    if (fullScreenView === view) {
      setFullScreenView(null);
    } else {
      setFullScreenView(view);
    }
  };
  
  return (
    <div className="panel" style={{ marginTop: '2rem' }}>
      <div className="preview-header-row">
        <h3><i className="fa-solid fa-eye"></i> Visual Verification</h3>
        <p className="text-secondary" style={{ fontSize: '0.9rem' }}>
          Compare original vs. generated.
        </p>
      </div>
      
      <div className="preview-split-container">
        {/* Original Pane */}
        <div className={`preview-pane ${fullScreenView === 'original' ? 'is-fullscreen' : ''}`}>
          <div className="preview-toolbar">
            <span className="preview-label">Original</span>
            <button 
              className="expand-btn"
              onClick={() => toggleFullScreen('original')}
              title={fullScreenView === 'original' ? "Exit Full Screen" : "Full Screen"}
            >
              <i className={`fa-solid ${fullScreenView === 'original' ? 'fa-compress' : 'fa-expand'}`}></i>
            </button>
          </div>
          <div className="iframe-wrapper">
            {inputHtml ? (
              <iframe 
                className="preview-iframe"
                title="Original Preview"
                sandbox="allow-scripts"
                srcDoc={generatePreviewDoc(inputHtml, inputCss, 'none')}
              />
            ) : <div className="empty-state-preview">No Input</div>}
          </div>
        </div>

        {/* Result Pane */}
        <div className={`preview-pane ${fullScreenView === 'result' ? 'is-fullscreen' : ''}`}>
          <div className="preview-toolbar">
            <span className="preview-label" style={{ color: 'var(--accent)' }}>{targetLabel} Result</span>
            <button 
              className="expand-btn"
              onClick={() => toggleFullScreen('result')}
              title={fullScreenView === 'result' ? "Exit Full Screen" : "Full Screen"}
            >
              <i className={`fa-solid ${fullScreenView === 'result' ? 'fa-compress' : 'fa-expand'}`}></i>
            </button>
          </div>
          <div className="iframe-wrapper">
            {outputHtml ? (
              <iframe 
                className="preview-iframe"
                title="Converted Preview"
                sandbox="allow-scripts allow-same-origin"
                srcDoc={generatePreviewDoc(outputHtml, '', targetLang)}
              />
            ) : (
              <div className="empty-state-preview">
                {loading ? 'Rendering...' : 'Waiting for conversion...'}
              </div>
            )}
          </div>
        </div>
      </div>
      
      {fullScreenView && <div className="fullscreen-backdrop" onClick={() => setFullScreenView(null)}></div>}
    </div>
  );
}