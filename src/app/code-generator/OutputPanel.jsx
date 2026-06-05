'use client';

import { CopyButton, CodeOutput } from '@/components/ui';
import { EmptyState } from '@/components/layout';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { getLanguage } from './utils';

export default function OutputPanel({
  files,
  activeFileIndex,
  setActiveFileIndex,
  loading
}) {
  const activeFile = files[activeFileIndex] || null;

  const downloadSingleFile = (file) => {
    if (!file) return;
    const blob = new Blob([file.content], { type: 'text/plain' });
    saveAs(blob, file.fileName);
  };

  const downloadZip = async () => {
    const zip = new JSZip();
    files.forEach(f => zip.file(f.fileName, f.content));
    const content = await zip.generateAsync({ type: 'blob' });
    saveAs(content, 'project.zip');
  };

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
              <CodeOutput
                content={activeFile?.content || ''}
                language={activeFile ? getLanguage(activeFile.fileName) : ''}
              />
              <CopyButton codeToCopy={activeFile?.content || ''} />
            </div>
          </div>

          <div className="g-panel-footer action-row">
            <div className="g-spacer" />
            <button className="secondary-button" onClick={() => downloadSingleFile(activeFile)}>
              <i className="fa-solid fa-download"></i> File
            </button>
            {files.length > 1 && (
              <button className="primary-button" onClick={downloadZip}>
                <i className="fa-solid fa-file-zipper"></i> Download ZIP
              </button>
            )}
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