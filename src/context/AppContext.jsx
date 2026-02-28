'use client';

import { createContext, useContext, useState, useEffect } from 'react';

const AppContext = createContext();

export function AppProvider({ children }) {
  const [moduleData, setModuleData] = useState(null);
  
  const [qualityMode, setQualityMode] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("recode_quality_mode") || "fast";
    }
    return "fast";
  });
  
  useEffect(() => {
    localStorage.setItem('recode_quality_mode', qualityMode);
  }, [qualityMode]);
  
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