'use client';

import { useState, useRef, useEffect } from 'react';

export default function ScrollAnimation({ children, direction = 'up', delay = 0 }) {
 const [isVisible, setIsVisible] = useState(false);
 const domRef = useRef();
 
 useEffect(() => {
  const observer = new IntersectionObserver(entries => {
   entries.forEach(entry => {
    if (entry.isIntersecting) {
     setIsVisible(true);
     observer.unobserve(entry.target);
    }
   });
  });
  if (domRef.current) observer.observe(domRef.current);
  return () => observer.disconnect();
 }, []);
 
 const getTransform = () => {
  if (direction === 'left') return 'translateX(-50px)';
  if (direction === 'right') return 'translateX(50px)';
  return 'translateY(50px)';
 };
  
 return (
  <div
      ref={domRef}
      style={{
        opacity: isVisible ? 1 : 0,
        transform: isVisible ? 'translate(0)' : getTransform(),
        transition: `opacity 0.8s ease-out ${delay}ms, transform 0.8s ease-out ${delay}ms`,
      }}
    >
      {children}
    </div>
 );
}