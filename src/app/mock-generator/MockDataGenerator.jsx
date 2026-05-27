'use client';

import React, { useState, useEffect } from 'react';
import { ModuleHeader } from '@/components/layout';
import { useApp } from '@/context';

import DatabaseSeedingTab from './tabs/DatabaseSeedingTab';
import ApiMocksTab from './tabs/ApiMocksTab';
import StreamingEventsTab from './tabs/StreamingEventsTab';

import './styles/MockDataGenerator.css';
import './styles/DatabaseSeedingTab.css';
import './styles/ApiMocksTab.css'
import '@/styles/ErdDiagram.css';

export default function MockDataGenerator() {
  const [activeParadigm, setActiveParadigm] = useState('db');
  const [headerResultData, setHeaderResultData] = useState(null);

  const { moduleData } = useApp();

  useEffect(() => {
    if (moduleData?.type === 'api-mocks') setActiveParadigm('api');
    else if (moduleData?.type === 'mock') setActiveParadigm('db');
  }, [moduleData]);

  return (
    <div className="module-container flex-col-container">
      <ModuleHeader
        title="Mock Data Factory"
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
        <div className={`paradigm-pane ${activeParadigm === 'db' ? 'active' : ''}`}>
          <DatabaseSeedingTab onDataUpdate={setHeaderResultData} />
        </div>

        <div className={`paradigm-pane ${activeParadigm === 'api' ? 'active' : ''}`}>
          <ApiMocksTab onDataUpdate={setHeaderResultData} />
        </div>

        <div className={`paradigm-pane ${activeParadigm === 'stream' ? 'active' : ''}`}>
          <StreamingEventsTab />
        </div>
      </div>
    </div>
  );
}