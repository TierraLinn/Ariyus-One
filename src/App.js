import React, { useState, useEffect, useCallback } from 'react';
import './App.css';
import { auth, db } from './firebase'; // Firebase configuration
import { 
  createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged 
} from "firebase/auth";
import { 
  doc, setDoc, getDoc, updateDoc, serverTimestamp 
} from "firebase/firestore";

// Import Screens
import AuthPortal from './screens/AuthPortal';
import VocalCalibration from './screens/VocalCalibration';
import HomeNexus from './screens/Home';
import SongLibrary from './screens/Sing';
import UploadTrack from './screens/UploadTrack';
import RecordingStudio from './screens/Recording';
import ResultsChamber from './screens/Results';
import CommunityFeed from './screens/CommunityFeed';
import Competitions from './screens/Competitions';
import Profile from './screens/Profile';

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
  const [currentRecording, setCurrentRecording] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [customAlert, setCustomAlert] = useState(null);

  useEffect(() => {
    window.alert = (message) => {
      setCustomAlert(message);
    };
  }, []);

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
      const savedProfile = localStorage.getItem('ariyus_local_user');
      if (savedProfile) {
        const parsed = JSON.parse(savedProfile);
        setUser({ uid: parsed.uid, email: parsed.email });
        setUserData(parsed);
        if (!parsed.isCalibrated) {
          navigate('Onboarding');
        } else {
          navigate('Home');
        }
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
            setUserData({ uid: authUser.uid, ...data });
            if (!data.isCalibrated) {
              navigate('Onboarding');
            } else {
              navigate('Home');
            }
          } else {
            const freshProfile = {
              displayName: authUser.displayName || 'Aura Singer',
              email: authUser.email,
              tier: 'Free',
              xp: 120,
              voiceSignature: null,
              isCalibrated: false,
              createdAt: serverTimestamp()
            };
            await setDoc(userRef, freshProfile);
            setUserData({ uid: authUser.uid, ...freshProfile });
            navigate('Onboarding');
          }
          setUser(authUser);
        } catch (err) {
          console.error("Firestore user sync failed, falling back locally:", err);
          const fallback = {
            uid: authUser.uid,
            displayName: authUser.displayName || 'Aura Singer',
            email: authUser.email,
            tier: 'Free',
            xp: 120,
            voiceSignature: null,
            isCalibrated: false
          };
          setUserData(fallback);
          setUser(authUser);
          navigate('Onboarding');
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
      setTimeout(() => {
        const mockUid = 'local_' + Date.now();
        const profile = {
          uid: mockUid,
          displayName: displayName || 'Aura Singer',
          email: email,
          tier: 'Free',
          xp: 120,
          voiceSignature: null,
          isCalibrated: false
        };
        setUser({ uid: mockUid, email });
        setUserData(profile);
        localStorage.setItem('ariyus_local_user', JSON.stringify(profile));
        setIsLoading(false);
        navigate('Onboarding');
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
          isCalibrated: false,
          createdAt: serverTimestamp()
        };
        await setDoc(doc(db, "users", newUser.uid), freshProfile);
        setUserData({ uid: newUser.uid, ...freshProfile });
        navigate('Onboarding');
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
    } catch (err) {
      console.warn("Firebase Auth failed, falling back to local demo mode:", err.message);
      alert(`Firebase Connection Notice:\n\n"${err.message}"\n\nStarting app in Offline Local Mode instead so you can explore the features!`);

      const mockUid = 'local_fallback_' + Date.now();
      const profile = {
        uid: mockUid,
        displayName: displayName || email.split('@')[0] || 'Aura Singer',
        email: email,
        tier: 'Free',
        xp: 120,
        voiceSignature: null,
        isCalibrated: false
      };
      
      setUser({ uid: mockUid, email });
      setUserData(profile);
      localStorage.setItem('ariyus_local_user', JSON.stringify(profile));
      setIsLoading(false);
      navigate('Onboarding');
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

  const handleSaveAndShare = (recordingData) => {
    setIsLoading(true);
    const addedXp = 80;
    const updatedXp = (userData?.xp || 0) + addedXp;

    const updatedProfile = {
      ...userData,
      xp: updatedXp
    };

    setUserData(updatedProfile);
    const isLocalUser = !user || !user.uid || user.uid.startsWith('local_');
    if (!isFirebaseConfigured || isLocalUser) {
      localStorage.setItem('ariyus_local_user', JSON.stringify(updatedProfile));
    } else {
      try {
        const userRef = doc(db, "users", user.uid);
        updateDoc(userRef, { xp: updatedXp });
      } catch (err) {
        console.warn("Firestore share details failed to write:", err);
      }
    }

    const newRecordingItem = {
      id: 'rec_' + Date.now(),
      userDisplayName: userData?.displayName || 'Aura Singer',
      userId: user?.uid || 'guest',
      timestamp: 'Just now',
      song: recordingData.song,
      playbackUrl: recordingData.playbackUrl,
      score: recordingData.score,
      grade: recordingData.grade,
      likes: [],
      comments: []
    };

    const currentShared = localStorage.getItem('ariyus_shared_recordings');
    const sharedList = currentShared ? JSON.parse(currentShared) : [];
    localStorage.setItem('ariyus_shared_recordings', JSON.stringify([newRecordingItem, ...sharedList]));

    alert(`Performance matrix synced to feed! Gained +${addedXp} XP!`);
    setIsLoading(false);
    navigate('CommunityFeed');
  };

  const renderScreen = () => {
    const props = {
      navigate,
      user,
      userData,
      setUserData,
      currentRecording,
      setCurrentRecording,
      handleAuth,
      handleSignOut,
      handleSaveAndShare,
      setError,
      error,
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

    // Direct redirection logic for uncalibrated profiles
    if (userData && !userData.isCalibrated && screen !== 'Onboarding' && screen !== 'Auth') {
      return <VocalCalibration {...props} />;
    }

    switch (screen) {
      case 'Auth':
        return <AuthPortal {...props} />;
      case 'Onboarding':
        return <VocalCalibration {...props} />;
      case 'Home':
        return <HomeNexus {...props} />;
      case 'SongLibrary':
        return <SongLibrary {...props} />;
      case 'Upload':
        return <UploadTrack {...props} />;
      case 'Recording':
        return <RecordingStudio {...props} />;
      case 'Results':
        return <ResultsChamber {...props} />;
      case 'CommunityFeed':
        return <CommunityFeed {...props} />;
      case 'Competitions':
        return <Competitions {...props} />;
      case 'Profile':
        return <Profile {...props} />;
      default:
        return user ? (userData?.isCalibrated ? <HomeNexus {...props} /> : <VocalCalibration {...props} />) : <AuthPortal {...props} />;
    }
  };

  return (
    <div className="App">
      <LivingBackground />
      {renderScreen()}

      {/* Custom alert modal popup */}
      {customAlert && (
        <div className="custom-alert-overlay" onClick={() => setCustomAlert(null)}>
          <div className="custom-alert-box glass-panel" onClick={(e) => e.stopPropagation()}>
            <h3>Ariyus Notification</h3>
            <p>{customAlert}</p>
            <button onClick={() => setCustomAlert(null)} className="glowing-button" style={{ margin: '0 auto' }}>
              Acknowledge
            </button>
          </div>
        </div>
      )}

      {/* Floating Bottom Navigation Bar */}
      {userData && userData.isCalibrated && screen !== 'Auth' && screen !== 'Loading' && (
        <nav className="floating-nav">
          <button className={screen === 'Home' ? 'active' : ''} onClick={() => navigate('Home')}>Home</button>
          <button className={screen === 'SongLibrary' ? 'active' : ''} onClick={() => navigate('SongLibrary')}>Sing</button>
          <button className={screen === 'CommunityFeed' ? 'active' : ''} onClick={() => navigate('CommunityFeed')}>Feed</button>
          <button className={screen === 'Competitions' ? 'active' : ''} onClick={() => navigate('Competitions')}>Contests</button>
          <button className={screen === 'Profile' ? 'active' : ''} onClick={() => navigate('Profile')}>Profile</button>
        </nav>
      )}
      
      {userData && userData.isCalibrated && screen !== 'Auth' && screen !== 'Loading' && <div className="nav-bottom-buffer" />}
    </div>
  );
}

export default App;
