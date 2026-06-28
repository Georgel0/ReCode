'use client';

import { useState, useEffect, useRef } from 'react';
import { saveHistory } from '@/lib/firebase';

export function ModuleHeader({
  title,
  description,
  resultData,
  onShare,
  shareCopied = false,
  shareDisabled = false,
  showShare = true,
}) {
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [isAutoSaveEnabled, setIsAutoSaveEnabled] = useState(false);

  const savingRef = useRef(false);
  const savedRef = useRef(false);

  const handleSave = async () => {
    if (!resultData || savingRef.current || savedRef.current) return;

    savingRef.current = true;
    setSaving(true);
    try {
      await saveHistory(
        resultData.type,
        resultData.input,
        resultData.output,
        resultData.sourceLang || null,
        resultData.targetLang || null
      );
      savedRef.current = true;
      setSaved(true);
      setTimeout(() => {
        savedRef.current = false;
        setSaved(false);
      }, 3000);
    } catch (error) {
      console.error('Manual save failed:', error);
      alert('Error saving to history.');
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  useEffect(() => {
    if (isAutoSaveEnabled && resultData && !savedRef.current && !savingRef.current) {
      handleSave();
    }
  }, [resultData, isAutoSaveEnabled]);

  const showShareButton = showShare && !!onShare;

  return (
    <header className="module-header">
      <div className="header-content">
        <h1>{title}</h1>
        <p>{description}</p>
      </div>

      <div className="header-actions">
        {showShareButton && (
          <button
            className={`share-btn${shareCopied ? ' copied' : ''}`}
            onClick={onShare}
            disabled={shareDisabled || shareCopied}
            title="Copy a shareable link with this prompt & config"
          >
            {shareCopied ? (
              <><i className="fas fa-check"></i> Copied!</>
            ) : (
              <><i className="fas fa-link"></i> Share</>
            )}
          </button>
        )}

        {resultData && !isAutoSaveEnabled && (
          <button
            className={`save-btn${saved ? ' success' : ''}`}
            onClick={handleSave}
            disabled={saving || saved}
          >
            {saving ? (
              <><i className="fas fa-spinner fa-spin"></i> Saving...</>
            ) : saved ? (
              <><i className="fas fa-check"></i> Saved</>
            ) : (
              <><i className="fas fa-save"></i> Save Result</>
            )}
          </button>
        )}
      </div>
    </header>
  );
}