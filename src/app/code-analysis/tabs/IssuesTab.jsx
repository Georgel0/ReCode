"use client";
import { useState, useMemo } from 'react';
import { EmptyPlaceholder } from '../components/EmptyPlaceholder';
import { FixDiffModal } from '../components/FixDiffModal';

const SEVERITIES = ['Critical', 'High', 'Medium', 'Low'];

const SEV_META = {
  Critical: { cls: 'a-sev-critical', cardCls: 'a-issue-card--critical', icon: 'fa-circle-radiation' },
  High:     { cls: 'a-sev-high',     cardCls: 'a-issue-card--high',     icon: 'fa-fire' },
  Medium:   { cls: 'a-sev-medium',   cardCls: 'a-issue-card--medium',   icon: 'fa-triangle-exclamation' },
  Low:      { cls: 'a-sev-low',      cardCls: 'a-issue-card--low',      icon: 'fa-circle-info' },
};

const getSeverityClass = (sev) => SEV_META[sev]?.cls ?? 'a-sev-medium';
const getCardClass     = (sev) => SEV_META[sev]?.cardCls ?? '';

function SeverityFilters({ items, active, onToggle }) {
  const counts = useMemo(() => {
    const map = {};
    (items || []).forEach(item => {
      const s = item.severity || 'Low';
      map[s] = (map[s] || 0) + 1;
    });
    return map;
  }, [items]);

  const presentLevels = SEVERITIES.filter(s => counts[s]);
  if (presentLevels.length < 2) return null;

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

export function IssuesTab({ type, items, sourceCode, language }) {
  const [activeFilters, setActiveFilters] = useState([]);
  const [diffIssue, setDiffIssue] = useState(null);

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
    <>
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
              <div key={idx} className={`a-issue-card ${getCardClass(item.severity)}`}>
                <div className="a-issue-header">
                  <div className="a-issue-header-left">
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

                  <button
                    className="a-show-fix-btn"
                    onClick={() => setDiffIssue(item)}
                    title="See AI-generated fix"
                  >
                    <i className="fa-solid fa-wand-magic-sparkles" />
                    Show Fix
                  </button>
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

      {diffIssue && (
        <FixDiffModal
          issue={diffIssue}
          sourceCode={sourceCode || ''}
          language={language || 'javascript'}
          onClose={() => setDiffIssue(null)}
        />
      )}
    </>
  );
}