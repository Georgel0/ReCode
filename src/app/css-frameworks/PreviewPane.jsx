import { generatePreviewDoc, TARGET_FRAMEWORKS } from './constants';

export default function PreviewPane({ inputHtml, inputCss, outputHtml, targetLang, loading }) {
 
 const targetLabel = TARGET_FRAMEWORKS.find(t => t.value === targetLang)?.label;
 
 return (
  <div className="panel" style={{marginTop: '2rem'}}>
      <h3><i className="fa-solid fa-eye"></i> Visual Verification</h3>
      <p className="text-secondary" style={{fontSize: '0.9rem', marginBottom: '1rem'}}>
        Compare your original HTML+CSS against the AI-generated version.
      </p>
      
      <div className="preview-split-container">
        <div className="preview-pane">
          <div className="preview-header">Original</div>
          {inputHtml ? (
            <iframe 
              className="preview-iframe"
              title="Original Preview"
              sandbox="allow-scripts"
              srcDoc={generatePreviewDoc(inputHtml, inputCss, 'none')}
            />
          ) : <div className="empty-state-preview">No Input</div>}
        </div>

        <div className="preview-pane">
          <div className="preview-header" style={{color: 'var(--accent)'}}>
            {targetLabel} Result
          </div>
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
 );
}