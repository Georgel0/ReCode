'use client'; 

import React from 'react';

export default function About() {
  return (
    <div className="about-sidebar-content">
    
      <section className="about-info-block">
        <h2 className="about-main-title">ReCode: Engineering Intelligence</h2>
        <p className="about-description">
          ReCode is a high-leverage development ecosystem designed to bridge the gap between complex logic and rapid deployment. By automating the technical overhead of refactoring, analysis, and architecture, we empower developers to focus on high-level innovation rather than syntax.
        </p>
      </section>
      
      <section className="about-info-block">
        <h3 className="about-sub-title">The Proprietary Engine</h3>
        <p className="about-description">
          Our specialized AI workflow utilizes the <strong>Grok-Llama and mistral hybrid architecture</strong>. By processing code through an optimized Node.js microservice layer, ReCode performs deep-path analysis and structured JSON synthesis. This ensures that every line of code generated is not just functional, but architecturally sound and production-ready.
        </p>
      </section>

      <section className="about-info-block">
        <h3 className="about-sub-title">Enterprise Infrastructure</h3>
        <p className="about-description">
          Built for speed and reliability, ReCode leverages a modern stack featuring <strong>Next.js</strong> for performance, <strong>Firebase Firestore</strong> for real-time state synchronization, and global distribution via <strong>Vercel’s Edge Network</strong>.
        </p>
      </section>

      <section className="about-info-block">
        <h3 className="about-sub-title">Platform Overview</h3>
        <div className="video-container">
          <iframe
            src="https://player.mux.com/gTlyythoN01D5QLRReHSOFTjttP7wVo3W7JJGBvQFztQ?metadata-video-title=ReCode+Platform+Overview"
            className="about-video-iframe"
            allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture;"
            allowFullScreen
            title="ReCode Platform Overview"
          ></iframe>
        </div>
      </section>

      <section className="dev-contact-footer">
        <h3 className="contact-title">Connect with the developer</h3>
        <p className="about-description small">Available for strategic partnerships and custom enterprise implementations.</p>
        <div className="contact-icon-row">
          <a href="https://github.com/Georgel0" target="_blank" rel="noreferrer" title="GitHub"><i className="fab fa-github"></i></a>
          <a href="https://www.linkedin.com/in/georgel-garabajiu-297a052a8" target="_blank" rel="noreferrer" title="LinkedIn"><i className="fab fa-linkedin"></i></a>
          <a href="mailto:georgelgarabajiu07@gmail.com" title="Email"><i className="fas fa-envelope"></i></a>
        </div>
        <div className="source-link-wrapper">
           <a href="https://github.com/Georgel0/ReCode" target="_blank" rel="noreferrer" className="source-code-link">
             <i className="fas fa-code-branch"></i> Explore Documentation & Source
           </a>
        </div>
      </section>
    </div>
  );
}