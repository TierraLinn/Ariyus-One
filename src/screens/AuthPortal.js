import React, { useState } from 'react';

const AuthPortal = ({ handleAuth, isLoading, error }) => {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    handleAuth(isSignUp, email, password, displayName);
  };

  const handleBypass = () => {
    // Triggers local-only mode bypass
    handleAuth(false, 'demo@ariyus.one', 'demopass', 'Aura Singer');
  };

  return (
    <div className="glass-panel cta-panel" style={{ margin: '2rem auto', animation: 'float-slight 8s infinite ease-in-out' }}>
      <h2 style={{ textShadow: '0 0 10px var(--secondary-glow)', color: '#fff', fontSize: '1.8rem', textAlign: 'center', marginBottom: '1.5rem' }}>
        {isSignUp ? 'Initialize Resonance Profile' : 'Ariyus One Nexus'}
      </h2>
      
      {error && (
        <div style={{ color: 'var(--secondary-glow)', background: 'rgba(255, 0, 193, 0.1)', border: '1px solid var(--secondary-glow)', padding: '10px', borderRadius: '8px', marginBottom: '15px', fontSize: '0.9rem', textAlign: 'center' }}>
          {error}
        </div>
      )}
      <p style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
        {isSignUp 
          ? 'Establish your vocal signature frequencies and join the collective.' 
          : 'Re-align your vocal matrix and sync with the acoustic grid.'}
      </p>
      
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {isSignUp && (
          <input 
            type="text" 
            placeholder="Vocal Name (Display Name)" 
            value={displayName} 
            onChange={e => setDisplayName(e.target.value)} 
            className="glass-input" 
            required 
          />
        )}
        <input 
          type="email" 
          placeholder="Spectral Email" 
          value={email} 
          onChange={e => setEmail(e.target.value)} 
          className="glass-input" 
          required 
        />
        <input 
          type="password" 
          placeholder="Access Key (Password)" 
          value={password} 
          onChange={e => setPassword(e.target.value)} 
          className="glass-input" 
          required 
        />
        
        <button type="submit" className="glowing-button" disabled={isLoading} style={{ marginTop: '15px' }}>
          {isLoading ? 'Aligning Frequencies...' : isSignUp ? 'Begin Journey' : 'Enter Portal'}
        </button>
      </form>

      <button className="link-button" onClick={() => setIsSignUp(!isSignUp)} style={{ textAlign: 'center', margin: '15px auto 0', display: 'block' }}>
        {isSignUp ? 'Already registered? Link Matrix' : 'New frequency node? Register Profile'}
      </button>

      <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', marginTop: '20px', paddingTop: '15px', textAlign: 'center' }}>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-dim)' }}>Testing offline or without Firebase enabled?</p>
        <button 
          type="button" 
          className="glowing-button secondary" 
          onClick={handleBypass} 
          style={{ padding: '8px 20px', fontSize: '0.8rem', marginTop: '10px' }}
        >
          Enter Demo Bypass Mode
        </button>
      </div>
    </div>
  );
};

export default AuthPortal;
