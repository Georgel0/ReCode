'use client';

import React, { useState, useEffect } from 'react';
import { ModuleHeader } from '@/components/layout';
import { useApp } from '@/context';

import DatabaseSeedingTab from './DatabaseSeeding/DatabaseSeedingTab';
import ApiMocksTab from './ApiMocks/ApiMocksTab';
import StreamingEventsTab from './StreamingEvents/StreamingEventsTab';

import './MockDataGenerator.css';
import './ApiMocks/ApiMocksTab.css';
import './DatabaseSeeding/DatabaseSeedingTab.css'
import './StreamingEvents/StreamingEventsTab.css';

const EMPTY_SHARE_STATE = { share: undefined, shareCopied: false, resultData: null, shareDisabled: true };

export default function MockDataGenerator() {
  const { moduleData } = useApp();

  const [activeParadigm, setActiveParadigm] = useState('api');
  const [headerResultData, setHeaderResultData] = useState(null);
  const [shareState, setShareState] = useState(EMPTY_SHARE_STATE);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    setIsMobile(window.innerWidth < 576);
    const handleResize = () => setIsMobile(window.innerWidth < 576);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (moduleData?.type === 'api-mocks') setActiveParadigm('api');
    else if (moduleData?.type === 'mock') setActiveParadigm('db');
    else if (moduleData?.type === 'stream') setActiveParadigm('stream');
  }, [moduleData]);

  // Clear stale share state immediately on switch so the header doesn't
  // briefly show the previous tool's share link/copied state while the
  // newly-active tab mounts and reports its own.
  useEffect(() => {
    setShareState(EMPTY_SHARE_STATE);
  }, [activeParadigm]);

  // Only ApiMocksTab reports live share state today; db/stream fall back to
  // the old post-generate snapshot via onDataUpdate until they're upgraded.
  const isShareAware = activeParadigm === 'api';

  return (
    <div className="m-module-container m-flex-col-container">
      <ModuleHeader
        title="Mock Data Factory"
        description="Transform schemas into highly interconnected relational targets, API mock handlers, and event streams."
        resultData={isShareAware ? shareState.resultData : headerResultData}
        onShare={isShareAware ? shareState.share : undefined}
        shareCopied={shareState.shareCopied}
        shareDisabled={shareState.shareDisabled}
      />

      <div className="m-paradigm-selector">
        <button
          className={`m-paradigm-btn ${activeParadigm === 'api' ? 'm-active' : ''}`}
          onClick={() => setActiveParadigm('api')}
          title="API & Frontend Mocks"
        >
          <i className="fas fa-network-wired"></i> {isMobile ? '' : 'API & Frontend Mocks'}
        </button>
        <button
          className={`m-paradigm-btn ${activeParadigm === 'db' ? 'm-active' : ''}`}
          onClick={() => setActiveParadigm('db')}
          title="Database Seeding"
        >
          <i className="fas fa-database"></i> {isMobile ? '' : 'Database Seeding'}
        </button>
        <button
          className={`m-paradigm-btn ${activeParadigm === 'stream' ? 'm-active' : ''}`}
          onClick={() => setActiveParadigm('stream')}
          title="Streaming & Events"
        >
          <i className="fas fa-stream"></i> {isMobile ? '' : 'Streaming & Events'}
        </button>
      </div>

      <div className="m-paradigm-content">
        {activeParadigm === 'api' && (
          <ApiMocksTab onDataUpdate={setHeaderResultData} onShareStateChange={setShareState} />
        )}
        {activeParadigm === 'db' && (
          <DatabaseSeedingTab onDataUpdate={setHeaderResultData} />
        )}
        {activeParadigm === 'stream' && (
          <StreamingEventsTab onDataUpdate={setHeaderResultData} />
        )}
      </div>
    </div>
  );
}