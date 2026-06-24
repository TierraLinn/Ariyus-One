import React from 'react';

const WelcomeScreen = ({ onNavigate }) => {
  return (
    <div>
      <h1>Welcome</h1>
      <button onClick={() => onNavigate('Home')}>Sign In</button>
      <button onClick={() => onNavigate('Home')}>Create Account</button>
    </div>
  );
};

export default WelcomeScreen;
