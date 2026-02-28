'use client'; 

import { useState, useEffect } from 'react';

export function Notification({ message, duration = 3000, type = 'success' }) {
  const [isVisible, setIsVisible] = useState(false);
  const [text, setText] = useState('');

  useEffect(() => {
    if (message) {
      setText(message);
      setIsVisible(true);
      const timer = setTimeout(() => {
        setIsVisible(false);
      }, duration);
      
      // Cleanup function to clear timeout if the component unmounts or message changes
      return () => clearTimeout(timer);
    }
  }, [message, duration]);

  if (!isVisible && !text) return null;

  const style = {
    position: 'fixed',
    bottom: '20%',
    right: '10%',
    left: '10%',
    zIndex: 1000,
    padding: '12px 20px',
    borderRadius: '6px',
    backgroundColor: 'var(--bg-tertiary)',
    color: 'var(--text-primary)',
    border: `1px solid var(--accent)`,
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.4)',
    opacity: isVisible ? 1 : 0,
    transform: isVisible ? 'translateY(0)' : 'translateY(20px)',
    transition: 'opacity 0.3s ease-out, transform 0.3s ease-out',
    pointerEvents: 'none',
    display: 'flex',
    alignItems: 'center',
    gap: '10px'
  };

  const icon = type === 'success' ? '✅' : '🔔';

  return (
    <div style={style}>
      <span style={{ fontSize: '1.2em' }}>{icon}</span>
      {text}
    </div>
  );
}
