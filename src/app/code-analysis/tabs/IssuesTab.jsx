"use client";
import { useState, useMemo } from 'react';
import { EmptyPlaceholder } from '../EmptyPlaceholder';

const SEVERITIES = ['Critical', 'High', 'Medium', 'Low'];

const SEV_META = {
  Critical: { cls: 'a-sev-critical', icon: 'fa-circle-radiation' },
  High: { cls: 'a-sev-high', icon: 'fa-fire' },
  Medium: { cls: 'a-sev-medium', icon: 'fa-triangle-exclamation' },
  Low: { cls: 'a-sev-low', icon: 'fa-circle-info' },
};

const getSeverityClass = (sev) => SEV_META[sev]?.cls ?? 'a-sev-medium';

function SeverityFilters({ items, active, onToggle }) {
  // Count occurrences per severity level (only levels present in items)
  const counts = useMemo(() => {
    const map = {};
    (items || []).forEach(item => {
      const s = item.severity || 'Low';
      map[s] = (map[s] || 0) + 1;
    });
    return map;
  }, [items]);

  const presentLevels = SEVERITIES.filter(s => counts[s]);
  if (presentLevels.length < 2) return null; // hide if only one severity level

  return (
    <div className="a-severity-filters">
      <button
        className={`a-sev-pill a-sev-pill--all ${active.length === 0 ? 'a-sev-pill--on' : ''}`}
        onClick={() => onToggle(null)}
      >
        All <span className="a-sev-pill-count">{items.length}</span>
      </button>
      {presentLevels.map(sev => (
        <button
          key={sev}
          className={`a-sev-pill ${SEV_META[sev].cls} ${active.includes(sev) ? 'a-sev-pill--on' : ''}`}
          onClick={() => onToggle(sev)}
        >
          <i className={`fa-solid ${SEV_META[sev].icon}`} />
          {sev}
          <span className="a-sev-pill-count">{counts[sev]}</span>
        </button>
      ))}
    </div>
  );
}

export function IssuesTab({ type, items }) {
  const [activeFilters, setActiveFilters] = useState([]); // [] = show all

  const handleToggle = (sev) => {
    if (sev === null) { setActiveFilters([]); return; }
    setActiveFilters(prev =>
      prev.includes(sev) ? prev.filter(s => s !== sev) : [...prev, sev]
    );
  };

  const filtered = useMemo(() => {
    if (!items) return [];
    if (activeFilters.length === 0) return items;
    return items.filter(item => activeFilters.includes(item.severity || 'Low'));
  }, [items, activeFilters]);

  if (!items || items.length === 0) {
    return (
      <EmptyPlaceholder
        icon={type === 'security' ? 'fa-shield-check' : 'fa-thumbs-up'}
        title={`No ${type} issues found`}
        message="The static analysis did not detect any problems in this category for the provided code."
      />
    );
  }

  return (
    <div className="a-issues-wrapper">
      <SeverityFilters items={items} active={activeFilters} onToggle={handleToggle} />

      {filtered.length === 0 ? (
        <div className="a-issues-filter-empty">
          <i className="fa-solid fa-filter-circle-xmark" />
          <p>No issues match the selected filter{activeFilters.length > 1 ? 's' : ''}.</p>
        </div>
      ) : (
        <div className="a-issues-container">
          {filtered.map((item, idx) => (
            <div key={idx} className="a-issue-card">
              <div className="a-issue-header">
                {item.severity ? (
                  <span className={`a-severity-badge ${getSeverityClass(item.severity)}`}>
                    <i className={`fa-solid ${SEV_META[item.severity]?.icon ?? 'fa-circle-exclamation'}`} />
                    {item.severity}
                  </span>
                ) : (
                  <span className="a-severity-badge a-sev-low">
                    <i className="fa-solid fa-lightbulb" /> Tip
                  </span>
                )}
                {item.location && (
                  <span className="a-issue-location">
                    <i className="fa-regular fa-file-code" /> {item.location}
                  </span>
                )}
              </div>
              <div className="a-issue-body">
                <div>
                  <strong>Issue:</strong>
                  <p>{item.issue}</p>
                </div>
                <div className="a-resolution-block">
                  <strong><i className="fa-solid fa-wrench" /> Resolution:</strong>
                  <p>{item.resolution}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}