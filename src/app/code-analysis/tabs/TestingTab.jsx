"use client";
import { EmptyPlaceholder } from '../EmptyPlaceholder';

export function TestingTab({ testing }) {
  if (!testing || (!testing.edgeCases?.length && !testing.unitTests?.length)) {
    return <EmptyPlaceholder icon="fa-flask" title="No Testing Data" message="No specific edge cases or tests were generated for this code." />;
  }

  return (
    <div className="testing-container">
      {testing?.edgeCases && testing?.edgeCases.length > 0 && (
        <div style={{ marginBottom: '2rem' }}>
          <h4 style={{ color: 'var(--accent)', marginBottom: '1rem' }}><i className="fa-solid fa-triangle-exclamation"></i> Unhandled Edge Cases</h4>
          <ul className="simple-list">
            {testing.edgeCases.map((caseItem, i) => (
              <li key={i}><i className="fa-solid fa-chevron-right"></i> <span>{caseItem}</span></li>
            ))}
          </ul>
        </div>
      )}

      {testing?.unitTests && testing?.unitTests.length > 0 && (
        <div>
          <h4 style={{ color: 'var(--accent)', marginBottom: '1rem' }}><i className="fa-solid fa-vial-circle-check"></i> Recommended Unit Tests</h4>
          <ul className="simple-list">
            {testing.unitTests.map((test, i) => (
              <li key={i}><i className="fa-solid fa-check"></i> <span>{test}</span></li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
