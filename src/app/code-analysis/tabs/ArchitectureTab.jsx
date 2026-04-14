"use client";
import { EmptyPlaceholder } from '../EmptyPlaceholder';

export function ArchitectureTab({ architecture }) {
  if (!architecture || (!architecture?.smells?.length && !architecture?.dependencies?.length)) {
    return <EmptyPlaceholder icon="fa-cubes" title="Clean Architecture" message="No architectural code smells or dependency warnings were detected." />;
  }

  return (
    <div className="architecture-container">
      {architecture?.smells && architecture?.smells.length > 0 && (
        <div className="tab-section">
          <h4 className="tab-section-title">
            <i className="fa-solid fa-wind"></i> Code Smells
          </h4>
          <ul className="simple-list">
            {architecture.smells.map((smell, i) => (
              <li key={i}>
                <i className="fa-solid fa-circle-exclamation text-warning"></i> 
                <span>{smell}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {architecture?.dependencies && architecture?.dependencies.length > 0 && (
        <div className="tab-section">
          <h4 className="tab-section-title">
            <i className="fa-solid fa-boxes-stacked"></i> Ecosystem & Dependencies
          </h4>
          <ul className="simple-list">
            {architecture.dependencies.map((dep, i) => (
              <li key={i}>
                <i className="fa-solid fa-link-slash text-danger"></i> 
                <span>{dep}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}