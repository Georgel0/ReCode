import React from 'react';

export default function About() {
 return (
  <div className="about-sidebar-content">
    
      <section className="about-info-block">
        <h3 className="about-sub-title">General</h3>
        <p className="about-description">
          ReCode was built with the purpose to be an universal tool, increase the overall productivity, help developers to stay focused and write better and faster code.
        </p>
      </section>
      
      <section className="about-info-block">
        <h3 className="about-sub-title">AI Workflow</h3>
        <p className="about-description">
          ReCode utilizes the <strong>Grok API</strong> powered by <strong>Llama models</strong>. 
          When you use a tool, the code is sent to the AI in a JSON format, it does the work then sends it back in a JSON format, then we structure the response so you can work with it easily. All done via a backend server built with Node.js.
        </p>
      </section>

      <section className="about-info-block">
        <h3 className="about-sub-title">Tech Stack</h3>
        <p className="about-description">
          Built with React + Vite, Node.js, Firebase Firestore for real-time history, and hosted on Vercel's Edge Network for global speed.
        </p>
      </section>

      <section className="about-info-block">
        <h3 className="about-sub-title">Video Introduction</h3>
        <div className="video-container">
          <iframe
            src="https://player.mux.com/gTlyythoN01D5QLRReHSOFTjttP7wVo3W7JJGBvQFztQ?metadata-video-title=ReCode+Video+Introduction&video-title=ReCode+Video+Introduction"
            className="about-video-iframe"
            allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture;"
            allowFullScreen
            title="ReCode Video Introduction"
          ></iframe>
        </div>
      </section>

      <section className="dev-contact-footer">
        <h3 className="contact-title">Developer Info/Contact</h3>
        <div className="contact-icon-row">
          <a href="https://github.com/Georgel0" target="_blank" rel="noreferrer"><i className="fab fa-github"></i></a>
          <a href="https://www.linkedin.com/in/georgel-garabajiu-297a052a8" target="_blank" rel="noreferrer"><i className="fab fa-linkedin"></i></a>
          <a href="mailto:georgelgarabajiu07@gmail.com"><i className="fas fa-envelope"></i></a>
        </div>
        <div className="source-link-wrapper">
           <a href="https://github.com/Georgel0/ReCode" target="_blank" rel="noreferrer" className="source-code-link">
             <i className="fas fa-code-branch"></i> View Source Code
           </a>
        </div>
      </section>
    </div>
 );
}