'use client';

import { createContext, useContext, useState, useEffect } from 'react';

const AppContext = createContext();

export function AppProvider({ children }) {
  const [qualityMode, setQualityMode] = useState('fast');
  const [moduleData, setModuleData] = useState(null);

  useEffect(() => {
    const savedMode = localStorage.getItem('recode_quality_mode');
    if (savedMode) setQualityMode(savedMode);
  }, []);

  const toggleQualityMode = () => {
    const newMode = qualityMode === 'fast' ? 'quality' : 'fast';
    setQualityMode(newMode);
    localStorage.setItem('recode_quality_mode', newMode);
  };

  return (
    <AppContext.Provider value={{ 
      qualityMode, 
      setQualityMode, 
      toggleQualityMode, 
      moduleData, 
      setModuleData 
    }}>
      {children}
    </AppContext.Provider>
  );
}

export const useApp = () => useContext(AppContext);
