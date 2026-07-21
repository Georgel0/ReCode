import React from 'react';
import { tools } from '@/lib';
import '@/styles/components/ToolFooter.css';

export function ToolFooter({ content }) {
  if (!content) return null;

  const otherTools = tools.filter(tool => tool.slug !== content.slug);

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
            <div className="faq-list">
              {content.faq.map((item, index) => (
                <div key={index} className="faq-item">
                  <h4>{item.question}</h4>
                  <p>{item.answer}</p>
                </div>
              ))}
            </div>
          </div>
        </details>

      </div>

      <section className="other-tools-section">
        <h3><i className="fa-solid fa-toolbox"></i> Explore Other Tools</h3>
        <div className="other-tools-grid">
          {otherTools.map((tool, index) => (
            <a key={index} href={tool.path} className="other-tool-link">
              <i className={tool.icon}></i>
              <span>{tool.name}</span>
            </a>
          ))}
        </div>
      </section>

    </footer>
  );
}