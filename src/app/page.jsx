'use client';

import { useRouter } from 'next/navigation';
import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { ParticleBackground, ScrollAnimation } from '@/components/effects';
import { tools, toolsContent } from '@/lib/toolContent';
import '@/styles/landingpage.css';

function ToolPopover({ tool }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  const content = toolsContent.find(t => t.slug === tool.path.replace('/', ''));

  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <div
      ref={ref}
      className={`tool-popover-anchor ${open ? 'is-open' : ''}`}
      onClick={(e) => { e.preventDefault(); setOpen(v => !v); }}
    >
      <i className="fas fa-circle-info tool-popover-trigger" />

      <div className="tool-popover">
        <div className="tool-popover__header">
          <i className={tool.icon} />
          <span>{tool.name}</span>
        </div>
        <div className="tool-popover__body">
          <p className="tool-popover__info">{tool.info}</p>
          {content?.features?.length > 0 && (
            <div className="tool-popover__features">
              {content.features.map((f, i) => (
                <span key={i} className="tool-popover__pill">
                  <i className="fas fa-check" />
                  {f.title}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function LandingPage() {
  const router = useRouter();
  const [activeInfo, setActiveInfo] = useState(null);
  const [lastModule, setLastModule] = useState("/code-converter");

  const [fullScreenImage, setFullScreenImage] = useState(null);
  const [activeSlide, setActiveSlide] = useState(0);
  const slideCount = 10;

  const slides = Array.from({ length: slideCount }, (_, i) => `/assets/preview-images/preview-${i + 1}.png`);

  const nextSlide = useCallback(() => {
    setActiveSlide((prev) => (prev + 1) % slideCount);
  }, []);

  const prevSlide = useCallback(() => {
    setActiveSlide((prev) => (prev - 1 + slideCount) % slideCount);
  }, []);

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
                  src="/assets/architecture.png"
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
            <div className="section-header lp center">
              <h2 className="section-title">The Developer Suite</h2>
              <p className="section-desc">Modular utilities to accelerate your workflow without losing control.</p>
            </div>
          </ScrollAnimation>

          <div className="lp-grid">
            {tools.map((tool, i) => (
              <ScrollAnimation key={i} delay={i * 80}>
                <div className="lp-card">
                  <Link href={tool.path}>
                    <div className="card-header">
                      <div className="lp-card-icon"><i className={tool.icon}></i></div>

                      <ToolPopover tool={tool} />

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
                  src="/assets/infrastructure.webp"
                  alt="ReCode Infrastructure Preview"
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
            <div className="section-header lp center">
              <h2 className="section-title">Platform Preview</h2>
              <p className="section-desc">Take a look around ReCode.</p>
            </div>
          </ScrollAnimation>

          <div className="carousel-wrapper">
            <button className="carousel-nav-btn left" onClick={prevSlide} aria-label="Previous image">
              <i className="fas fa-arrow-left"></i>
            </button>

            <div className="carousel-track">
              {slides.map((src, index) => {
                let positionClass = "hidden";

                if (index === activeSlide) positionClass = "active";
                else if (index === (activeSlide - 1 + slideCount) % slideCount) positionClass = "prev";
                else if (index === (activeSlide + 1) % slideCount) positionClass = "next";
                else if (index === (activeSlide - 2 + slideCount) % slideCount) positionClass = "hidden-left";
                else if (index === (activeSlide + 2) % slideCount) positionClass = "hidden-right";

                return (
                  <div
                    key={index}
                    className={`carousel-slide ${positionClass}`}
                    onClick={() => {
                      if (positionClass === 'prev') prevSlide();
                      if (positionClass === 'next') nextSlide();
                      if (positionClass === 'active') setFullScreenImage(src); // Trigger fullscreen
                    }}
                  >
                    <img src={src} alt={`App Interface Preview ${index + 1}`} />
                  </div>
                );
              })}
            </div>

            <button className="carousel-nav-btn right" onClick={nextSlide} aria-label="Next image">
              <i className="fas fa-arrow-right"></i>
            </button>
          </div>

          <div className="carousel-pagination">
            {slides.map((_, index) => (
              <button
                key={index}
                className={`dot ${index === activeSlide ? 'active' : ''}`}
                onClick={() => setActiveSlide(index)}
                aria-label={`Go to slide ${index + 1}`}
              />
            ))}
          </div>
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
                <a href="https://www.linkedin.com/in/georgel-garabajiu-297a052a8" target="_blank" rel="noreferrer" title="LinkedIn">
                  <i className="fab fa-linkedin"></i>
                </a>
                <a href="mailto:georgelgarabajiu07@gmail.com" title="Email">
                  <i className="fas fa-envelope"></i>
                </a>
              </div>
            </div>
          </div>
        </div>
      </footer>

      {fullScreenImage && (
        <div className="lp-modal-overlay" onClick={() => setFullScreenImage(null)}>
          <div className="lp-modal-content" onClick={(e) => e.stopPropagation()}>
            <button className="lp-modal-close" onClick={() => setFullScreenImage(null)}>
              <i className="fas fa-times"></i>
            </button>
            <img src={fullScreenImage} alt="Fullscreen View" />
          </div>
        </div>
      )}
    </div>
  );
}