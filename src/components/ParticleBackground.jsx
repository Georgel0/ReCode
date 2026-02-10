'use client';

import { useEffect, useRef } from 'react';

export default function ParticleBackground() {
 const canvasRef = useRef(null);
 const mouse = useRef({ x: null, y: null });
 const particles = useRef([]);
 const animationFrameId = useRef(null);
 const resizeTimeout = useRef(null);
 
 useEffect(() => {
  const canvas = canvasRef.current;
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  
  const PARTICLE_DENSITY_AREA = 15000;
  const MIN_PARTICLES = 40;
  const MAX_PARTICLES = 180;
  
  let particleCount = 100;
  let connectionDistance = 200;
  let connectionDistanceSq = connectionDistance * connectionDistance;
  
  let speedFactor = 1.0;
  const mouseDistance = 150;
  const lineOpacityFactor = 0.5;
  
  class Particle {
   constructor(width, height) {
    this.x = Math.random() * width;
    this.y = Math.random() * height;
    this.vx = (Math.random() - 0.5) * speedFactor;
    this.vy = (Math.random() - 0.5) * speedFactor;
    this.size = Math.random() * 2 + 1;
   }
   
   update(width, height) {
    this.x += this.vx;
    this.y += this.vy;
    
    // Bounce off edges
    if (this.x < 0 || this.x > width) this.vx *= -1;
    if (this.y < 0 || this.y > height) this.vy *= -1;
    
    // Mouse interaction
    if (mouse.current.x !== null) {
     const dx = mouse.current.x - this.x;
     const dy = mouse.current.y - this.y;
     const distSq = dx * dx + dy * dy;
     
     if (distSq < mouseDistance * mouseDistance) {
      const dist = Math.sqrt(distSq);
      if (dist > 0) { 
       const force = (mouseDistance - dist) / mouseDistance;
       const moveX = (dx / dist) * force * 2;
       const moveY = (dy / dist) * force * 2;
       this.x -= moveX;
       this.y -= moveY;
      }
     }
    }
   }
   
   draw() {
    ctx.fillStyle = 'rgba(56, 189, 248, 0.5)';
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
    ctx.fill();
   }
  }
  
  const initParticles = (width, height) => {
   particles.current = [];
   for (let i = 0; i < particleCount; i++) {
    particles.current.push(new Particle(width, height));
   }
  };
  
  const handleResize = () => {
   // Get Device Pixel Ratio (DPI)
   const dpr = window.devicePixelRatio || 1;
   
   // Set actual size in memory (scaled to account for extra pixel density)
   canvas.width = window.innerWidth * dpr;
   canvas.height = window.innerHeight * dpr;
   
   // Normalize coordinate system to use CSS pixels
   ctx.scale(dpr, dpr);
   
   // Calculate Logic Width/Height (CSS Pixels)
   const width = window.innerWidth;
   const height = window.innerHeight;
   
   // Smart Particle Count based on Screen Area
   const area = width * height;
   const calculatedParticles = Math.floor(area / PARTICLE_DENSITY_AREA);
   
   // Clamp particle count between reasonable min and max
   particleCount = Math.min(Math.max(calculatedParticles, MIN_PARTICLES), MAX_PARTICLES);
   
   if (width < 768) {
    connectionDistance = 80;
    speedFactor = 0.5;
   } else {
    connectionDistance = 150;
    speedFactor = 1.0;
   }
   
   connectionDistanceSq = connectionDistance * connectionDistance;
   
   // Re-init particles with new bounds
   initParticles(width, height);
  };
  
  const animate = () => {
   const width = window.innerWidth;
   const height = window.innerHeight;
   
   ctx.clearRect(0, 0, width, height);
   
   const pArray = particles.current;
   const len = pArray.length;
   
   for (let i = 0; i < len; i++) {
    const p1 = pArray[i];
    p1.update(width, height);
    p1.draw();
    
    // Only look at particles "ahead" in the array to avoid double checking pairs
    for (let j = i + 1; j < len; j++) {
     const p2 = pArray[j];
     const dx = p1.x - p2.x;
     const dy = p1.y - p2.y;
     
     const distSq = dx * dx + dy * dy;
     
     if (distSq < connectionDistanceSq) {
      // Only calculate actual root if we are drawing the line
      const dist = Math.sqrt(distSq);
      const opacity = (1 - dist / connectionDistance) * lineOpacityFactor;
      
      ctx.strokeStyle = `rgba(56, 189, 248, ${opacity})`;
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.stroke();
     }
    }
   }
   animationFrameId.current = requestAnimationFrame(animate);
  };
  
  const handleMouseMove = (e) => {
   mouse.current.x = e.clientX;
   mouse.current.y = e.clientY;
  };
  
  const handleMouseOut = () => {
   mouse.current.x = null;
   mouse.current.y = null;
  };
  
  const onResize = () => {
   clearTimeout(resizeTimeout.current);
   resizeTimeout.current = setTimeout(handleResize, 100);
  };
  
  window.addEventListener('resize', onResize);
  window.addEventListener('mousemove', handleMouseMove);
  window.addEventListener('mouseout', handleMouseOut);
  
  handleResize();
  animate();
  
  return () => {
   window.removeEventListener('resize', onResize);
   window.removeEventListener('mousemove', handleMouseMove);
   window.removeEventListener('mouseout', handleMouseOut);
   cancelAnimationFrame(animationFrameId.current);
   clearTimeout(resizeTimeout.current);
  };
 }, []);
 
 return (
  <canvas
   ref={canvasRef}
   style={{
    position: 'fixed',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    zIndex: 0,
    background: '#000000', 
    pointerEvents: 'none',
   }}
  />
 );
}