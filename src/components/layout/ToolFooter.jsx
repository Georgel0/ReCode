import React from 'react';
import '@/styles/ToolFooter.css';

export function ToolFooter({ content }) {
 if (!content) return null;
 
 return (
  <footer className="tool-footer">
   
   <section className="visible-intro">
    <h2>{content.heading}</h2>
    <p>{content.description}</p>
   </section>
   
   <div className="footer-content">
        
    <details className="seo-details">
     <summary>
      <h3><i className="fa-solid fa-list-check"></i> Key Features</h3>
      <span className="toggle-icon">▼</span>
     </summary>
     <div className="details-content">
      <div className="feature-grid">
       {content.features.map((feature, index) => (
        <div key={index} className="feature-card">
         <h4>{feature.title}</h4>
         <p>{feature.text}</p>
        </div>
       ))}
      </div>
     </div>
    </details>
   
    <details className="seo-details">
     <summary>
      <h3><i className="fa-solid fa-circle-question"></i> Frequently Asked Questions</h3>
      <span className="toggle-icon">▼</span>
     </summary>
     <div className="details-content">
      <dl className="faq-list">
       {content.faq.map((item, index) => (
        <div key={index} className="faq-item">
         <dt>{item.question}</dt>
         <dd>{item.answer}</dd>
        </div>
       ))}
      </dl>
     </div>
    </details>
    
   </div>
  </footer>
 );
}