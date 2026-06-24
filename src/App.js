import React, { useState, useEffect, useCallback } from 'react';
import './App.css';
import { auth, db } from './firebase'; // Firebase configuration
import { 
  createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged 
} from "firebase/auth";
import { 
  doc, setDoc, getDoc, updateDoc, serverTimestamp 
} from "firebase/firestore";



// Import Modular Screens
import AuthPortal from './screens/AuthPortal';
import HomeNexus from './screens/Home';
import SongLibrary from './screens/Sing';
import RecordingStudio from './screens/Recording';
import ResultsChamber from './screens/Results';
import FrequencyLab from './screens/ResonanceLab';
import Profile from './screens/Profile';
import CommunityFeed from './screens/CommunityFeed';
import CreatorDashboard from './screens/CreatorDashboard';
import UpgradeScreen from './screens/Shop';
import CheckoutScreen from './screens/CheckoutScreen';
import WorkstationScreen from './screens/Workstation';

// Helper to check if Firebase is configured with real credentials
const isFirebaseConfigured = auth && auth.app && auth.app.options && auth.app.options.apiKey && auth.app.options.apiKey !== "YOUR_API_KEY";


// Cosmic Background Particles Component
const LivingBackground = React.memo(() => {
  return (
    <div className="living-background">
      {[...Array(40)].map((_, i) => {
        const xOffset = -150 + Math.random() * 300;
        const delay = Math.random() * 15;
        const duration = 12 + Math.random() * 10;
        return (
          <div 
            key={i} 
            className="particle" 
            style={{ 
              left: `${Math.random() * 100}%`,
              animationDelay: `${delay}s`,
              animationDuration: `${duration}s`,
              '--x-offset': `${xOffset}px`
            }} 
          />
        );
      })}
    </div>
  );
});

