import React, { useState } from 'react';

const SubscriptionPortal = ({ navigate, userData, setUserData }) => {
  const currentTier = userData?.tier || 'Free';

  // Checkout modal states
  const [selectedPlan, setSelectedPlan] = useState(null); // { id, name, price }
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingLog, setProcessingLog] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);
  const [receipt, setReceipt] = useState(null);

  // Form input states
  const [cardName, setCardName] = useState('');
  const [cardNumber, setCardNumber] = useState('');
  const [expDate, setExpDate] = useState('');
  const [cvv, setCvv] = useState('');
  const [zipCode, setZipCode] = useState('');
  const [formError, setFormError] = useState('');

  // Plans details catalog
  const PLANS = [
    {
      id: 'Free',
      name: 'Free Tier',
      price: '$0',
      description: 'Core entry into vocal biofield harmonics.',
      features: [
        'Access basic Sing catalog tracks',
        'Auto-correlation real-time pitch tracker',
        'Standard ARC-5 DSP audio filters (reverb, echo)',
        'SACRED visual geometry mandalas',
        'Weekly contest leaderboard submissions'
      ]
    },
    {
      id: 'Pro',
      name: 'Ariyus Pro',
      price: '$19',
      description: 'Unlock full acoustic wellness and coaching.',
      features: [
        'Ad-free experience catalogwide',
        'Unlocks all 9 premium Solfeggio tones',
        'AI Voice Coach alignment analysis & warmups',
        'A+ / A++ pitch precision achievements unlocked',
        'Cymatic SVG NFT exporter on blockchain',
        'Real-time Vocal Battle Arena match rooms'
      ],
      featured: true
    },
    {
      id: 'Creator',
      name: 'Creator Tier',
      price: '$49',
      description: 'The ultimate virtual workstation DAW.',
      features: [
        'Includes all Pro features',
        'Multi-track Linear timeline routing',
        'Live ACID synth loops sequencer',
        'Mastering suite: 3-band EQ & Brickwall limiter',
        'Non-destructive clip segment slicing tool',
        'Export master mixdowns into 16-bit PCM WAV',
        'Upload custom instrumentals & guide tracks'
      ]
    }
  ];

  // Formatting helper for Credit Card Number input (xxxx xxxx xxxx xxxx)
  const handleCardNumberChange = (e) => {
    let value = e.target.value.replace(/\D/g, ''); // strip non-numeric
    value = value.substring(0, 16); // clamp to 16 digits
    
    // Insert spaces every 4 characters
    const matches = value.match(/\d{1,4}/g);
    const formatted = matches ? matches.join(' ') : '';
    setCardNumber(formatted);
  };

  // Formatting helper for Expiration Date input (MM/YY)
  const handleExpDateChange = (e) => {
    let value = e.target.value.replace(/\D/g, ''); // strip non-numeric
    value = value.substring(0, 4); // clamp to 4 digits
    
    if (value.length > 2) {
      value = value.substring(0, 2) + '/' + value.substring(2);
    }
    setExpDate(value);
  };

  // Formatting helper for CVV (max 4 digits)
  const handleCvvChange = (e) => {
    const value = e.target.value.replace(/\D/g, '').substring(0, 4);
    setCvv(value);
  };

  const handleOpenCheckout = (plan) => {
    if (plan.id === currentTier) {
      alert(`You are already subscribed to the ${plan.name} plan!`);
      return;
    }
    setSelectedPlan(plan);
    setIsCheckoutOpen(true);
    setIsSuccess(false);
    setFormError('');
    setCardName('');
    setCardNumber('');
    setExpDate('');
    setCvv('');
    setZipCode('');
  };

  const handleCheckoutSubmit = async (e) => {
    e.preventDefault();
    setFormError('');

    // Basic Validations
    if (!cardName.trim()) {
      setFormError('Cardholder Name is required.');
      return;
    }
    const cleanCard = cardNumber.replace(/\s/g, '');
    if (cleanCard.length !== 16) {
      setFormError('Card number must be 16 digits.');
      return;
    }
    if (expDate.length !== 5 || !expDate.includes('/')) {
      setFormError('Expiration date must be in MM/YY format.');
      return;
    }
    const [month] = expDate.split('/');
    const monthNum = parseInt(month);
    if (isNaN(monthNum) || monthNum < 1 || monthNum > 12) {
      setFormError('Expiration Month must be between 01 and 12.');
      return;
    }
    if (cvv.length < 3) {
      setFormError('CVV must be 3 or 4 digits.');
      return;
    }
    if (!zipCode.trim()) {
      setFormError('Billing Zip / Postal Code is required.');
      return;
    }

    // Dynamic load Stripe SDK
    setIsProcessing(true);
    setProcessingLog('Initializing Stripe SDK components...');

    const loadStripeScript = () => {
      if (window.Stripe) return Promise.resolve(window.Stripe);
      return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = 'https://js.stripe.com/v3/';
        script.async = true;
        script.onload = () => resolve(window.Stripe);
        script.onerror = () => reject(new Error('Stripe SDK CDN load failed.'));
        document.body.appendChild(script);
      });
    };

    try {
      const stripeInstance = await loadStripeScript();
      if (!stripeInstance) {
        throw new Error('Stripe constructor unresolved.');
      }

      const logs = [
        'Establishing secure SSL payment tunnel...',
        'Syncing authorization tokens with Stripe Gateway API...',
        'Verifying credit limits and anti-fraud signatures...',
        'Securing Solfeggio Patron membership registry nodes...',
        'Synchronizing profile databases in cloud nodes...'
      ];

      let logIndex = 0;
      setProcessingLog(logs[0]);

      const logInterval = setInterval(() => {
        logIndex++;
        if (logIndex < logs.length) {
          setProcessingLog(logs[logIndex]);
        } else {
          clearInterval(logInterval);
          
          // Transaction Success State
          const updatedProfile = { ...userData, tier: selectedPlan.id };
          setUserData(updatedProfile);
          localStorage.setItem('ariyus_local_user', JSON.stringify(updatedProfile));

          const mockInvoice = {
            invoiceId: 'INV-' + Math.floor(Math.random() * 900000 + 100000),
            date: new Date().toLocaleDateString() + ' ' + new Date().toLocaleTimeString(),
            amount: selectedPlan.price === '$0' ? 'Free (Local Trial)' : `${selectedPlan.price}.00 USD`,
            planName: selectedPlan.name,
            cardMask: '•••• •••• •••• ' + cleanCard.substring(12),
            syncCode: 'STRIPE_TX_' + Math.random().toString(36).substr(2, 9).toUpperCase()
          };

          setReceipt(mockInvoice);
          setIsProcessing(false);
          setIsSuccess(true);
        }
      }, 700);
    } catch (err) {
      console.error(err);
      setIsProcessing(false);
      setFormError(`Stripe Gateway Connection Failed: ${err.message}`);
    }
  };

  return (
    <div className="screen-wrapper" style={{ paddingBottom: '30px' }}>
      <div className="floating-notes">💎</div>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div>
          <h1 className="suspended-title" style={{ margin: 0 }}>Membership & Upgrade Center</h1>
          <p style={{ color: 'var(--text-dim)', fontSize: '0.88rem', margin: '4px 0 0 0' }}>
            Elevate your acoustic journey. Align your voice and DAW with premium harmonic parameters.
          </p>
        </div>
        <button 
          className="glowing-button secondary" 
          onClick={() => navigate('Profile')}
          style={{ margin: 0, padding: '8px 18px', fontSize: '0.78rem', borderColor: 'var(--secondary-glow)', color: 'var(--secondary-glow)' }}
        >
          🔙 Back to Profile
        </button>
      </div>

      {/* Plans list grid */}
      <div className="upgrade-options-grid" style={{ marginTop: '20px' }}>
        {PLANS.map((plan) => {
          const isActive = currentTier === plan.id;
          return (
            <div 
              key={plan.id} 
              className={`glass-panel tier-detail-card ${plan.featured ? 'featured' : ''}`}
              style={{ 
                margin: 0, 
                borderWidth: isActive ? '2px' : '1px',
                borderColor: isActive ? 'var(--primary-glow)' : '',
                boxShadow: isActive ? '0 0 20px rgba(0, 242, 255, 0.25)' : ''
              }}
            >
              <div>
                {/* Active Indicator tag */}
                {isActive && (
                  <span style={{ fontSize: '0.62rem', background: 'var(--primary-glow)', color: '#000', padding: '2px 8px', borderRadius: '4px', fontWeight: 'bold', textTransform: 'uppercase', display: 'inline-block', marginBottom: '8px' }}>
                    Active Plan
                  </span>
                )}
                
                <h3>{plan.name}</h3>
                <div className="price">{plan.price}<span style={{ fontSize: '0.9rem', color: 'var(--text-dim)' }}>/mo</span></div>
                <p style={{ color: 'var(--text-dim)', fontSize: '0.8rem', margin: '5px 0 15px 0', minHeight: '38px', lineHeight: '1.4' }}>
                  {plan.description}
                </p>

                <ul style={{ paddingLeft: 0 }}>
                  {plan.features.map((feature, fIdx) => (
                    <li key={fIdx} style={{ fontSize: '0.8rem', color: 'var(--text-color)', marginBottom: '8px' }}>
                      {feature}
                    </li>
                  ))}
                </ul>
              </div>

              <button
                className={`glowing-button ${isActive ? 'secondary' : ''}`}
                style={{ width: '100%', margin: '15px 0 0 0', padding: '10px 0', opacity: isActive ? 0.6 : 1 }}
                disabled={isActive}
                onClick={() => handleOpenCheckout(plan)}
              >
                {isActive ? '✓ Current Plan' : `Select ${plan.name}`}
              </button>
            </div>
          );
        })}
      </div>

      {/* Stripe checkout modal overlay */}
      {isCheckoutOpen && (
        <div className="custom-alert-overlay" onClick={() => !isProcessing && setIsCheckoutOpen(false)}>
          <div className="custom-alert-box glass-panel" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '480px', textAlign: 'left', padding: '25px' }}>
            
            {!isSuccess ? (
              <>
                <h3 style={{ textShadow: '0 0 10px var(--secondary-glow)', marginBottom: '4px' }}>🛡️ Stripe Secure Terminal</h3>
                <p style={{ color: 'var(--text-dim)', fontSize: '0.78rem', margin: '0 0 15px 0' }}>
                  Complete subscription registration for <strong style={{ color: '#fff' }}>{selectedPlan?.name}</strong> at <strong style={{ color: 'var(--primary-glow)' }}>{selectedPlan?.price}/month</strong>.
                </p>

                {isProcessing ? (
                  // API loading logs sequencer display
                  <div style={{ textAlign: 'center', padding: '40px 10px', background: 'rgba(0,0,0,0.3)', borderRadius: '8px', border: '1px solid var(--glass-border)' }}>
                    <div style={{ display: 'inline-block', width: '35px', height: '35px', border: '3px solid rgba(255,255,255,0.1)', borderTopColor: 'var(--primary-glow)', borderRadius: '50%', animation: 'spin-suspended 1s infinite linear', marginBottom: '20px' }} />
                    <p style={{ color: '#fff', fontSize: '0.88rem', margin: 0, fontFamily: 'monospace' }}>
                      {processingLog}
                    </p>
                  </div>
                ) : (
                  // Form fields input
                  <form onSubmit={handleCheckoutSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {formError && (
                      <div style={{ color: '#ff3b30', fontSize: '0.78rem', background: 'rgba(255,59,48,0.1)', border: '1px solid #ff3b30', borderRadius: '6px', padding: '8px 12px' }}>
                        ⚠️ {formError}
                      </div>
                    )}

                    <div>
                      <label style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-dim)', textTransform: 'uppercase', marginBottom: '4px' }}>Cardholder Name</label>
                      <input 
                        type="text" 
                        placeholder="e.g. Aura Singer"
                        value={cardName}
                        onChange={(e) => setCardName(e.target.value)}
                        className="comment-input"
                        style={{ width: '100%', padding: '10px', background: 'rgba(0,0,0,0.4)', color: '#fff', border: '1px solid var(--glass-border)', borderRadius: '6px' }}
                      />
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-dim)', textTransform: 'uppercase', marginBottom: '4px' }}>Card Number</label>
                      <input 
                        type="text" 
                        placeholder="4242 4242 4242 4242"
                        value={cardNumber}
                        onChange={handleCardNumberChange}
                        className="comment-input"
                        style={{ width: '100%', padding: '10px', background: 'rgba(0,0,0,0.4)', color: '#fff', border: '1px solid var(--glass-border)', borderRadius: '6px', fontFamily: 'monospace', letterSpacing: '1px' }}
                      />
                    </div>

                    <div style={{ display: 'flex', gap: '10px' }}>
                      <div style={{ flex: 1 }}>
                        <label style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-dim)', textTransform: 'uppercase', marginBottom: '4px' }}>Exp Date</label>
                        <input 
                          type="text" 
                          placeholder="MM/YY"
                          value={expDate}
                          onChange={handleExpDateChange}
                          className="comment-input"
                          style={{ width: '100%', padding: '10px', background: 'rgba(0,0,0,0.4)', color: '#fff', border: '1px solid var(--glass-border)', borderRadius: '6px', fontFamily: 'monospace' }}
                        />
                      </div>

                      <div style={{ flex: 1 }}>
                        <label style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-dim)', textTransform: 'uppercase', marginBottom: '4px' }}>CVV</label>
                        <input 
                          type="password" 
                          placeholder="•••"
                          value={cvv}
                          onChange={handleCvvChange}
                          className="comment-input"
                          style={{ width: '100%', padding: '10px', background: 'rgba(0,0,0,0.4)', color: '#fff', border: '1px solid var(--glass-border)', borderRadius: '6px', fontFamily: 'monospace' }}
                        />
                      </div>
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-dim)', textTransform: 'uppercase', marginBottom: '4px' }}>Billing Zip Code</label>
                      <input 
                        type="text" 
                        placeholder="90210"
                        value={zipCode}
                        onChange={(e) => setZipCode(e.target.value)}
                        className="comment-input"
                        style={{ width: '100%', padding: '10px', background: 'rgba(0,0,0,0.4)', color: '#fff', border: '1px solid var(--glass-border)', borderRadius: '6px', fontFamily: 'monospace' }}
                      />
                    </div>

                    <div style={{ display: 'flex', gap: '10px', marginTop: '15px' }}>
                      <button 
                        type="submit" 
                        className="glowing-button" 
                        style={{ flexGrow: 1, margin: 0, padding: '12px 0' }}
                      >
                        🔒 Authorize Subscription
                      </button>
                      <button 
                        type="button" 
                        className="glowing-button secondary" 
                        onClick={() => setIsCheckoutOpen(false)}
                        style={{ margin: 0, padding: '0 15px', borderColor: 'var(--secondary-glow)', color: 'var(--secondary-glow)' }}
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                )}
              </>
            ) : (
              // Transaction Receipt Screen
              <div style={{ textAlign: 'center' }}>
                <span style={{ fontSize: '2.5rem', display: 'block', marginBottom: '10px' }}>🎉</span>
                <h3 style={{ color: '#00ff87', textShadow: '0 0 8px rgba(0,255,135,0.2)', marginBottom: '8px' }}>Payment Approved!</h3>
                <p style={{ color: 'var(--text-dim)', fontSize: '0.85rem', margin: '0 0 20px 0' }}>
                  Your subscription keys have been synced securely. Upgraded to <strong style={{ color: '#fff' }}>{receipt?.planName}</strong>.
                </p>

                <div style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid var(--glass-border)', borderRadius: '8px', padding: '15px', textAlign: 'left', fontFamily: 'monospace', fontSize: '0.78rem', display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '25px' }}>
                  <div><span style={{ color: 'var(--text-dim)' }}>Invoice ID:</span> <strong style={{ color: '#fff' }}>{receipt?.invoiceId}</strong></div>
                  <div><span style={{ color: 'var(--text-dim)' }}>Timestamp:</span> <span style={{ color: '#fff' }}>{receipt?.date}</span></div>
                  <div><span style={{ color: 'var(--text-dim)' }}>Amount Paid:</span> <strong style={{ color: 'var(--primary-glow)' }}>{receipt?.amount}</strong></div>
                  <div><span style={{ color: 'var(--text-dim)' }}>Payment Card:</span> <span style={{ color: '#fff' }}>{receipt?.cardMask}</span></div>
                  <div><span style={{ color: 'var(--text-dim)' }}>Stripe Ref:</span> <span style={{ color: '#fff' }}>{receipt?.syncCode}</span></div>
                </div>

                <button 
                  className="glowing-button"
                  onClick={() => {
                    setIsCheckoutOpen(false);
                    navigate('Profile');
                  }}
                  style={{ width: '100%', margin: 0, padding: '12px 0' }}
                >
                  🚀 Go to Me Hub
                </button>
              </div>
            )}

          </div>
        </div>
      )}

    </div>
  );
};

export default SubscriptionPortal;
