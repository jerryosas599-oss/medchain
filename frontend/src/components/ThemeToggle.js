import React from 'react';

export default function ThemeToggle({ theme, setTheme }) {
  const toggle = () => setTheme(theme === 'light' ? 'dark' : 'light');
  return (
    <button 
      onClick={toggle} 
      title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
      style={{
        background: 'var(--card)',
        border: '1px solid rgba(0,0,0,0.1)',
        color: 'var(--text)',
        cursor: 'pointer',
        fontSize: 16,
        padding: '8px 12px',
        borderRadius: 'var(--radius-md)',
        display: 'flex',
        alignItems: 'center',
        transition: 'all 300ms cubic-bezier(0.4, 0, 0.2, 1)',
        transform: 'scale(1)',
      }}
      onMouseEnter={(e) => e.target.style.transform = 'scale(1.08) rotate(20deg)'}
      onMouseLeave={(e) => e.target.style.transform = 'scale(1) rotate(0deg)'}
    >
      {theme === 'light' ? '🌙' : '☀️'}
    </button>
  );
}
