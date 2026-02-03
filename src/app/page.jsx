'use client';

import { useState, useEffect, useRef } from 'react';
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
    },
  ];

  return (
    <div className="lp-wrapper">
      
      <section className="lp-hero">
        <div className="lp-hero-content animate-fade-in">
          <div className="lp-badge">ReCode: Engineering Intelligence</div>
          <h1 className="lp-title">
            The Workbench for <br />
            <span className="text-blue">Modern Engineers.</span>
          </h1>
          <p className="lp-description">
            ReCode is a high-leverage development ecosystem designed to bridge the gap 
            between complex logic and rapid deployment. Automate technical overhead 
            and focus on high-level innovation.
          </p>
          <div className="hero-actions">
            <Link href="/code-converter" className="lp-cta">
              Get Started <i className="fa-solid fa-arrow-right"></i>
            </Link>
            <a href="#platform-video" className="lp-secondary-cta">
              <i className="fa-solid fa-play"></i> Watch Demo
            </a>
          </div>
        </div>
      </section>

      <section className="lp-section">
        <div className="lp-container">
          <div className="lp-split">
            <ScrollAnimation direction="left">
              <div className="lp-text-block">
                <h2 className="section-title">The Proprietary Engine</h2>
                <h3 className="section-subtitle">AI Architecture</h3>
                <p>
                  Our specialized AI workflow utilizes a hybrid architecture. By processing code 
                  through an optimized Node.js microservice layer, ReCode performs deep-path 
                  analysis and structured JSON synthesis.
                </p>
                <p>
                  This ensures that every line of code generated is not just functional, 
                  but architecturally sound and production-ready.
                </p>
              </div>
            </ScrollAnimation>
            
            <ScrollAnimation direction="right">
              <div className="lp-image-container">
               <img 
                src="/architecture.png" 
                alt="ReCode Hybrid Engine Architecture"
                className="lp-feature-img"
              />
              <div className="lp-image-overlay"></div>
              </div>
            </ScrollAnimation>
          </div>
        </div>
      </section>

      <section className="lp-section bg-alt">
        <div className="lp-container">
          <div className="section-header center">
            <h2 className="section-title">The Developer Suite</h2>
            <p className="section-desc">Modular utilities to accelerate your workflow without losing control.</p>
          </div>
          
          <div className="lp-grid">
            {tools.map((tool, i) => (
              <ScrollAnimation key={i} delay={i * 100}>
                <div className="lp-card">
                  <Link href={tool.path}>
                    <div className="card-header">
                      <div className="lp-card-icon"><i className={tool.icon}></i></div>
                      <button 
                        className="info-trigger" 
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setActiveInfo(tool);
                        }} 
                      >
                        <i className="fas fa-circle-info"></i>
                      </button>
                    </div>
                    <h3>{tool.name}</h3>
                    <p>{tool.desc}</p>
                  </Link>
                </div>
              </ScrollAnimation>
            ))}
          </div>
        </div>
      </section>

      <section className="lp-section">
        <div className="lp-container">
          <div className="lp-split reverse">
            <ScrollAnimation direction="right">
              <div className="lp-text-block">
                <h2 className="section-title">TechStack Infrastructure</h2>
                <h3 className="section-subtitle">Built for Speed & Reliability</h3>
                <p>
                  ReCode leverages a modern stack featuring <strong>Next.js</strong> for performance, 
                  <strong> Firebase Firestore</strong> for real-time state synchronization, and 
                  global distribution via <strong>Vercel’s Edge Network</strong>.
                </p>
                <ul className="feature-list">
                  <li><i className="fas fa-check"></i> Real-time History Sync</li>
                  <li><i className="fas fa-check"></i> Edge Caching</li>
                  <li><i className="fas fa-check"></i> 99.9% Uptime</li>
                </ul>
              </div>
            </ScrollAnimation>

            <ScrollAnimation direction="left">
              <div className="lp-image-container">
                <img 
                  src="/infrastructure.jpg" 
                  alt="ReCode Infrastructure Preview" 
                  className="lp-feature-img"
                />
                <div className="lp-image-overlay"></div>
              </div>
            </ScrollAnimation>
          </div>
        </div>
      </section>

      <section id="platform-video" className="lp-section video-section">
        <div className="lp-container">
          <ScrollAnimation direction="up">
            <div className="section-header center">
              <h2 className="section-title">Platform Overview</h2>
              <p className="section-desc">See how ReCode transforms your development velocity.</p>
            </div>
            <div className="video-wrapper">
              <iframe
                src="https://player.mux.com/gTlyythoN01D5QLRReHSOFTjttP7wVo3W7JJGBvQFztQ?metadata-video-title=ReCode+Platform+Overview"
                className="lp-video-iframe"
                allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture;"
                allowFullScreen
                title="ReCode Platform Overview"
              ></iframe>
            </div>
          </ScrollAnimation>
        </div>
      </section>

      <footer className="lp-footer">
        <div className="lp-container">
          <div className="footer-line"></div>
          <div className="footer-grid">
            <div className="footer-brand">
              <h3>ReCode AI</h3>
              <p>Engineering better futures through intelligent automation.</p>
              <div className="footer-links">
                <div className="social-row">
                  <a href="https://github.com/Georgel0" target="_blank" rel="noreferrer" title="GitHub"><i className="fab fa-github"></i></a>
                  <a href="https://www.linkedin.com/in/georgel-garabajiu-297a052a8" target="_blank" rel="noreferrer" title="LinkedIn"><i className="fab fa-linkedin"></i></a>
                  <a href="mailto:georgelgarabajiu07@gmail.com" title="Email"><i className="fas fa-envelope"></i></a>
                </div>
                <a href="https://github.com/Georgel0/ReCode" target="_blank" rel="noreferrer" className="source-link">
                  <i className="fas fa-code-branch"></i> View Source Code
                </a>
              </div>
              
              <span className="copyright">&copy; 2026 ReCode AI</span>
            </div>
          </div>
        </div>
      </footer>

      {activeInfo && (
        <div className="info-popup-overlay" onClick={() => setActiveInfo(null)}>
          <div className="info-popup-content" onClick={e => e.stopPropagation()}>
            <div className="popup-header">
              <h3><i className={activeInfo.icon}></i> {activeInfo.name}</h3>
              <button className="close-icon-btn" onClick={() => setActiveInfo(null)}>✕</button>
            </div>
            <p>{activeInfo.info}</p>
            <div className="popup-actions">
               <Link href={activeInfo.path} className="popup-cta">Launch Tool</Link>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

function ScrollAnimation({ children, direction = 'up', delay = 0 }) {
  const [isVisible, setIsVisible] = useState(false);
  const domRef = useRef();

  useEffect(() => {
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.unobserve(entry.target);
        }
      });
    });
    if (domRef.current) observer.observe(domRef.current);
    return () => observer.disconnect();
  }, []);

  const getTransform = () => {
    if (direction === 'left') return 'translateX(-50px)';
    if (direction === 'right') return 'translateX(50px)';
    return 'translateY(50px)';
  };

  return (
    <div
      ref={domRef}
      style={{
        opacity: isVisible ? 1 : 0,
        transform: isVisible ? 'translate(0)' : getTransform(),
        transition: `opacity 0.8s ease-out ${delay}ms, transform 0.8s ease-out ${delay}ms`,
      }}
    >
      {children}
    </div>
  );
}