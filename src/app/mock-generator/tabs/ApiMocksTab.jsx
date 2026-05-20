'use client';
import React from 'react';

export default function ApiMocksTab() {
  return (
    <div className="mock-factory-container">
      <div className="mock-empty-state" style={{ height: '100%' }}>
        <i className="fas fa-network-wired" style={{ fontSize: '3rem', color: 'var(--accent)' }}></i>
        <h3>API & Frontend Mocks (Coming Soon)</h3>
        <p style={{ maxWidth: '500px', margin: '0 auto', lineHeight: '1.6' }}>
          This module will allow you to drop in GraphQL types, OpenAPI Swagger definitions, or raw JSON body samples to instantly generate functional MSW handlers, Next.js API route scaffolds, and deeply nested hierarchical document trees.
        </p>
      </div>
    </div>
  );
}