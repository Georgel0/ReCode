'use client';

import React, { createContext, useState, useEffect, useContext } from 'react';

const THEMES_DATA = [
 { id: 'recode-dark', label: 'Space Gray', group: 'Dark Themes' },
 { id: 'midnight-gold', label: 'Luxury Black', group: 'Dark Themes' },
 { id: 'deep-sea', label: 'Oceanic', group: 'Dark Themes' },
 { id: 'classic-light', label: 'Snow White', group: 'Light Themes' },
 { id: 'quartz', label: 'Rose Gold', group: 'Light Themes' },
 { id: 'mint', label: 'Fresh Mint', group: 'Light Themes' },
];

const ThemeContext = createContext();

export const useTheme = () => useContext(ThemeContext);

export const ThemeProvider = ({ children }) => {
 const [currentTheme, setCurrentTheme] = useState('recode-dark');
 
 useEffect(() => {
  const savedTheme = localStorage.getItem('recode-theme');
  if (savedTheme) {
   setCurrentTheme(savedTheme);
   document.documentElement.setAttribute('data-theme', savedTheme);
  }
 }, []);
 
 const changeTheme = (themeId) => {
  setCurrentTheme(themeId);
  localStorage.setItem('recode-theme', themeId);
  document.documentElement.setAttribute('data-theme', themeId);
 };
 
 const groupedThemes = THEMES_DATA.reduce((acc, theme) => {
  if (!acc[theme.group]) {
   acc[theme.group] = [];
  }
  acc[theme.group].push(theme);
  return acc;
 }, {});
 
 const value = {
  currentTheme,
  changeTheme,
  themesData: THEMES_DATA,
  groupedThemes, // For sidebar component
 };
 
 return (
  <ThemeContext.Provider value={value}>
   {children}
  </ThemeContext.Provider>
 );
};