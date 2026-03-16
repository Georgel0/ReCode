"use client";
import { EmptyPlaceholder } from '../EmptyPlaceholder';

export function IssuesTab({ type, items }) {
  if (!items || items.length === 0) {
    return (
      <EmptyPlaceholder 
        icon={type === 'security' ? 'fa-shield-check' : 'fa-thumbs-up'}
        title={`No ${type} issues found`}
        message="The static analysis did not detect any problems in this category for the provided code."
      />
    );
  }

  const getSeverityClass = (sev) => {
    switch(sev?.toLowerCase()) {
      case 'critical': return 'sev-critical';
      case 'high': return 'sev-high';
      case 'medium': return 'sev-medium';
      case 'low': return 'sev-low';
      default: return 'sev-medium';
    }
  };

  return (
    <div className="issues-container">
      {items.map((item, idx) => (
        <div key={idx} className="issue-card">
          <div className="issue-header">
            {item.severity ? (
              <span className={`severity-badge ${getSeverityClass(item.severity)}`}>
                {item.severity}
              </span>
            ) : (
               <span className="severity-badge sev-low"><i className="fa-solid fa-lightbulb"></i> Tip</span>
            )}
            {item.location && <span className="issue-location"><i className="fa-regular fa-file-code"></i> {item.location}</span>}
          </div>
          <div className="issue-body">
            <div>
              <strong>Issue:</strong>
              <p>{item.issue}</p>
            </div>
            <div className="resolution-block">
              <strong><i className="fa-solid fa-wrench"></i> Resolution:</strong>
              <p>{item.resolution}</p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
