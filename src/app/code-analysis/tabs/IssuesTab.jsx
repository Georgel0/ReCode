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
      case 'critical': return 'a-sev-critical';
      case 'high': return 'a-sev-high';
      case 'medium': return 'a-sev-medium';
      case 'low': return 'a-sev-low';
      default: return 'a-sev-medium';
    }
  };

  return (
    <div className="a-issues-container">
      {items.map((item, idx) => (
        <div key={idx} className="a-issue-card">
          <div className="a-issue-header">
            {item.severity ? (
              <span className={`a-severity-badge ${getSeverityClass(item.severity)}`}>
                {item.severity}
              </span>
            ) : (
               <span className="a-severity-badge a-sev-low"><i className="fa-solid fa-lightbulb"></i> Tip</span>
            )}
            {item.location && <span className="a-issue-location"><i className="fa-regular fa-file-code"></i> {item.location}</span>}
          </div>
          <div className="a-issue-body">
            <div>
              <strong>Issue:</strong>
              <p>{item.issue}</p>
            </div>
            <div className="a-resolution-block">
              <strong><i className="fa-solid fa-wrench"></i> Resolution:</strong>
              <p>{item.resolution}</p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}