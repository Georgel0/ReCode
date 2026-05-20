import React from 'react';

export function EmptyState({
  isLoading,
  condition,
  icon,
  title,
  description,
  hint,
  loadingTitle,
  loadingDescription,
}) {

  return (
    <>
      {condition && !isLoading && (
        <div className="empty-state styled-empty">
          <div className="empty-state-icon-ring">
            <i className={`fas ${icon}`} />
          </div>
          <h3>{title}</h3>
          <p>{description}</p>
          {hint && (
            <div className="empty-hints">
              <span className="hint-chip">
                <i className="fas fa-lightbulb text-accent" /> Hint: {hint}
              </span>
            </div>
          )}
        </div>

      )}
      {isLoading && (
        <div className="empty-state loading-state-pane styled-empty">
          <div className="spinner-large" />
          <h3>{loadingTitle}</h3>
          <p>{loadingDescription}</p>
        </div>
      )}
    </>
  );
}