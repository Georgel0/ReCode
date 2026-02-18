'use client';

import { createContext, useContext, useState, useEffect } from 'react';

const AppContext = createContext();

export function AppProvider({ children }) {
  const [qualityMode, setQualityMode] = useState('fast');
  const [moduleData, setModuleData] = useState(null);
  
  useEffect(() => {
    localStorage.setItem('recode_quality_mode', qualityMode);
  }, [qualityMode]);
  
  useEffect(() => {
    const savedMode = localStorage.getItem('recode_quality_mode');
    if (savedMode) setQualityMode(savedMode);
  }, []);
  
  const toggleQualityMode = () => {
    setQualityMode(prev => {
      if (prev === 'turbo') return 'fast';
      if (prev === 'fast') return 'quality';
      return 'turbo';
    });
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