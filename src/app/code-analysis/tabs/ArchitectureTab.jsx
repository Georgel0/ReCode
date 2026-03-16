"use client";
import { EmptyPlaceholder } from '../EmptyPlaceholder';

export function ArchitectureTab({ architecture }) {
  if (!architecture || (!architecture.smells?.length && !architecture.dependencies?.length)) {
    return <EmptyPlaceholder icon="fa-cubes" title="Clean Architecture" message="No architectural code smells or dependency warnings were detected." />;
  }

  return (
    <div className="architecture-container">
      {architecture.smells && architecture.smells.length > 0 && (
        <div style={{ marginBottom: '2rem' }}>
          <h4 style={{ color: 'var(--accent)', marginBottom: '1rem' }}><i className="fa-solid fa-wind"></i> Code Smells</h4>
          <ul className="simple-list">
            {architecture.smells.map((smell, i) => (
              <li key={i}><i className="fa-solid fa-circle-exclamation" style={{ color: '#f59e0b' }}></i> <span>{smell}</span></li>
            ))}
          </ul>
        </div>
      )}

      {architecture.dependencies && architecture.dependencies.length > 0 && (
        <div>
          <h4 style={{ color: 'var(--accent)', marginBottom: '1rem' }}><i className="fa-solid fa-boxes-stacked"></i> Ecosystem & Dependencies</h4>
          <ul className="simple-list">
            {architecture.dependencies.map((dep, i) => (
              <li key={i}><i className="fa-solid fa-link-slash" style={{ color: '#ef4444' }}></i> <span>{dep}</span></li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}