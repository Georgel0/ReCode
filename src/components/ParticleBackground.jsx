'use client';

import { useEffect, useRef } from 'react';

export default function ParticleBackground() {
 const canvasRef = useRef(null);
 const mouse = useRef({ x: null, y: null });
 const particles = useRef([]);
 const animationFrameId = useRef(null);
 
 useEffect(() => {
  const canvas = canvasRef.current;
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  
  // Configuration
  const particleCount = 100;
  const connectionDistance = 150;
  const mouseDistance = 150;
  
  class Particle {
   constructor() {
    this.init();
   }
   
   init() {
    this.x = Math.random() * canvas.width;
    this.y = Math.random() * canvas.height;
    this.vx = (Math.random() - 0.5) * 1.2;
    this.vy = (Math.random() - 0.5) * 1.2;
    this.size = Math.random() * 2 + 1;
   }
   
   update() {
    this.x += this.vx;
    this.y += this.vy;
    
    // Bounce off edges
    if (this.x < 0 || this.x > canvas.width) this.vx *= -1;
    if (this.y < 0 || this.y > canvas.height) this.vy *= -1;
    
    // Mouse interaction
    if (mouse.current.x !== null) {
     let dx = mouse.current.x - this.x;
     let dy = mouse.current.y - this.y;
     let dist = Math.sqrt(dx * dx + dy * dy);
     if (dist < mouseDistance) {
      this.x -= (dx / dist) * 2;
      this.y -= (dy / dist) * 2;
     }
    }
   }
   
   draw() {
    ctx.fillStyle = '#38bdf8';
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
    ctx.fill();
   }
  }
  
  const initParticles = () => {
   particles.current = [];
   for (let i = 0; i < particleCount; i++) {
    particles.current.push(new Particle());
   }
  };
  
  const resizeCanvas = () => {
   canvas.width = window.innerWidth;
   canvas.height = window.innerHeight;
   initParticles();
  };
  
  const animate = () => {
   // Clear the canvas
   ctx.clearRect(0, 0, canvas.width, canvas.height);
   
   const pArray = particles.current;
   for (let i = 0; i < pArray.length; i++) {
    pArray[i].update();
    pArray[i].draw();
    
    // Draw connections
    for (let j = i + 1; j < pArray.length; j++) {
     let dx = pArray[i].x - pArray[j].x;
     let dy = pArray[i].y - pArray[j].y;
     let dist = Math.sqrt(dx * dx + dy * dy);
     
     if (dist < connectionDistance) {
      ctx.strokeStyle = `rgba(56, 189, 248, ${1 - dist / connectionDistance})`;
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.moveTo(pArray[i].x, pArray[i].y);
      ctx.lineTo(pArray[j].x, pArray[j].y);
      ctx.stroke();
     }
    }
   }
   animationFrameId.current = requestAnimationFrame(animate);
  };
  
  // Event Listeners
  const handleMouseMove = (e) => {
   mouse.current.x = e.clientX;
   mouse.current.y = e.clientY;
  };
  
  const handleMouseOut = () => {
   mouse.current.x = null;
   mouse.current.y = null;
  };
  
  window.addEventListener('resize', resizeCanvas);
  window.addEventListener('mousemove', handleMouseMove);
  window.addEventListener('mouseout', handleMouseOut);
  
  // Start
  resizeCanvas();
  animate();
  
  // Cleanup
  return () => {
   window.removeEventListener('resize', resizeCanvas);
   window.removeEventListener('mousemove', handleMouseMove);
   window.removeEventListener('mouseout', handleMouseOut);
   cancelAnimationFrame(animationFrameId.current);
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