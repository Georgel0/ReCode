'use client';

import { CopyButton, CodeEditor } from '@/components/ui';
import { EmptyState } from '@/components/layout';
import { getLanguage } from './utils';

export default function OutputPanel({
  files,
  activeFileIndex,
  setActiveFileIndex,
  onFileChange,
  loading
}) {
  const activeFile = files[activeFileIndex] || null;

  return (
    <div className="g-panel">
      {files.length > 0 ? (
        <>
          <div className="g-tab-bar">
            <div className="g-tabs">
              {files.map((file, idx) => (
                <button
                  key={idx}
                  className={`g-tab ${activeFileIndex === idx ? 'active' : ''}`}
                  onClick={() => setActiveFileIndex(idx)}
                >
                  {file.fileName}
                </button>
              ))}
            </div>
          </div>

          <div className="g-code-area">
            <div className="g-code-toolbar">
              <CodeEditor
                value={activeFile?.content || ''}
                onValueChange={(newContent) => onFileChange(activeFileIndex, newContent)}
                language={activeFile ? getLanguage(activeFile.fileName) : ''}
              />
              <CopyButton codeToCopy={activeFile?.content || ''} />
            </div>
          </div>
        </>
      ) : (
        <EmptyState
          isLoading={loading}
          condition={files.length === 0}
          icon="fas fa-cubes"
          title="Awaiting App Specifications"
          description="Submit your solution requirements to automatically scaffold complete multi-file microservice or workspace directories."
          hint={<>Configure target stack properties like <code>includeTests</code> or custom frameworks in the sidebar.</>}
          loadingTitle="Scaffolding Workspace"
          loadingDescription="Assembling file modules, writing functional standard boilerplate templates, and structuring architecture trees..."
        />
      )}
    </div>
  );
}