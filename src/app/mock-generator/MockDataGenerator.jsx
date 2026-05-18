'use client';

import React, { useState } from 'react';
import { ModuleHeader } from '@/components/layout';
import DatabaseSeedingTab from './tabs/DatabaseSeedingTab';
import ApiMocksTab from './tabs/ApiMocksTab';
import StreamingEventsTab from './tabs/StreamingEventsTab';
import './MockDataGenerator.css';

export default function MockDataGenerator() {
  const [activeParadigm, setActiveParadigm] = useState('db');
  const [headerResultData, setHeaderResultData] = useState(null);

  return (
    <div className="module-container flex-col-container">
      <ModuleHeader
        title="Enterprise Mock Data Factory"
        description="Transform schemas into highly interconnected relational targets, API mock handlers, and event streams."
        resultData={headerResultData}
      />

      <div className="paradigm-selector">
        <button
          className={`paradigm-btn ${activeParadigm === 'db' ? 'active' : ''}`}
          onClick={() => setActiveParadigm('db')}
        >
          <i className="fas fa-database"></i> Database Seeding
        </button>
        <button
          className={`paradigm-btn ${activeParadigm === 'api' ? 'active' : ''}`}
          onClick={() => setActiveParadigm('api')}
        >
          <i className="fas fa-network-wired"></i> API & Frontend Mocks
        </button>
        <button
          className={`paradigm-btn ${activeParadigm === 'stream' ? 'active' : ''}`}
          onClick={() => setActiveParadigm('stream')}
        >
          <i className="fas fa-stream"></i> Streaming & Events
        </button>
      </div>

      <div className="paradigm-content">
        {activeParadigm === 'db' && (
          <DatabaseSeedingTab onDataUpdate={setHeaderResultData} />
        )}
        {activeParadigm === 'api' && <ApiMocksTab />}
        {activeParadigm === 'stream' && <StreamingEventsTab />}
      </div>
    </div>
  );
}