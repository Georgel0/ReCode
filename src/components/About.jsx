import React from 'react';

export default function About() {
 return (
  <div className="about-sidebar-content">
      <section className="about-info-block">
        <h3 className="about-sub-title">AI Workflow</h3>
        <p className="about-description">
          ReCode utilizes the <strong>Grok API</strong> powered by <strong>Llama models</strong>. 
          When you submit code, it undergoes structural analysis to preserve logic and scoping during transformation.
        </p>
      </section>

      <section className="about-info-block">
        <h3 className="about-sub-title">Tech Stack</h3>
        <p className="about-description">
          Built with React 18, Firebase Firestore for real-time history, and hosted on Vercel's Edge Network for global speed.
        </p>
      </section>

      <section className="dev-contact-footer">
        <h3 className="contact-title">Developer Contact</h3>
        <div className="contact-icon-row">
          <a href="https://github.com/yourprofile" target="_blank" rel="noreferrer"><i className="fab fa-github"></i></a>
          <a href="https://linkedin.com/in/yourprofile" target="_blank" rel="noreferrer"><i className="fab fa-linkedin"></i></a>
          <a href="mailto:your@email.com"><i className="fas fa-envelope"></i></a>
        </div>
        <div className="source-link-wrapper">
           <a href="https://github.com/your-repo" target="_blank" rel="noreferrer" className="source-code-link">
             <i className="fas fa-code-branch"></i> View Source Code
           </a>
        </div>
      </section>
    </div>
 );
}