function App() {
  const [screen, setScreen] = useState('Loading');
  const [screenProps, setScreenProps] = useState({});
  const [user, setUser] = useState(null); // Firebase auth user
  const [userData, setUserData] = useState(null); // Ariyus profile data (XP, level, tier)
  
  const [activeChallenge, setActiveChallenge] = useState(() => {
    return localStorage.getItem('ariyus_active_challenge') || null;
  });

  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('ariyus_cosmic_theme') || 'Andromeda Teal';
  });

  useEffect(() => {
    const root = document.documentElement;
    localStorage.setItem('ariyus_cosmic_theme', theme);
    if (theme === 'Supernova Amber') {
      root.style.setProperty('--primary-glow', '#ffb700');
      root.style.setProperty('--secondary-glow', '#ff3b30');
      root.style.setProperty('--tertiary-glow', '#9e00ff');
      root.style.setProperty('--glass-border', 'rgba(255, 183, 0, 0.25)');
    } else if (theme === 'Hypergiant Emerald') {
      root.style.setProperty('--primary-glow', '#00ff87');
      root.style.setProperty('--secondary-glow', '#7000ff');
      root.style.setProperty('--tertiary-glow', '#00f2ff');
      root.style.setProperty('--glass-border', 'rgba(0, 255, 135, 0.25)');
    } else {
      root.style.setProperty('--primary-glow', '#00f2ff');
      root.style.setProperty('--secondary-glow', '#ff00c1');
      root.style.setProperty('--tertiary-glow', '#7000ff');
      root.style.setProperty('--glass-border', 'rgba(0, 242, 255, 0.25)');
    }
  }, [theme]);
  
  const [currentRecording, setCurrentRecording] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const navigate = useCallback((s, props = {}) => { 
    window.scrollTo(0, 0); 
    setError(null); 
    setScreen(s); 
    setScreenProps(props); 
  }, []);

  // --- Initialize Authentication Node ---
  useEffect(() => {
    if (!isFirebaseConfigured) {
      console.warn("Firebase not configured. Launching local-only mock engine.");
      // Check if there is an existing local profile saved
      const savedProfile = localStorage.getItem('ariyus_local_user');
      if (savedProfile) {
        const parsed = JSON.parse(savedProfile);
        setUser({ uid: parsed.uid, email: parsed.email });
        setUserData(parsed);
        navigate('Home');
      } else {
        setUser(null);
        setUserData(null);
        navigate('Auth');
      }
      setIsLoading(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, async (authUser) => {
      if (authUser) {
        try {
          const userRef = doc(db, "users", authUser.uid);
          const userSnap = await getDoc(userRef);
          if (userSnap.exists()) {
            const data = userSnap.data();
            setUserData({ uid: authUser.uid, completedChallenges: [], ...data });
          } else {
            // Write defaults
            const freshProfile = {
              displayName: authUser.displayName || 'Aura Singer',
              email: authUser.email,
              tier: 'Free',
              xp: 120,
              voiceSignature: null,
              completedChallenges: [],
              createdAt: serverTimestamp()
            };
            await setDoc(userRef, freshProfile);
            setUserData({ uid: authUser.uid, ...freshProfile });
          }
          setUser(authUser);
          navigate('Home');
        } catch (err) {
          console.error("Firestore user sync failed, falling back locally:", err);
          // Firestore sync blocked (e.g. security rules or offline)
          const fallback = {
            uid: authUser.uid,
            displayName: authUser.displayName || 'Aura Singer',
            email: authUser.email,
            tier: 'Free',
            xp: 120,
            voiceSignature: null,
            completedChallenges: []
          };
          setUserData(fallback);
          setUser(authUser);
          navigate('Home');
        }
        setIsLoading(false);
      } else {
        setUser(null);
        setUserData(null);
        setIsLoading(false);
        navigate('Auth');
      }
    });

    return () => unsubscribe();
  }, [navigate]);

  // --- Unified Authentication Handler ---
  const handleAuth = async (isSignUp, email, password, displayName) => {
    setIsLoading(true);
    setError(null);

    if (!isFirebaseConfigured) {
      // Local Authentication Flow
      setTimeout(() => {
        const mockUid = 'local_' + Date.now();
        const profile = {
          uid: mockUid,
          displayName: displayName || 'Aura Singer',
          email: email,
          tier: 'Free',
          xp: 120,
          voiceSignature: null,
          completedChallenges: []
        };
        setUser({ uid: mockUid, email });
        setUserData(profile);
        localStorage.setItem('ariyus_local_user', JSON.stringify(profile));
        setIsLoading(false);
        navigate('Home');
      }, 1000);
      return;
    }

    try {
      if (isSignUp) {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const newUser = userCredential.user;
        const freshProfile = {
          displayName: displayName || 'Aura Singer',
          email,
          tier: 'Free',
          xp: 120,
          voiceSignature: null,
          completedChallenges: [],
          createdAt: serverTimestamp()
        };
        await setDoc(doc(db, "users", newUser.uid), freshProfile);
        setUserData({ uid: newUser.uid, ...freshProfile });
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
    } catch (err) {
      console.warn("Firebase Auth failed, falling back to local demo mode:", err.message);
      
      // Alert user about Firebase state, but fall back gracefully
      alert(`Firebase Connection Notice:\n\n"${err.message}"\n\nStarting app in Offline Local Mode instead so you can explore the features!`);

      const mockUid = 'local_fallback_' + Date.now();
      const profile = {
        uid: mockUid,
        displayName: displayName || email.split('@')[0] || 'Aura Singer',
        email: email,
        tier: 'Free',
        xp: 120,
        voiceSignature: null
      };
      
      setUser({ uid: mockUid, email });
      setUserData(profile);
      localStorage.setItem('ariyus_local_user', JSON.stringify(profile));
      setIsLoading(false);
      navigate('Home');
    }
  };

  const handleSignOut = async () => {
    if (isFirebaseConfigured) {
      await signOut(auth);
    } else {
      localStorage.removeItem('ariyus_local_user');
      setUser(null);
      setUserData(null);
      navigate('Auth');
    }
  };

  // --- Journey Leveling & Sharing Engine ---
  const saveAndShare = async (recordingData) => {
    setIsLoading(true);
    const addedXp = 80; // Award 80 XP for sharing a recording
    const updatedXp = (userData?.xp || 0) + addedXp;

    const updatedProfile = {
      ...userData,
      xp: updatedXp,
      voiceSignature: recordingData.voiceSignature // Link new voice signature
    };

    // Save locally
    setUserData(updatedProfile);
    if (!isFirebaseConfigured) {
      localStorage.setItem('ariyus_local_user', JSON.stringify(updatedProfile));
    }

    // Add new recording item
    const newRecordingItem = {
      id: 'rec_' + Date.now(),
      userDisplayName: userData?.displayName || 'Aura Singer',
      userId: user?.uid || 'guest',
      timestamp: 'Just now',
      song: recordingData.song,
      playbackUrl: currentRecording?.playbackUrl || '',
      ariyusRating: recordingData.ariyusRating,
      selectedFreq: recordingData.selectedFreq,
      effects: recordingData.effects,
      likes: [],
      comments: []
    };

    // Persist to local social list
    const currentShared = localStorage.getItem('ariyus_shared_recordings');
    const sharedList = currentShared ? JSON.parse(currentShared) : [];
    localStorage.setItem('ariyus_shared_recordings', JSON.stringify([newRecordingItem, ...sharedList]));

    if (isFirebaseConfigured && user) {
      try {
        // Update user XP in Firestore
        const userRef = doc(db, "users", user.uid);
        await updateDoc(userRef, {
          xp: updatedXp,
          voiceSignature: recordingData.voiceSignature
        });
        // We could also upload the file to Firebase Storage if files are active,
        // but local blob URLs function beautifully for testing local state.
      } catch (err) {
        console.warn("Firestore share details failed to write, saved locally:", err);
      }
    }

    alert(`Performance matrix synced to feed! Gained +${addedXp} XP!`);
    setIsLoading(false);
    navigate('CommunityFeed');
  };

  // --- Membership Pricing Upgrade Terminal ---
  const handleUpgrade = async (tier) => {
    setIsLoading(true);
    const updatedProfile = {
      ...userData,
      tier
    };

    setUserData(updatedProfile);
    if (!isFirebaseConfigured) {
      localStorage.setItem('ariyus_local_user', JSON.stringify(updatedProfile));
    } else if (user) {
      try {
        const userRef = doc(db, "users", user.uid);
        await updateDoc(userRef, { tier });
      } catch (err) {
        console.warn("Firestore upgrade fail, applied locally:", err);
      }
    }

    alert(`Resonance matrix upgraded to ${tier} successfully!`);
    setIsLoading(false);
    navigate('Home');
  };

  // --- Challenge Actions Engine ---
  const handleAcceptChallenge = (challengeId) => {
    setActiveChallenge(challengeId);
    localStorage.setItem('ariyus_active_challenge', challengeId);
    alert(`Challenge accepted! Head to the Studio or Resonance Lab to calibrate.`);
    navigate('SongLibrary');
  };

  const handleCompleteChallenge = async (challengeId, xpReward) => {
    setIsLoading(true);
    const currentCompleted = userData?.completedChallenges || [];
    if (currentCompleted.includes(challengeId)) {
      setIsLoading(false);
      return;
    }

    const updatedCompleted = [...currentCompleted, challengeId];
    const updatedXp = (userData?.xp || 0) + xpReward;
    const updatedProfile = {
      ...userData,
      xp: updatedXp,
      completedChallenges: updatedCompleted
    };

    setUserData(updatedProfile);
    if (!isFirebaseConfigured) {
      localStorage.setItem('ariyus_local_user', JSON.stringify(updatedProfile));
    } else if (user) {
      try {
        const userRef = doc(db, "users", user.uid);
        await updateDoc(userRef, {
          xp: updatedXp,
          completedChallenges: updatedCompleted
        });
      } catch (e) {
        console.warn("Could not sync completed challenge to Firestore:", e);
      }
    }

    setActiveChallenge(null);
    localStorage.removeItem('ariyus_active_challenge');
    setIsLoading(false);
  };

  // --- Screens Router ---
  const renderScreen = () => {
    const props = {
      navigate,
      user,
      userData,
      currentRecording,
      setCurrentRecording,
      handleAuth,
      handleSignOut,
      saveAndShare,
      handleUpgrade,
      activeChallenge,
      handleAcceptChallenge,
      handleCompleteChallenge,
      setError,
      error,
      theme,
      setTheme,
      ...screenProps
    };

    if (isLoading) {
      return (
        <div className="screen-wrapper" style={{ display: 'grid', placeItems: 'center' }}>
          <div className="glass-panel" style={{ textAlign: 'center', maxWidth: '400px' }}>
            <h2 style={{ textShadow: '0 0 10px var(--primary-glow)' }}>Ariyus Link</h2>
            <p>Syncing acoustic resonance matrix...</p>
          </div>
        </div>
      );
    }

    if (error && screen === 'Auth') {
      // Inline auth error message display
      return <AuthPortal {...props} isLoading={false} />;
    }

    switch (screen) {
      case 'Auth':
        return <AuthPortal {...props} />;
      case 'Home':
        return <HomeNexus {...props} />;
      case 'SongLibrary':
        return <SongLibrary {...props} />;
      case 'Recording':
        return <RecordingStudio {...props} />;
      case 'Results':
        return <ResultsChamber {...props} />;
      case 'CollaborationLobby': // Maps to Resonance Frequency Lab
        return <FrequencyLab {...props} />;
      case 'CommunityFeed':
        return <CommunityFeed {...props} />;
      case 'Profile':
        return <Profile {...props} />;
      case 'CreatorDashboard':
        return <CreatorDashboard {...props} />;
      case 'Upgrade':
        return <UpgradeScreen {...props} />;
      case 'Checkout':
        return <CheckoutScreen {...props} />;
      case 'Workstation':
        return <WorkstationScreen {...props} />;
      default:
        return user ? <HomeNexus {...props} /> : <AuthPortal {...props} />;
    }
  };

  return (
    <div className="App">
      <LivingBackground />
      {renderScreen()}

      {/* Floating Bottom Navigation Bar */}
      {userData && screen !== 'Auth' && screen !== 'Loading' && (
        <nav className="floating-nav">
          <button className={screen === 'Home' ? 'active' : ''} onClick={() => navigate('Home')}>Home</button>
          <button className={screen === 'SongLibrary' ? 'active' : ''} onClick={() => navigate('SongLibrary')}>Sing</button>
          <button className={screen === 'CollaborationLobby' ? 'active' : ''} onClick={() => navigate('CollaborationLobby')}>Lab</button>
          <button className={screen === 'CommunityFeed' ? 'active' : ''} onClick={() => navigate('CommunityFeed')}>Feed</button>
          <button className={screen === 'Profile' ? 'active' : ''} onClick={() => navigate('Profile')}>Profile</button>
          <button className={screen === 'Workstation' ? 'active' : ''} onClick={() => navigate('Workstation')}>DAW</button>
          {userData.tier === 'Creator' && (
            <button className={screen === 'CreatorDashboard' ? 'active' : ''} onClick={() => navigate('CreatorDashboard')}>Dashboard</button>
          )}
        </nav>
      )}
      
      {/* Nav buffer to avoid overlap */}
      {userData && screen !== 'Auth' && screen !== 'Loading' && <div className="nav-bottom-buffer" />}
    </div>
  );
}

export default App;
