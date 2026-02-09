import React from 'react';

export default function ToolFooter({ content }) {
 if (!content) return null;
 
 return (
  <footer className="tool-footer">
   <div className="footer-content">
        
   <section className="visible-intro">
    <h2>{content.heading}</h2>
    <p>{content.description}</p>
   </section>
        
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

      <style jsx>{`
        .tool-footer {
          margin-top: 4rem;
          padding-top: 2rem;
          border-top: 1px solid var(--border-color, #333);
          color: var(--text-secondary, #ccc);
        }
        .footer-content {
          max-width: 800px;
          margin: 0 auto;
        }
        .visible-intro h2 {
          color: var(--text-primary, #fff);
          font-size: 1.5rem;
          margin-bottom: 1rem;
        }
        
        .seo-details {
          margin-top: 1.5rem;
          border-bottom: 1px solid #333;
          padding-bottom: 1rem;
        }
        
        summary {
          cursor: pointer;
          list-style: none;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 10px 0;
          font-weight: 600;
          color: var(--text-primary, #fff);
        }
        
        summary::-webkit-details-marker {
          display: none;
        }

        summary h3 {
          display: inline-flex;
          align-items: center;
          gap: 10px;
          margin: 0;
          font-size: 1.1rem;
        }

        .details-content {
          margin-top: 1rem;
          animation: fadeIn 0.3s ease-in-out;
        }

        .feature-grid {
          display: grid;
          gap: 1rem;
        }
        .feature-card h4 {
          color: var(--accent, #007bff);
          margin-bottom: 0.25rem;
        }
        
        .faq-item {
          margin-bottom: 1.5rem;
        }
        .faq-item dt {
          color: var(--text-primary, #fff);
          font-weight: bold;
          margin-bottom: 0.5rem;
        }

        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(-5px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </footer>
 );
}