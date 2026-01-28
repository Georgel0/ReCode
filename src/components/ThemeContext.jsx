'use client'; 

import React, { createContext, useState, useEffect, useContext } from 'react';

const THEMES_DATA = [
  { id: 'dark-blue-gray', label: 'Default', group: 'Dark Themes' },
  { id: 'dark-black-gold', label: 'Black/Gold', group: 'Dark Themes' },
  { id: 'dark-deep-sea', label: 'Indigo', group: 'Dark Themes' },
  { id: 'light-default', label: 'Classic White', group: 'Light Themes' },
  { id: 'light-quartz', label: 'Quartz/Gold', group: 'Light Themes' },
  { id: 'light-mint-teal', label: 'Mint/Teal', group: 'Light Themes' },
];

const ThemeContext = createContext();

//Custom Hook for easy access to the theme context
export const useTheme = () => useContext(ThemeContext);

// Theme provider component
export const ThemeProvider = ({ children }) => {
 const [currentTheme, setCurrentTheme] = useState('dark-blue-gray');
 const [isInitialized, setIsInitialized] = useState(false);
 
 useEffect(() => {
  const savedTheme = localStorage.getItem('recode-theme');
  if (savedTheme && THEMES_DATA.some(t => t.id === savedTheme)) {
   setCurrentTheme(savedTheme);
  }
  setIsInitialized(true);
 }, []);
 
 const changeTheme = (themeId) => {
  setCurrentTheme(themeId);
  localStorage.setItem('recode-theme', themeId);
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
 
 if (!isInitialized) {
  return null;
 }
 
 return (
  <ThemeContext.Provider value={value}>
   {children}
  </ThemeContext.Provider>
 );
};