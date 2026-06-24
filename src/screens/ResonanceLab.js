import React, { useState, useEffect, useRef } from 'react';
import { db, auth } from '../firebase';
import { 
  collection, doc, addDoc, getDoc, updateDoc, 
  onSnapshot, query, serverTimestamp, deleteDoc 
} from 'firebase/firestore';

// Helper: check if Firebase is configured with real credentials
const isFirebaseConfigured = db && auth && auth.app && auth.app.options && auth.app.options.apiKey && auth.app.options.apiKey !== "YOUR_API_KEY";

const FrequencyLab = ({ navigate, user, userData }) => {
  const [selectedHz, setSelectedHz] = useState(528);
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(25);

  // Sound Generator Web Audio Refs
  const audioCtxRef = useRef(null);
  const oscRef = useRef(null);
  const gainNodeRef = useRef(null);

  // Vocal Scanner States
  const [isScanning, setIsScanning] = useState(false);
  const [scannedPitch, setScannedPitch] = useState(0);
  const [matchedHz, setMatchedHz] = useState(null);
  const [matchPercent, setMatchPercent] = useState(0);

  // Vocal Scanner Web Audio Refs
  const scanCtxRef = useRef(null);
  const scanStreamRef = useRef(null);
  const scanAnalyserRef = useRef(null);
  const scanCanvasRef = useRef(null);
  const scanAnimFrameRef = useRef(null);

  // --- MULTIPLAYER LOBBY STATES ---
  const [activeRoomId, setActiveRoomId] = useState(null);
  const [rooms, setRooms] = useState([]);
  const [roomNameInput, setRoomNameInput] = useState('');
  const [roomMembers, setRoomMembers] = useState([]);
  const [groupCoherence, setGroupCoherence] = useState(70);
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [isHost, setIsHost] = useState(false);

  const chatEndRef = useRef(null);
  const mandalaCanvasRef = useRef(null);

  const solfeggioFrequencies = [
    { hz: 396, title: 'UT - Liberating Guilt & Fear', desc: 'Acoustic keys to release deep sub-conscious mental obstacles and guilt layers.', color: '#ff0055' },
    { hz: 417, title: 'RE - Undoing Situations', desc: 'Produces energy to clean traumatic patterns and support transformational changes.', color: '#ff6600' },
    { hz: 432, title: 'Natural Cosmic Vibration', desc: 'Matches natural cosmic harmonics, bringing clarity and calm to the acoustic model.', color: '#ffcc00' },
    { hz: 528, title: 'MI - Transformation & Miracles', desc: 'Known as the healing tone to spark cellular vitality and repair DNA helix elements.', color: '#00ff66' },
    { hz: 639, title: 'FA - Harmonic Connections', desc: 'Enhances relationship bonds, communications, and network coherence.', color: '#00ccff' },
    { hz: 741, title: 'SOL - Cleanse Expression', desc: 'Aids self-expression, toxic cleansing, and intuitive resolution keys.', color: '#0066ff' },
    { hz: 852, title: 'LA - Cosmic Order Sync', desc: 'Re-aligns local awareness with spiritual frameworks and absolute truth structures.', color: '#cc00ff' }
  ];

  const activeIntention = solfeggioFrequencies.find(f => f.hz === selectedHz) || {
    hz: selectedHz,
    title: 'Custom Frequency Resonance',
    desc: 'Unmapped acoustic spectrum node. Explore the response grid.',
    color: 'var(--primary-glow)'
  };

  // --- Sound Generator Code ---
  const startTone = () => {
    try {
      const AudioCtxClass = window.AudioContext || window.webkitAudioContext;
      const ctx = new AudioCtxClass();
      audioCtxRef.current = ctx;

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(selectedHz, ctx.currentTime);
      
      const gainVal = (volume / 100) * 0.4;
      gain.gain.setValueAtTime(gainVal, ctx.currentTime);

      osc.connect(gain);
      gain.connect(ctx.destination);

      oscRef.current = osc;
      gainNodeRef.current = gain;
      osc.start();
      setIsPlaying(true);
    } catch (e) {
      console.error("Failed to play Solfeggio tone:", e);
    }
  };

  const stopTone = () => {
    if (oscRef.current) {
      try { oscRef.current.stop(); } catch (e) {}
      oscRef.current = null;
    }
    if (audioCtxRef.current) {
      try { audioCtxRef.current.close(); } catch (e) {}
      audioCtxRef.current = null;
    }
    setIsPlaying(false);
  };

  const handleTogglePlay = () => {
    if (isPlaying) stopTone();
    else startTone();
  };

  useEffect(() => {
    if (isPlaying && oscRef.current && audioCtxRef.current) {
      oscRef.current.frequency.setValueAtTime(selectedHz, audioCtxRef.current.currentTime);
    }
  }, [selectedHz, isPlaying]);

  useEffect(() => {
    if (isPlaying && gainNodeRef.current && audioCtxRef.current) {
      const gainVal = (volume / 100) * 0.4;
      gainNodeRef.current.gain.setValueAtTime(gainVal, audioCtxRef.current.currentTime);
    }
  }, [volume, isPlaying]);

  useEffect(() => {
    return () => {
      stopTone();
      stopVocalScanner();
    };
  }, []);

  // --- Autocorrelation Pitch Detector ---
  const getPitchFromStream = (analyser, sampleRate) => {
    const bufferLength = analyser.fftSize;
    const dataArray = new Uint8Array(bufferLength);
    analyser.getByteTimeDomainData(dataArray);

    const signal = new Float32Array(bufferLength);
    let isSilent = true;
    for (let i = 0; i < bufferLength; i++) {
      const val = (dataArray[i] - 128) / 128;
      signal[i] = val;
      if (Math.abs(val) > 0.02) isSilent = false;
    }

    if (isSilent) return 0;

    let r = new Float32Array(bufferLength);
    for (let lag = 0; lag < bufferLength / 2; lag++) {
      let sum = 0;
      for (let i = 0; i < bufferLength / 2; i++) {
        sum += signal[i] * signal[i + lag];
      }
      r[lag] = sum;
    }

    let firstZeroCrossing = -1;
    for (let i = 0; i < bufferLength / 2; i++) {
      if (r[i] < 0) {
        firstZeroCrossing = i;
        break;
      }
    }

    if (firstZeroCrossing === -1) return 0;

    let peak = -1;
    let maxVal = -1;
    let threshold = 0.15 * r[0];

    for (let i = firstZeroCrossing; i < bufferLength / 2; i++) {
      if (r[i] > threshold && r[i] > r[i - 1] && r[i] > r[i + 1]) {
        if (r[i] > maxVal) {
          maxVal = r[i];
          peak = i;
        }
      }
    }

    if (peak !== -1) {
      return sampleRate / peak;
    }
    return 0;
  };

  const startVocalScanner = async () => {
    try {
      stopVocalScanner();

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      scanStreamRef.current = stream;

      const AudioCtxClass = window.AudioContext || window.webkitAudioContext;
      const ctx = new AudioCtxClass();
      scanCtxRef.current = ctx;

      const sourceNode = ctx.createMediaStreamSource(stream);
      const analyserNode = ctx.createAnalyser();
      analyserNode.fftSize = 512;
      sourceNode.connect(analyserNode);
      scanAnalyserRef.current = analyserNode;

      setIsScanning(true);
      setScannedPitch(0);
      setMatchedHz(null);
      setMatchPercent(0);

      // Canvas loop setup
      const canvas = scanCanvasRef.current;
      if (!canvas) return;
      const canvasCtx = canvas.getContext('2d');
      if (!canvasCtx) return;

      const width = canvas.width = canvas.offsetWidth;
      const height = canvas.height = canvas.offsetHeight;
      const dataArray = new Uint8Array(analyserNode.frequencyBinCount);

      const scanDraw = () => {
        if (scanCtxRef.current?.state === 'closed') return;

        analyserNode.getByteTimeDomainData(dataArray);

        const pitch = getPitchFromStream(analyserNode, ctx.sampleRate);
        if (pitch > 80 && pitch < 1200) {
          setScannedPitch(Math.round(pitch));

          let closest = solfeggioFrequencies[0];
          let minDiff = Infinity;
          solfeggioFrequencies.forEach(f => {
            const ratio = pitch / f.hz;
            const nearestHarmonic = Math.round(ratio);
            const targetFreq = f.hz * (nearestHarmonic || 1);
            const diff = Math.abs(pitch - targetFreq);
            if (diff < minDiff) {
              minDiff = diff;
              closest = f;
            }
          });

          setMatchedHz(closest.hz);
          const ratio = pitch / closest.hz;
          const expectedFreq = closest.hz * (Math.round(ratio) || 1);
          const diffPercent = Math.abs(pitch - expectedFreq) / expectedFreq;
          const alignment = Math.max(0, Math.min(100, Math.round((1 - diffPercent * 6) * 100)));
          setMatchPercent(alignment);
        }

        canvasCtx.fillStyle = 'rgba(7, 6, 48, 0.3)';
        canvasCtx.fillRect(0, 0, width, height);

        canvasCtx.lineWidth = 2;
        canvasCtx.strokeStyle = 'rgba(0, 242, 255, 0.85)';
        canvasCtx.shadowBlur = 8;
        canvasCtx.shadowColor = 'rgba(0, 242, 255, 0.4)';
        canvasCtx.beginPath();

        const sliceWidth = width / dataArray.length;
        let x = 0;
        for (let i = 0; i < dataArray.length; i++) {
          const v = dataArray[i] / 128.0;
          const y = (v * height) / 2;
          if (i === 0) canvasCtx.moveTo(x, y);
          else canvasCtx.lineTo(x, y);
          x += sliceWidth;
        }

        canvasCtx.lineTo(width, height / 2);
        canvasCtx.stroke();
        canvasCtx.shadowBlur = 0;

        scanAnimFrameRef.current = requestAnimationFrame(scanDraw);
      };

      scanAnimFrameRef.current = requestAnimationFrame(scanDraw);

    } catch (err) {
      console.warn("Could not capture microphone for scanning:", err);
      alert("Microphone permission required for Vocal Tuning Scan.");
      setIsScanning(false);
    }
  };

  const stopVocalScanner = () => {
    if (scanAnimFrameRef.current) {
      cancelAnimationFrame(scanAnimFrameRef.current);
    }
    if (scanStreamRef.current) {
      scanStreamRef.current.getTracks().forEach(track => track.stop());
      scanStreamRef.current = null;
    }
    if (scanCtxRef.current) {
      try { scanCtxRef.current.close(); } catch (e) {}
      scanCtxRef.current = null;
    }
    setIsScanning(false);
    setScannedPitch(0);
    setMatchedHz(null);
    setMatchPercent(0);
  };

  const handleToggleScan = () => {
    if (isScanning) stopVocalScanner();
    else startVocalScanner();
  };

  // --- MULTIPLAYER ROOMS INTERACTION HANDLERS ---

  // Load Rooms list (Firestore or Simulated fallbacks)
  useEffect(() => {
    if (isFirebaseConfigured) {
      const unsubscribe = onSnapshot(collection(db, "rooms"), (snapshot) => {
        const activeRooms = [];
        snapshot.forEach(doc => {
          activeRooms.push({ id: doc.id, ...doc.data() });
        });
        setRooms(activeRooms);
      });
      return () => unsubscribe();
    } else {
      // Mock active rooms in lobby
      setRooms([
        { id: 'room_528', name: 'DNA Repair healing chamber', hostName: 'solfeggio_master', frequency: 528, membersCount: 2 },
        { id: 'room_432', name: '432Hz Cosmic alignment sphere', hostName: 'earth_frequencies', frequency: 432, membersCount: 1 },
        { id: 'room_741', name: 'Ajna meditation lobby', hostName: 'chakra_healer', frequency: 741, membersCount: 3 }
      ]);
    }
  }, []);

  // Listen to active room details (members, frequency)
  useEffect(() => {
    if (!activeRoomId) return;

    if (isFirebaseConfigured) {
      const unsubscribe = onSnapshot(doc(db, "rooms", activeRoomId), (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.data();
          setRoomMembers(data.members || []);
          if (data.frequency && data.frequency !== selectedHz) {
            setSelectedHz(data.frequency);
          }
        } else {
          // Room deleted by host
          handleLeaveRoom();
          alert("The host closed this Resonance Chamber.");
        }
      });
      return () => unsubscribe();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeRoomId]);

  // Listen to active room Chat logs
  useEffect(() => {
    if (!activeRoomId) return;

    if (isFirebaseConfigured) {
      const q = query(collection(db, "rooms", activeRoomId, "messages"));
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const msgs = [];
        snapshot.forEach(doc => {
          msgs.push({ id: doc.id, ...doc.data() });
        });
        msgs.sort((a, b) => (a.timestamp?.toMillis() || 0) - (b.timestamp?.toMillis() || 0));
        setChatMessages(msgs);
      });
      return () => unsubscribe();
    }
  }, [activeRoomId]);

  // Sync vocal alignment to shared room profiles
  useEffect(() => {
    if (!activeRoomId) return;

    if (isFirebaseConfigured && user) {
      const roomRef = doc(db, "rooms", activeRoomId);
      const interval = setInterval(async () => {
        try {
          const roomSnap = await getDoc(roomRef);
          if (roomSnap.exists()) {
            const roomData = roomSnap.data();
            const updatedMembers = (roomData.members || []).map(m => {
              if (m.uid === user.uid) {
                return { ...m, alignment: isScanning ? matchPercent : 0 };
              }
              return m;
            });
            await updateDoc(roomRef, { members: updatedMembers });
          }
        } catch (e) {
          console.warn("Could not sync alignment to room:", e);
        }
      }, 2000);
      return () => clearInterval(interval);
    } else {
      // Local alignment sync
      setRoomMembers(prev => prev.map(m => {
        if (m.uid === 'self') {
          return { ...m, alignment: isScanning ? matchPercent : 0 };
        }
        return m;
      }));
    }
  }, [activeRoomId, isScanning, matchPercent, user]);

  // Scrolling chat window to bottom
  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatMessages]);

  // Simulated multiplayer actions in local fallback mode
  useEffect(() => {
    if (isFirebaseConfigured || !activeRoomId) return;

    const interval = setInterval(() => {
      // Randomly update other members match percent
      setRoomMembers(prev => prev.map(m => {
        if (m.uid !== 'self') {
          const delta = Math.floor(-8 + Math.random() * 16);
          const next = Math.max(30, Math.min(95, m.alignment + delta));
          return { ...m, alignment: next };
        }
        return m;
      }));

      // Random messages
      const mockChats = [
        "Aligning vocal coordinates to this carrier key!",
        "Mandala spin speed looking solid, keep holding the pitch!",
        "Anyone hearing the binaural beats sweep left to right?",
        "Beautiful 528Hz lock on my diagnostic board.",
        "Sustaining in chest voice for Root resonance.",
        "Coherence index shifting upwards!"
      ];
      const users = ["frequency_healer", "CosmicChanter", "AuraChanter"];
      const randUser = users[Math.floor(Math.random() * users.length)];
      const randText = mockChats[Math.floor(Math.random() * mockChats.length)];

      setChatMessages(prev => [
        ...prev,
        { sender: randUser, text: randText, timestamp: new Date().toLocaleTimeString() }
      ]);
    }, 6000);

    // Simulated joinee
    const joinTimeout = setTimeout(() => {
      setRoomMembers(prev => {
        if (prev.some(m => m.uid === 'mock_3')) return prev;
        return [
          ...prev,
          { uid: 'mock_3', displayName: 'AuraChanter', alignment: 48, vocalType: 'Bass' }
        ];
      });
      setChatMessages(prev => [
        ...prev,
        { sender: 'System', text: 'AuraChanter has entered the resonance chamber.', timestamp: new Date().toLocaleTimeString() }
      ]);
    }, 12000);

    return () => {
      clearInterval(interval);
      clearTimeout(joinTimeout);
    };
  }, [activeRoomId]);

  // Group Mandala Canvas Loop
  useEffect(() => {
    if (!activeRoomId) return;

    const canvas = mandalaCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    
    let animationFrame;
    let rotationAngle = 0;

    const drawMandala = () => {
      if (!mandalaCanvasRef.current) return;
      const width = canvas.width = canvas.offsetWidth;
      const height = canvas.height = canvas.offsetHeight;
      const cx = width / 2;
      const cy = height / 2;
      const maxRadius = Math.min(width, height) * 0.44;

      ctx.clearRect(0, 0, width, height);

      // Dark space background
      ctx.fillStyle = '#030214';
      ctx.fillRect(0, 0, width, height);

      // Coherence factor
      const activeMembers = roomMembers;
      const count = activeMembers.length;
      const avgAlign = count > 0 
        ? Math.round(activeMembers.reduce((sum, m) => sum + (m.alignment || 0), 0) / count) 
        : 65;
      
      setGroupCoherence(avgAlign);
      const coherenceFactor = avgAlign / 100;

      rotationAngle += 0.004 + coherenceFactor * 0.03;

      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(rotationAngle);

      // 1. Concentric circles
      ctx.strokeStyle = `rgba(0, 242, 255, ${0.06 + coherenceFactor * 0.12})`;
      ctx.lineWidth = 1;
      for (let r = 1; r <= 3; r++) {
        ctx.beginPath();
        ctx.arc(0, 0, maxRadius * (r / 3), 0, Math.PI * 2);
        ctx.stroke();
      }

      // 2. Mandala geometry spokes
      ctx.strokeStyle = `rgba(255, 0, 193, ${0.04 + coherenceFactor * 0.1})`;
      const spokes = 8;
      for (let i = 0; i < spokes; i++) {
        ctx.rotate(Math.PI / 4);
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(maxRadius, 0);
        ctx.stroke();
        
        ctx.fillStyle = `rgba(0, 242, 255, ${0.15 + coherenceFactor * 0.25})`;
        ctx.beginPath();
        ctx.arc(maxRadius * 0.65, 0, 3, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();

      // 3. Central Coherence Corona Glow
      ctx.save();
      const coronaRad = 15 + coherenceFactor * 30;
      const grad = ctx.createRadialGradient(cx, cy, 1, cx, cy, coronaRad);
      grad.addColorStop(0, '#ffffff');
      grad.addColorStop(0.3, `rgba(0, 255, 135, ${0.35 + coherenceFactor * 0.45})`);
      grad.addColorStop(0.7, `rgba(255, 0, 193, 0.2)`);
      grad.addColorStop(1, 'rgba(3, 2, 20, 0)');
      
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(cx, cy, coronaRad, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // 4. Participant nodes mapping
      activeMembers.forEach((member, idx) => {
        const alignVal = member.alignment || 0;
        const targetDist = maxRadius * (1.0 - (alignVal / 100) * 0.9);
        const orbitalAngle = (idx * (Math.PI * 2) / (count || 1)) + (Date.now() / 4500);
        
        const nodeX = cx + Math.cos(orbitalAngle) * targetDist;
        const nodeY = cy + Math.sin(orbitalAngle) * targetDist;

        const nodeColor = idx === 0 ? '#00f2ff' : idx === 1 ? '#00ff87' : idx === 2 ? '#ff00c1' : '#ffb700';

        // Connective halo lines during high coherence
        if (coherenceFactor > 0.75) {
          ctx.strokeStyle = `rgba(255, 255, 255, ${coherenceFactor * 0.12})`;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(cx, cy);
          ctx.lineTo(nodeX, nodeY);
          ctx.stroke();
        }

        // Pulse ring
        ctx.strokeStyle = nodeColor;
        ctx.lineWidth = 1;
        ctx.globalAlpha = 0.35 + Math.sin(Date.now() / 250 + idx) * 0.25;
        ctx.beginPath();
        ctx.arc(nodeX, nodeY, 8 + Math.sin(Date.now() / 180) * 2, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = 1.0;

        // Core
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(nodeX, nodeY, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = nodeColor;
        ctx.beginPath();
        ctx.arc(nodeX, nodeY, 2.5, 0, Math.PI * 2);
        ctx.fill();

        // Tag text
        ctx.font = '8px Orbitron, sans-serif';
        ctx.fillStyle = '#fff';
        ctx.fillText(`${member.displayName} (${alignVal}%)`, nodeX + 8, nodeY + 3);
      });

      animationFrame = requestAnimationFrame(drawMandala);
    };

    animationFrame = requestAnimationFrame(drawMandala);
    return () => cancelAnimationFrame(animationFrame);
  }, [activeRoomId, roomMembers]);

  // Host room creator
  const handleHostRoom = async (e) => {
    e.preventDefault();
    const roomName = roomNameInput.trim() || `${userData?.displayName || 'Cosmic'}'s Resonance Chamber`;
    
    if (isFirebaseConfigured && user) {
      try {
        const roomRef = await addDoc(collection(db, "rooms"), {
          name: roomName,
          hostId: user.uid,
          hostName: userData?.displayName || 'Aura Host',
          frequency: selectedHz,
          members: [{
            uid: user.uid,
            displayName: userData?.displayName || 'Aura Host',
            alignment: 0,
            vocalType: userData?.voiceSignature?.vocalType || 'Alto'
          }]
        });
        setActiveRoomId(roomRef.id);
        setIsHost(true);
        setRoomNameInput('');
      } catch (err) {
        console.error("Hosting chamber fail:", err);
      }
    } else {
      // Local Demo hosting
      const mockId = 'room_' + Date.now();
      setActiveRoomId(mockId);
      setIsHost(true);
      setRoomNameInput('');
      setRoomMembers([
        { uid: 'self', displayName: userData?.displayName || 'Aura Singer', alignment: 0, vocalType: userData?.voiceSignature?.vocalType || 'Alto' },
        { uid: 'mock_1', displayName: 'frequency_healer', alignment: 62, vocalType: 'Soprano' },
        { uid: 'mock_2', displayName: 'CosmicChanter', alignment: 74, vocalType: 'Bass' }
      ]);
      setChatMessages([
        { sender: 'System', text: `Welcome to "${roomName}" Chamber. Simulated online lobby initialized.`, timestamp: new Date().toLocaleTimeString() }
      ]);
    }
  };

  // Join Room
  const handleJoinRoom = async (roomId) => {
    if (isFirebaseConfigured && user) {
      try {
        const roomRef = doc(db, "rooms", roomId);
        const roomSnap = await getDoc(roomRef);
        if (roomSnap.exists()) {
          const roomData = roomSnap.data();
          const currentMembers = roomData.members || [];
          const inAlready = currentMembers.some(m => m.uid === user.uid);

          if (!inAlready) {
            const selfInfo = {
              uid: user.uid,
              displayName: userData?.displayName || 'Aura Singer',
              alignment: 0,
              vocalType: userData?.voiceSignature?.vocalType || 'Alto'
            };
            await updateDoc(roomRef, { members: [...currentMembers, selfInfo] });
          }
          setActiveRoomId(roomId);
          setIsHost(roomData.hostId === user.uid);
          setSelectedHz(roomData.frequency || 528);
        }
      } catch (err) {
        console.error("Room join fail:", err);
      }
    } else {
      // Local Demo join
      const matched = rooms.find(r => r.id === roomId);
      setActiveRoomId(roomId);
      setIsHost(false);
      if (matched) setSelectedHz(matched.frequency);
      setRoomMembers([
        { uid: 'self', displayName: userData?.displayName || 'Aura Singer', alignment: 0, vocalType: userData?.voiceSignature?.vocalType || 'Alto' },
        { uid: 'mock_1', displayName: 'frequency_healer', alignment: 65, vocalType: 'Soprano' },
        { uid: 'mock_2', displayName: 'CosmicChanter', alignment: 72, vocalType: 'Bass' }
      ]);
      setChatMessages([
        { sender: 'System', text: `Successfully joined. Alignment sync live.`, timestamp: new Date().toLocaleTimeString() }
      ]);
    }
  };

  // Leave Room
  const handleLeaveRoom = async () => {
    stopTone();
    stopVocalScanner();
    const roomId = activeRoomId;
    setActiveRoomId(null);
    setIsHost(false);
    setChatMessages([]);

    if (isFirebaseConfigured && user && roomId) {
      try {
        const roomRef = doc(db, "rooms", roomId);
        const roomSnap = await getDoc(roomRef);
        if (roomSnap.exists()) {
          const roomData = roomSnap.data();
          const currentMembers = roomData.members || [];
          if (roomData.hostId === user.uid) {
            await deleteDoc(roomRef);
          } else {
            await updateDoc(roomRef, {
              members: currentMembers.filter(m => m.uid !== user.uid)
            });
          }
        }
      } catch (err) {
        console.error("Leave room cleaning failed:", err);
      }
    }
  };

  // Send message
  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!chatInput.trim()) return;

    if (isFirebaseConfigured && activeRoomId) {
      try {
        await addDoc(collection(db, "rooms", activeRoomId, "messages"), {
          sender: userData?.displayName || 'Aura Singer',
          text: chatInput,
          timestamp: serverTimestamp()
        });
        setChatInput('');
      } catch (e) {
        console.error("Failed to post message:", e);
      }
    } else {
      // Local chat send
      setChatMessages(prev => [
        ...prev,
        { sender: userData?.displayName || 'Aura Singer', text: chatInput, timestamp: new Date().toLocaleTimeString() }
      ]);
      setChatInput('');
    }
  };

  // Change room frequency (For hosts)
  const changeRoomFrequency = async (hz) => {
    setSelectedHz(hz);
    if (isFirebaseConfigured && activeRoomId) {
      try {
        await updateDoc(doc(db, "rooms", activeRoomId), { frequency: hz });
      } catch (e) {
        console.error("Failed to shift frequency:", e);
      }
    }
  };

  // --- HTML LAYOUT VIEWS ---

  if (activeRoomId) {
    // ACTIVE CHAMBER VIEW
    const activeRoom = rooms.find(r => r.id === activeRoomId) || {
      name: 'Resonance Chamber',
      hostName: 'Host'
    };

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <style>{`
          @keyframes pulseCoherence {
            0% { transform: scale(1); filter: drop-shadow(0 0 10px rgba(0, 255, 135, 0.4)); }
            50% { transform: scale(1.02); filter: drop-shadow(0 0 20px rgba(0, 255, 135, 0.7)); }
            100% { transform: scale(1); filter: drop-shadow(0 0 10px rgba(0, 255, 135, 0.4)); }
          }
          .coherence-glow-active {
            animation: pulseCoherence 2s infinite ease-in-out;
            border-color: #00ff87 !important;
          }
        `}</style>

        {/* Room Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '15px' }}>
          <div>
            <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--primary-glow)' }}>Active Chamber Room</span>
            <h2 style={{ textShadow: '0 0 10px var(--primary-glow)', margin: 0 }}>{activeRoom.name}</h2>
            <p style={{ color: 'var(--text-dim)', fontSize: '0.85rem', margin: '4px 0 0' }}>Hosted by: <b>{activeRoom.hostName}</b> | Scale key: <b>{selectedHz} Hz</b></p>
          </div>
          <button className="glowing-button secondary" onClick={handleLeaveRoom} style={{ margin: 0 }}>
            🚪 Leave Chamber
          </button>
        </div>

        {/* Grid Panels */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>

          {/* Group Alignment Mandala Panel */}
          <div className={`glass-panel ${groupCoherence > 80 ? 'coherence-glow-active' : ''}`} style={{ margin: 0, display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3>Group Coherence</h3>
              <span className="level-badge" style={{ background: groupCoherence > 80 ? '#00ff87' : 'var(--secondary-glow)', color: '#000' }}>
                {groupCoherence}% Coherent
              </span>
            </div>
            
            <div style={{ height: '220px', borderRadius: '10px', overflow: 'hidden', position: 'relative', border: '1px solid rgba(255,255,255,0.06)' }}>
              <canvas ref={mandalaCanvasRef} style={{ width: '100%', height: '100%' }} />
            </div>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-dim)', margin: 0, textAlign: 'center', fontStyle: 'italic' }}>
              Nodes representing participants glide inward as they align vocal stability with the active hum key.
            </p>
          </div>

          {/* Local Vocal Alignment Scanner */}
          <div className="glass-panel" style={{ margin: 0, display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3>Microphone Alignment Scanner</h3>
              <button 
                className={`glowing-button ${isScanning ? 'secondary' : ''}`} 
                onClick={handleToggleScan}
                style={{ margin: 0, fontSize: '0.75rem', padding: '4px 12px' }}
              >
                {isScanning ? '⏹ Stop' : '🎙 Scan'}
              </button>
            </div>
            
            {isScanning ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ height: '80px', background: 'rgba(0,0,0,0.3)', borderRadius: '8px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.05)' }}>
                  <canvas ref={scanCanvasRef} style={{ width: '100%', height: '100%' }} />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <div style={{ background: 'rgba(0,0,0,0.2)', padding: '10px', borderRadius: '6px', textAlign: 'center' }}>
                    <span style={{ fontSize: '0.65rem', color: 'var(--text-dim)' }}>YOUR PITCH</span>
                    <div style={{ fontSize: '1.25rem', fontWeight: 'bold', color: 'var(--primary-glow)', marginTop: '4px' }}>
                      {scannedPitch ? `${scannedPitch} Hz` : '---'}
                    </div>
                  </div>
                  <div style={{ background: 'rgba(0,0,0,0.2)', padding: '10px', borderRadius: '6px', textAlign: 'center' }}>
                    <span style={{ fontSize: '0.65rem', color: 'var(--text-dim)' }}>ALIGNMENT</span>
                    <div style={{ fontSize: '1.25rem', fontWeight: 'bold', color: 'var(--secondary-glow)', marginTop: '4px' }}>
                      {matchedHz ? `${matchPercent}%` : '---'}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', height: '150px', border: '1px dashed rgba(255,255,255,0.1)', borderRadius: '10px', textAlign: 'center', padding: '15px' }}>
                <span style={{ fontSize: '1.5rem', marginBottom: '8px' }}>🎙</span>
                <p style={{ fontSize: '0.82rem', color: 'var(--text-dim)', margin: 0 }}>
                  Activate your local mic sensor inside the chamber to trace your voice frequency and place your node on the Shared Coherence Mandala.
                </p>
              </div>
            )}

            <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '10px', opacity: isPlaying ? 1 : 0.6 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>Lobby Hum Carrier:</span>
                <button className="daw-track-btn" onClick={handleTogglePlay} style={{ fontSize: '0.65rem', padding: '2px 8px' }}>
                  {isPlaying ? '⏹ Mute Hum' : '🔊 Listen'}
                </button>
              </div>
              <div className="slider-group" style={{ marginTop: '8px' }}>
                <input type="range" className="slider-input" min="0" max="100" value={volume} onChange={e => setVolume(parseInt(e.target.value))} disabled={!isPlaying} style={{ height: '4px' }} />
              </div>
            </div>
          </div>

        </div>

        {/* Sync Controls & Synergy Chat */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', alignItems: 'start', flexWrap: 'wrap' }}>
          
          {/* Chat box */}
          <div className="glass-panel" style={{ margin: 0, display: 'flex', flexDirection: 'column', gap: '10px', height: '320px' }}>
            <h3>Synergy Chat Feed</h3>
            <div style={{ flexGrow: 1, overflowY: 'auto', background: 'rgba(0,0,0,0.2)', borderRadius: '8px', padding: '10px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {chatMessages.length === 0 ? (
                <div style={{ color: 'var(--text-dim)', fontSize: '0.8rem', fontStyle: 'italic', textAlign: 'center', marginTop: '40px' }}>
                  Resonance chat silent. Broadcast a message...
                </div>
              ) : (
                chatMessages.map((msg, idx) => (
                  <div key={idx} style={{ fontSize: '0.8rem', lineHeight: '1.4' }}>
                    <strong style={{ color: msg.sender === 'System' ? 'var(--secondary-glow)' : 'var(--primary-glow)' }}>{msg.sender}: </strong>
                    <span style={{ color: msg.sender === 'System' ? 'var(--text-dim)' : '#fff' }}>{msg.text}</span>
                  </div>
                ))
              )}
              <div ref={chatEndRef} />
            </div>

            <form onSubmit={handleSendMessage} style={{ display: 'flex', gap: '8px' }}>
              <input 
                type="text" 
                placeholder="Broadcast a frequency wave message..." 
                value={chatInput} 
                onChange={e => setChatInput(e.target.value)} 
                className="glass-input" 
                style={{ margin: 0, padding: '6px 12px', fontSize: '0.85rem' }} 
              />
              <button type="submit" className="glowing-button secondary" style={{ margin: 0, padding: '6px 15px', fontSize: '0.8rem' }}>
                Send
              </button>
            </form>
          </div>

          {/* Solfeggio Scale selection */}
          <div className="glass-panel" style={{ margin: 0, height: '320px', display: 'flex', flexDirection: 'column' }}>
            <h3>Carrier Frequency Scales</h3>
            <p style={{ color: 'var(--text-dim)', fontSize: '0.78rem', margin: '4px 0 10px' }}>
              {isHost ? 'Select a Solfeggio key to update the hum scale for all participants.' : 'Host has locked the scale selector. Cohering to host carrier wave.'}
            </p>
            <div style={{ overflowY: 'auto', flexGrow: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {solfeggioFrequencies.map((f) => (
                <button
                  key={f.hz}
                  onClick={() => isHost && changeRoomFrequency(f.hz)}
                  className={`effect-toggle-btn ${selectedHz === f.hz ? 'active' : ''}`}
                  disabled={!isHost}
                  style={{
                    padding: '8px 12px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    textAlign: 'left',
                    opacity: (!isHost && selectedHz !== f.hz) ? 0.5 : 1
                  }}
                >
                  <div>
                    <strong style={{ fontSize: '0.8rem', color: selectedHz === f.hz ? '#fff' : f.color }}>{f.hz} Hz</strong>
                    <span style={{ fontSize: '0.7rem', display: 'block', fontWeight: 'normal', opacity: 0.8 }}>{f.title.split(' - ')[1]}</span>
                  </div>
                  {selectedHz === f.hz && <span style={{ fontSize: '0.7rem', color: '#00ff87' }}>● BROADCASTING</span>}
                </button>
              ))}
            </div>
          </div>

        </div>

      </div>
    );
  }

  // STANDARD LOBBY / PRACTICE VIEW
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '15px' }}>
        <div>
          <h2 style={{ textShadow: '0 0 10px var(--primary-glow)', margin: 0 }}>Collaboration Lobby</h2>
          <p style={{ color: 'var(--text-dim)', fontSize: '0.9rem', margin: '4px 0 0' }}>Join a collective Resonance Chamber or calibrate your vocal harmonics</p>
        </div>
      </div>

      {/* Grid: Collab Lobby on Left, Practice Lab on Right */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
        
        {/* Collaboration Lobby list & creation */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          {/* Host room creation box */}
          <div className="glass-panel" style={{ margin: 0 }}>
            <h3>Host Resonance Chamber</h3>
            <p style={{ color: 'var(--text-dim)', fontSize: '0.85rem', marginBottom: '12px' }}>
              Create a shared frequency workspace where other singers can join and synchronize.
            </p>
            <form onSubmit={handleHostRoom} style={{ display: 'flex', gap: '10px' }}>
              <input 
                type="text" 
                placeholder="Room Name (e.g. Helix Coherence)" 
                value={roomNameInput} 
                onChange={e => setRoomNameInput(e.target.value)} 
                className="glass-input" 
                style={{ margin: 0, padding: '8px 12px', fontSize: '0.85rem' }} 
              />
              <button type="submit" className="glowing-button secondary" style={{ margin: 0, padding: '8px 15px', fontSize: '0.8rem', whiteSpace: 'nowrap' }}>
                ⚡ Host Room
              </button>
            </form>
          </div>

          {/* Active Rooms lists */}
          <div className="glass-panel" style={{ margin: 0, flexGrow: 1, minHeight: '220px' }}>
            <h3>Active chambers</h3>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '12px' }}>
              {rooms.length === 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', height: '140px', border: '1px dashed rgba(255,255,255,0.08)', borderRadius: '8px', color: 'var(--text-dim)', fontSize: '0.82rem', fontStyle: 'italic' }}>
                  Acoustic grid silent. No active chambers.
                </div>
              ) : (
                rooms.map((room) => (
                  <div 
                    key={room.id} 
                    style={{ 
                      background: 'rgba(255,255,255,0.03)', 
                      border: '1px solid rgba(255,255,255,0.06)', 
                      borderRadius: '8px', 
                      padding: '12px', 
                      display: 'flex', 
                      justifyContent: 'space-between', 
                      alignItems: 'center' 
                    }}
                  >
                    <div>
                      <strong style={{ fontSize: '0.9rem', color: '#fff' }}>{room.name}</strong>
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-dim)', marginTop: '4px' }}>
                        Host: {room.hostName} | Key: {room.frequency}Hz
                      </div>
                    </div>
                    <button 
                      className="glowing-button secondary" 
                      onClick={() => handleJoinRoom(room.id)}
                      style={{ margin: 0, padding: '6px 12px', fontSize: '0.75rem' }}
                    >
                      🌐 Join
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

        </div>

        {/* Solo Calibration Lab */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          {/* Signal generator */}
          <div className="glass-panel" style={{ margin: 0, borderColor: isPlaying ? activeIntention.color : 'var(--glass-border)', boxShadow: isPlaying ? `0 0 15px ${activeIntention.color}33` : '' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3>Solo Calibrator Hum</h3>
              <button 
                className="glowing-button" 
                onClick={handleTogglePlay}
                style={{ 
                  margin: 0, 
                  fontSize: '0.75rem', 
                  padding: '4px 12px',
                  borderColor: activeIntention.color,
                  color: activeIntention.color,
                  boxShadow: isPlaying ? `0 0 10px ${activeIntention.color}` : ''
                }}
              >
                {isPlaying ? '⏹ Stop' : '🔊 Play'}
              </button>
            </div>

            <div className="hz-badge" style={{ fontSize: '2rem', margin: '10px 0', color: isPlaying ? activeIntention.color : '#fff' }}>
              {selectedHz} <span style={{ fontSize: '1rem' }}>Hz</span>
            </div>

            <div className="slider-group" style={{ marginTop: '12px' }}>
              <input type="range" className="slider-input" min="100" max="1000" value={selectedHz} onChange={e => setSelectedHz(parseInt(e.target.value))} style={{ height: '4px' }} />
            </div>
            
            <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', fontStyle: 'italic', marginTop: '6px' }}>
              {activeIntention.title.split(' - ')[1] || 'Tuned generator'}
            </div>
          </div>

          {/* Pitch alignment scanner */}
          <div className="glass-panel" style={{ margin: 0, borderColor: isScanning ? 'var(--primary-glow)' : 'var(--glass-border)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <h3>Tuning Pitch Scanner</h3>
              <button 
                className={`glowing-button ${isScanning ? 'secondary' : ''}`} 
                onClick={handleToggleScan}
                style={{ margin: 0, fontSize: '0.75rem', padding: '4px 12px' }}
              >
                {isScanning ? '⏹ Stop Scan' : '🎙 Scan voice'}
              </button>
            </div>

            {isScanning ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ height: '70px', background: 'rgba(0,0,0,0.25)', borderRadius: '6px', overflow: 'hidden' }}>
                  <canvas ref={scanCanvasRef} style={{ width: '100%', height: '100%' }} />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', fontSize: '0.8rem' }}>
                  <div style={{ background: 'rgba(0,0,0,0.15)', padding: '8px', borderRadius: '6px', textAlign: 'center' }}>
                    <span style={{ fontSize: '0.62rem', color: 'var(--text-dim)' }}>PITCH</span>
                    <div style={{ fontSize: '1.1rem', fontWeight: 'bold', color: 'var(--primary-glow)', marginTop: '2px' }}>{scannedPitch ? `${scannedPitch} Hz` : '---'}</div>
                  </div>
                  <div style={{ background: 'rgba(0,0,0,0.15)', padding: '8px', borderRadius: '6px', textAlign: 'center' }}>
                    <span style={{ fontSize: '0.62rem', color: 'var(--text-dim)' }}>ALIGNMENT</span>
                    <div style={{ fontSize: '1.1rem', fontWeight: 'bold', color: 'var(--secondary-glow)', marginTop: '2px' }}>{matchedHz ? `${matchPercent}%` : '---'}</div>
                  </div>
                </div>
              </div>
            ) : (
              <p style={{ fontSize: '0.78rem', color: 'var(--text-dim)', margin: 0 }}>
                Start the voice scan to detect your frequency stability and find the nearest matching Solfeggio scale.
              </p>
            )}

            {matchedHz && scannedPitch > 0 && (
              <div style={{ marginTop: '10px', borderLeft: '3px solid var(--primary-glow)', paddingLeft: '10px', background: 'rgba(0, 242, 255, 0.01)', padding: '6px 10px', borderRadius: '4px', fontSize: '0.78rem' }}>
                Matches Scale: <strong style={{ color: 'var(--primary-glow)' }}>{matchedHz} Hz</strong> ({matchPercent}% lock)
              </div>
            )}
          </div>

        </div>

      </div>

      {/* Solfeggio scales grid */}
      <div className="glass-panel" style={{ margin: 0 }}>
        <h3>Solfeggio Resonance Scales</h3>
        <div className="frequency-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', marginTop: '12px' }}>
          {solfeggioFrequencies.map((f) => (
            <div 
              key={f.hz} 
              className={`frequency-card ${selectedHz === f.hz ? 'active' : ''}`}
              onClick={() => setSelectedHz(f.hz)}
              style={{ 
                background: selectedHz === f.hz ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.2)',
                border: selectedHz === f.hz ? `1px solid ${f.color}` : '1px solid rgba(255,255,255,0.04)',
                borderLeft: selectedHz === f.hz ? `4px solid ${f.color}` : '1px solid rgba(255,255,255,0.04)',
                padding: '12px',
                borderRadius: '8px',
                cursor: 'pointer'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <strong style={{ color: f.color, fontSize: '0.9rem' }}>{f.hz} Hz</strong>
                {selectedHz === f.hz && <span style={{ color: '#00ff87', fontSize: '0.7rem' }}>● Selected</span>}
              </div>
              <h4 style={{ margin: '6px 0 4px 0', fontSize: '0.85rem', color: '#fff' }}>{f.title.split(' - ')[1]}</h4>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-dim)', margin: 0, lineHeight: '1.3' }}>{f.desc}</p>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
};

export default FrequencyLab;
