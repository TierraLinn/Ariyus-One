import React, { useState } from 'react';

const CheckoutScreen = ({ selectedTier = 'Ariyus Pro', price = '$9.99/mo', handleUpgrade, navigate }) => {
  const [cardNumber, setCardNumber] = useState('');
  const [cardName, setCardName] = useState('');
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardCvv, setCardCvv] = useState('');
  const [isFlipped, setIsFlipped] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  // Stripe 3D Secure Sandbox states
  const [is3dSecureOpen, setIs3dSecureOpen] = useState(false);
  const [smsCode, setSmsCode] = useState('');
  const [otpError, setOtpError] = useState('');

  const getCardBrand = (num) => {
    const clean = num.replace(/\s+/g, '');
    if (clean.startsWith('4')) return 'visa';
    if (clean.startsWith('5')) return 'mastercard';
    if (clean.startsWith('37') || clean.startsWith('34')) return 'amex';
    if (clean.startsWith('6')) return 'discover';
    return 'unknown';
  };
  const cardBrand = getCardBrand(cardNumber);

  const formatCardNumber = (value) => {
    const v = value.replace(/\s+/g, '').replace(/[^0-9]/gi, '');
    const matches = v.match(/\d{4,16}/g);
    const match = (matches && matches[0]) || '';
    const parts = [];

    for (let i = 0, len = match.length; i < len; i += 4) {
      parts.push(match.substring(i, i + 4));
    }

    if (parts.length > 0) {
      return parts.join(' ');
    } else {
      return v;
    }
  };

  const handleCardNumberChange = (e) => {
    setCardNumber(formatCardNumber(e.target.value));
  };

  const handleExpiryChange = (e) => {
    let clean = e.target.value.replace(/[^0-9]/g, '');
    if (clean.length > 2) {
      clean = clean.substring(0, 2) + '/' + clean.substring(2, 4);
    }
    setCardExpiry(clean.substring(0, 5));
  };

  const handleFormSubmit = (e) => {
    e.preventDefault();
    setIsProcessing(true);

    // Simulate elements credit validation, then open 3D Secure bank validation challenge
    setTimeout(() => {
      setIsProcessing(false);
      setIs3dSecureOpen(true);
    }, 1500);
  };

  const handleVerify3dSecure = (e) => {
    e.preventDefault();
    if (smsCode === '123456' || smsCode === '1234' || smsCode === '4242') {
      setIs3dSecureOpen(false);
      handleUpgrade(selectedTier);
    } else {
      setOtpError('Invalid authorization key. Use: "123456" to align.');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      
      {/* Header */}
      <div style={{ textAlign: 'center' }}>
        <h2 style={{ textShadow: '0 0 10px var(--primary-glow)', margin: 0 }}>Secure Upgrade Terminal</h2>
        <p style={{ color: 'var(--text-dim)', fontSize: '0.95rem', marginTop: '8px' }}>
          Upgrading to <b>{selectedTier}</b> for <b>{price}</b>
        </p>
      </div>

      {/* 3D Flipping Card Visual */}
      <div className="card-3d-wrapper">
        <div className={`card-3d ${isFlipped ? 'flipped' : ''}`} onClick={() => setIsFlipped(!isFlipped)}>
          
          {/* Card Front */}
          <div className="card-front">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.75rem', letterSpacing: '1px', textTransform: 'uppercase', opacity: 0.8 }}>
                {cardBrand === 'visa' && <b style={{ color: '#00f2ff', textShadow: '0 0 5px #00f2ff' }}>VISA</b>}
                {cardBrand === 'mastercard' && <b style={{ color: '#ffb700', textShadow: '0 0 5px #ffb700' }}>MASTERCARD</b>}
                {cardBrand === 'amex' && <b style={{ color: '#00ff87', textShadow: '0 0 5px #00ff87' }}>AMEX</b>}
                {cardBrand === 'discover' && <b style={{ color: '#ff00c1', textShadow: '0 0 5px #ff00c1' }}>DISCOVER</b>}
                {cardBrand === 'unknown' && 'Ariyus Card'}
              </span>
              <div className="card-chip" />
            </div>
            <div className="card-number">
              {cardNumber || '•••• •••• •••• ••••'}
            </div>
            <div className="card-name-expiry">
              <div>
                <div style={{ fontSize: '0.6rem', opacity: 0.7 }}>Cardholder</div>
                <div style={{ fontSize: '0.85rem' }}>{cardName || 'Aura Singer'}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '0.6rem', opacity: 0.7 }}>Expiry</div>
                <div style={{ fontSize: '0.85rem' }}>{cardExpiry || 'MM/YY'}</div>
              </div>
            </div>
          </div>

          {/* Card Back */}
          <div className="card-back">
            <div className="card-signature-line" />
            <div style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 10px' }}>
              <span style={{ fontSize: '0.55rem', opacity: 0.7 }}>AUTHORIZED SIGNATURE</span>
              <div className="card-cvv-box">{cardCvv || '•••'}</div>
            </div>
          </div>

        </div>
      </div>

      {/* Checkout Form */}
      <div className="glass-panel" style={{ maxWidth: '450px', margin: '0 auto' }}>
        <form onSubmit={handleFormSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          
          <div>
            <label style={{ fontSize: '0.8rem', color: 'var(--text-dim)' }}>Cardholder Name</label>
            <input 
              type="text" 
              placeholder="e.g. Aura Singer" 
              value={cardName} 
              onChange={e => setCardName(e.target.value)} 
              className="glass-input" 
              onFocus={() => setIsFlipped(false)}
              required 
            />
          </div>

          <div>
            <label style={{ fontSize: '0.8rem', color: 'var(--text-dim)' }}>Card Number</label>
            <input 
              type="text" 
              placeholder="4000 1234 5678 9010" 
              value={cardNumber} 
              onChange={handleCardNumberChange} 
              maxLength="19"
              className="glass-input" 
              onFocus={() => setIsFlipped(false)}
              required 
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
            <div>
              <label style={{ fontSize: '0.8rem', color: 'var(--text-dim)' }}>Expiration Date</label>
              <input 
                type="text" 
                placeholder="MM/YY" 
                value={cardExpiry} 
                onChange={handleExpiryChange} 
                maxLength="5"
                className="glass-input" 
                onFocus={() => setIsFlipped(false)}
                required 
              />
            </div>
            <div>
              <label style={{ fontSize: '0.8rem', color: 'var(--text-dim)' }}>Security Code (CVV)</label>
              <input 
                type="text" 
                placeholder="123" 
                value={cardCvv} 
                onChange={e => setCardCvv(e.target.value.replace(/[^0-9]/g, '').substring(0, 3))} 
                maxLength="3"
                className="glass-input" 
                onFocus={() => setIsFlipped(true)}
                onBlur={() => setIsFlipped(false)}
                required 
              />
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '15px' }}>
            <button type="submit" className="glowing-button" disabled={isProcessing}>
              {isProcessing ? 'Processing Transaction...' : `⚡ Authorize ${price}`}
            </button>
            <button type="button" className="glowing-button secondary" onClick={() => navigate('Upgrade')} disabled={isProcessing}>
              Cancel Checkout
            </button>
          </div>

        </form>
      </div>

      {/* Stripe 3D Secure modal simulator overlay */}
      {is3dSecureOpen && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, width: '100vw', height: '100vh',
          background: 'rgba(2, 0, 26, 0.9)',
          backdropFilter: 'blur(12px)',
          display: 'grid',
          placeItems: 'center',
          zIndex: 99999,
          padding: '20px'
        }}>
          <div className="glass-panel" style={{ maxWidth: '400px', width: '100%', borderColor: 'var(--secondary-glow)', textAlign: 'center', boxShadow: '0 0 30px rgba(255, 0, 193, 0.3)' }}>
            <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', alignItems: 'center', marginBottom: '15px' }}>
              <span style={{ fontSize: '1.5rem' }}>🔒</span>
              <h3 style={{ margin: 0, color: 'var(--secondary-glow)' }}>Stripe 3D Secure</h3>
            </div>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-dim)', lineHeight: '1.4' }}>
              A security verification challenge has been prompted by your bank. Enter the verification code sent to your registered device.
            </p>
            <div style={{ background: 'rgba(255,255,255,0.03)', padding: '10px', borderRadius: '8px', fontSize: '0.8rem', color: '#fff', margin: '15px 0', border: '1px solid rgba(255,255,255,0.05)' }}>
              <span>Merchant: <b>Ariyus-One sound Alignment</b></span><br/>
              <span>Amount: <b>{price}</b></span>
            </div>
            
            <form onSubmit={handleVerify3dSecure} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <input 
                  type="text" 
                  placeholder="Enter Code (use: 123456)" 
                  value={smsCode} 
                  onChange={e => { setSmsCode(e.target.value); setOtpError(''); }} 
                  className="glass-input" 
                  style={{ textAlign: 'center', fontSize: '1.2rem', letterSpacing: '4px', margin: 0 }}
                  required 
                />
                {otpError && (
                  <div style={{ color: '#ff3b30', fontSize: '0.75rem', marginTop: '6px' }}>{otpError}</div>
                )}
              </div>
              
              <div style={{ display: 'flex', gap: '10px', marginTop: '5px' }}>
                <button type="submit" className="glowing-button secondary" style={{ margin: 0, width: '100%' }}>
                  Verify & Upgrade
                </button>
                <button 
                  type="button" 
                  className="glowing-button" 
                  onClick={() => { setIs3dSecureOpen(false); setIsProcessing(false); }}
                  style={{ margin: 0, background: 'rgba(255,255,255,0.05)', borderColor: 'rgba(255,255,255,0.2)', color: '#fff', textShadow: 'none' }}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};

export default CheckoutScreen;
