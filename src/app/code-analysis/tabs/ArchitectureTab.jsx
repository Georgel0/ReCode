"use client";
import { EmptyPlaceholder } from '../components/EmptyPlaceholder';

export function ArchitectureTab({ architecture }) {
  if (!architecture || (!architecture?.smells?.length && !architecture?.dependencies?.length)) {
    return <EmptyPlaceholder icon="fa-cubes" title="Clean Architecture" message="No architectural code smells or dependency warnings were detected." />;
  }

  return (
    <div className="a-architecture-container">
      {architecture?.smells && architecture?.smells.length > 0 && (
        <div className="a-tab-section">
          <h4 className="a-tab-section-title">
            <i className="fa-solid fa-wind"></i> Code Smells
          </h4>
          <ul className="a-simple-list">
            {architecture.smells.map((smell, i) => (
              <li key={`${smell}-${i}`}>
                <i className="fa-solid fa-circle-exclamation a-text-warning"></i> 
                <span>{smell}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {architecture?.dependencies && architecture?.dependencies.length > 0 && (
        <div className="a-tab-section">
          <h4 className="a-tab-section-title">
            <i className="fa-solid fa-boxes-stacked"></i> Ecosystem & Dependencies
          </h4>
          <ul className="a-simple-list">
            {architecture.dependencies.map((dep, i) => (
              <li key={`${dep}-${i}`}>
                <i className="fa-solid fa-link-slash a-text-danger"></i> 
                <span>{dep}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}