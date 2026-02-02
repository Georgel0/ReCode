'use client';

import { useState } from 'react';
import Link from 'next/link';
import '@/styles/landingpage.css';

export default function LandingPage() {
  const [activeInfo, setActiveInfo] = useState(null);
  
  const tools = [
  {
    name: 'Code Converter',
    path: '/code-converter',
    icon: 'fas fa-rotate',
    desc: 'Translate logic across languages instantly.',
    info: 'Seamlessly migrate logic from one programming language to another while preserving functional intent. This tool handles complex syntactic differences—like turning Java class structures into concise Python scripts—making it ideal for legacy migrations or learning new frameworks.'
  },
  {
    name: 'Code Refactor',
    path: '/code-refactor',
    icon: 'fas fa-wand-magic-sparkles',
    desc: 'Clean, optimize, and modernize your snippets.',
    info: 'Transform "spaghetti code" into professional, readable source. The AI identifies redundant loops, simplifies nested conditionals, and implements modern best practices (like ES6+ syntax) to reduce technical debt and improve long-term maintainability.'
  },
  {
    name: 'Code Analysis',
    path: '/code-analysis',
    icon: 'fas fa-magnifying-glass-chart',
    desc: 'Deep-dive into complexity and security.',
    info: 'Perform a full health audit on your code. This tool provides a dashboard covering Big O time/space complexity, identifies security vulnerabilities like injection risks, and detects logical edge cases that could lead to runtime crashes.'
  },
  {
    name: 'Code Generator',
    path: '/code-generator',
    icon: 'fas fa-code',
    desc: 'Generate boilerplate from natural language.',
    info: 'Bridge the gap between thought and execution. Describe your requirements in plain English (e.g., "A React hook for debounced API calls") and receive fully functional, documented code snippets ready to be dropped into your project.'
  },
  {
    name: 'CSS Converter',
    path: '/css-frameworks',
    icon: 'fab fa-css3-alt',
    desc: 'Convert raw CSS to Tailwind or modern frameworks.',
    info: 'Modernize your styling workflow by translating raw CSS properties into utility classes for Tailwind CSS, or structured SCSS/Bootstrap components. It maps standard layout rules to framework-specific shorthand instantly.'
  },
  {
    name: 'SQL Builder',
    path: '/sql-builder',
    icon: 'fas fa-database',
    desc: 'Design complex queries with AI precision.',
    info: 'Construct complex database queries without memorizing exact syntax. Describe the data you need in natural language, and the AI generates optimized SQL including Joins, CTEs, and Unions for PostgreSQL, MySQL, and more.'
  },
  {
    name: 'Regex Generator',
    path: '/regex-generator',
    icon: 'fas fa-arrow-right-to-bracket',
    desc: 'Pattern matching made human-readable.',
    info: 'Regular expressions are notoriously difficult to write. Describe the pattern you want to match (e.g., "extract prices from a string") and receive the exact regex string along with a human-readable explanation of how the pattern works.'
  },
  {
    name: 'JSON Formatter',
    path: '/json-formatter',
    icon: 'fas fa-list-alt',
    desc: 'Fix and beautify messy data structures.',
    info: 'A utility for sanitizing data. Beyond simple indentation, this tool detects and fixes common syntax errors—like missing commas or unquoted keys—ensuring your JSON is valid and readable for APIs and config files.'
  }, ];
  
  return (
    <div className="lp-wrapper">
      <section className="lp-hero">
        <div className="lp-content animate-fade-in">
          <div className="lp-badge">AI-Powered Developer Suite</div>
          <h1 className="lp-title">
            Write better code. <br />
            <span className="text-blue">Faster than ever.</span>
          </h1>
          <p className="lp-description">
            ReCode is the ultimate playground for developers. 
            Convert, analyze, and optimize your source code using 
            state-of-the-art AI models tuned for logic and efficiency.
          </p>
          
          <Link href="/code-converter" className="lp-cta">
            Get Started — It&apos;s Free
            <i className="fa-solid fa-arrow-right"></i>
          </Link>
        </div>
      </section>

      <section className="lp-grid-section">
        <div className="lp-grid">
          {tools.map((tool, i) => (
          <div key={i} className="lp-card">
            <Link href={tool.path}>
              <div className="lp-card-icon"><i className={tool.icon}></i></div>
              <h3>{tool.name}</h3>
              <p>{tool.desc}</p>
            </Link>
            <button 
              className="info-trigger" 
              onClick={(e) => {
                e.preventDefault();
                setActiveInfo(tool);
              }} >
              <i className="fas fa-circle-info"></i>
            </button>
          </div>
        ))}
        </div>
      </section>

      <footer className="lp-footer">
        <div className="footer-line"></div>
        <div className="footer-content">
          <span>&copy; 2026 ReCode AI</span>
        </div>
      </footer>
      
      {activeInfo && (
      <div className="info-popup-overlay" onClick={() => setActiveInfo(null)}>
        <div className="info-popup-content" onClick={e => e.stopPropagation()}>
          <h4>{activeInfo.name}</h4>
          <p>{activeInfo.info}</p>
          <button onClick={() => setActiveInfo(null)}>Close</button>
          </div>
        </div>
      )}

    </div>
  );
}