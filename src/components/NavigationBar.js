import React from 'react';
import '../styles/NavigationBar.css';

const NavigationBar = ({ onNavigate }) => {
  return (
    <nav className="navigation-bar">
      <button onClick={() => onNavigate('Welcome')}>Welcome</button>
      <button onClick={() => onNavigate('Home')}>Home</button>
      <button onClick={() => onNavigate('Sing')}>Sing</button>
      <button onClick={() => onNavigate('Resonance')}>Resonance Lab</button>
      <button onClick={() => onNavigate('Profile')}>Profile</button>
    </nav>
  );
};

export default NavigationBar;
