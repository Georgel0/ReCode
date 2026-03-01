'use client';

import { useRouter } from 'next/navigation';
import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { ParticleBackground, ScrollAnimation } from '@/components/effects';
import { tools } from '@/lib/toolContent'
import '@/styles/landingpage.css';

export default function LandingPage() {
 const router = useRouter();
 const [activeInfo, setActiveInfo] = useState(null);
 const [lastModule, setLastModule] = useState("/code-converter");
 
 useEffect(() => {
  const saved = localStorage.getItem('recode_last_module');
  if (saved) setLastModule(saved);
 }, []);
 
 return (
  <div className="lp-wrapper">
      
   <ParticleBackground />
      
   <section className="lp-hero">
    <div className="lp-hero-content animate-fade-in">
     <div className="lp-badge">ReCode: Engineering Intelligence</div>
      <h1 className="lp-title">
       The Workbench for <br />
       <span className="text-blue">Modern Engineers.</span>
      </h1>
      <p className="lp-description">
       ReCode is a high-leverage development ecosystem designed to bridge the gap between complex logic and rapid deployment. Automate technical overhead and focus on high-level innovation.
      </p>
      <div className="hero-actions">
       <Link 
        href={lastModule}
        className="lp-cta">
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
         <p>Our specialized AI workflow utilizes a hybrid architecture. By processing code through an optimized Node.js microservice layer, ReCode performs deep-path  analysis and structured JSON synthesis.
         </p>
         <p>This ensures that every line of code generated is not just functional, but architecturally sound and production-ready.
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
        </div>
       </ScrollAnimation>
      </div>
     </div>
    </section>

    <section className="lp-section bg-alt">
     <div className="lp-container">
      <ScrollAnimation direction="up">
       <div className="section-header center">
        <h2 className="section-title">The Developer Suite</h2>
        <p className="section-desc">Modular utilities to accelerate your workflow without losing control.</p>
       </div>
      </ScrollAnimation>
          
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
          <p>ReCode leverages a modern stack featuring <strong>Next.js</strong> for performance, <strong> Firebase Firestore</strong> for real-time state synchronization, and global distribution via <strong>Vercel’s Edge Network</strong>.
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
     <div className="footer-grid">
      
      <div className="footer-brand">
       <h3>ReCode AI</h3>
       <p>Engineering better futures through intelligent automation.</p>
       <span className="copyright">&copy; 2026 ReCode AI</span>
      </div>

      <div className="footer-links">
       <div className="social-row">
        <a href="https://github.com/Georgel0" target="_blank" rel="noreferrer" title="GitHub">
         <i className="fab fa-github"></i>
        </a>
        <a href="https://www.linkedin.com/in/georgel-garabajiu-297a052a8" target="_blank" rel="noreferrer" title="LinkedIn">
         <i className="fab fa-linkedin"></i>
        </a>
        <a href="mailto:georgelgarabajiu07@gmail.com" title="Email">
         <i className="fas fa-envelope"></i>
        </a>
       </div>
        
       <a href="https://github.com/Georgel0/ReCode" target="_blank" rel="noreferrer" className="source-link">
        <i className="fas fa-code-branch"></i> View Source Code
       </a>
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