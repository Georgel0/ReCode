'use client';

import React, { createContext, useState, useEffect, useContext, useMemo } from 'react';
import { THEMES, THEMES_LIST, DEFAULT_THEME } from '@/lib/themes';

const ThemeContext = createContext();

export const useTheme = () => useContext(ThemeContext);

export const ThemeProvider = ({ children }) => {
  const [currentTheme, setCurrentTheme] = useState(DEFAULT_THEME);

  const applyThemeAttributes = (themeId) => {
    const config = THEMES[themeId] || THEMES[DEFAULT_THEME];
    const resolvedId = THEMES[themeId] ? themeId : DEFAULT_THEME;
    const root = document.documentElement;

    root.setAttribute('data-theme', resolvedId);
    root.setAttribute('data-scheme', config.scheme);

    if (config.glint) {
      root.setAttribute('data-glint', 'true');
    } else {
      root.removeAttribute('data-glint');
    }
  };

  useEffect(() => {
    const savedTheme = localStorage.getItem('recode-theme') || DEFAULT_THEME;
    const validTheme = THEMES[savedTheme] ? savedTheme : DEFAULT_THEME;
    setCurrentTheme(validTheme);
    applyThemeAttributes(validTheme);
  }, []);

  const changeTheme = (themeId) => {
    if (!THEMES[themeId]) return;
    setCurrentTheme(themeId);
    localStorage.setItem('recode-theme', themeId);
    applyThemeAttributes(themeId);
  };

  const groupedThemes = useMemo(() => {
    return THEMES_LIST.reduce((acc, theme) => {
      if (!acc[theme.group]) acc[theme.group] = [];
      acc[theme.group].push(theme);
      return acc;
    }, {});
  }, []);

  const activeConfig = THEMES[currentTheme] || THEMES[DEFAULT_THEME];

  const value = {
    currentTheme,
    scheme: activeConfig.scheme, // 'dark' | 'light' -> use for `prism-${scheme}`
    changeTheme,
    themesData: THEMES_LIST,
    groupedThemes,
  };

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};