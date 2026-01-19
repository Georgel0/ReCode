import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles/index.css';
import App from './App.jsx';
import { ThemeProvider } from './components/ThemeContext';
import { HelmetProvider } from 'react-helmet-async';
import { SpeedInsights } from "@vercel/speed-insights/react";

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <HelmetProvider> 
      <ThemeProvider>
        <App />
        <SpeedInsights />
      </ThemeProvider>
    </HelmetProvider>
  </StrictMode>,
)