'use client';

import Link from 'next/link';
import '@/styles/landingpage.css';

export default function LandingPage() {
  const tools = [
    { name: 'Code Converter', path: '/code-converter', icon: 'fas fa-rotate', desc: 'Translate logic across languages instantly.' },
    { name: 'Code Refactor', path: '/code-refactor', icon: 'fas fa-wand-magic-sparkles', desc: 'Clean, optimize, and modernize your snippets.' },
    { name: 'Code Analysis', path: '/code-analysis', icon: 'fas fa-magnifying-glass-chart', desc: 'Deep-dive into complexity and security.' },
    { name: 'Code Generator', path: '/code-generator', icon: 'fas fa-code', desc: 'Generate boilerplate from natural language.' },
    { name: 'CSS Converter', path: '/css-frameworks', icon: 'fab fa-css3-alt', desc: 'Convert raw CSS to Tailwind or modern frameworks.' },
    { name: 'SQL Builder', path: '/sql-builder', icon: 'fas fa-database', desc: 'Design complex queries with AI precision.' },
    { name: 'Regex Generator', path: '/regex-generator', icon: 'fas fa-arrow-right-to-bracket', desc: 'Pattern matching made human-readable.' },
    { name: 'JSON Formatter', path: '/json-formatter', icon: 'fas fa-file-alt', desc: 'Fix and beautify messy data structures.' },
  ];

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
            <Link href={tool.path} key={i} className="lp-card animate-slide-up" style={{ animationDelay: `${i * 0.1}s` }}>
              <div className="lp-card-icon">
                <i className={`${tool.icon}`}></i>
              </div>
              <h3>{tool.name}</h3>
              <p>{tool.desc}</p>
              <div className="lp-card-glow" />
            </Link>
          ))}
        </div>
      </section>

      <footer className="lp-footer">
        <div className="footer-line"></div>
        <div className="footer-content">
          <span>&copy; 2026 ReCode AI</span>
        </div>
      </footer>
    </div>
  );
}