import React, { useState, useEffect, useRef } from 'react';
import VoiceReactiveVisualizer from '../components/VoiceReactiveVisualizer';

const RecordingStudio = ({ selectedSong, setCurrentRecording, navigate, setError }) => {
  const [isRecording, setIsRecording] = useState(false);
  const [recordTime, setRecordTime] = useState(0);
  const [activeLineIdx, setActiveLineIdx] = useState(0);
  const [lyricsLines, setLyricsLines] = useState([]);
  
  // Web Audio & Media Recorder Refs
  const audioContextRef = useRef(null);
  const streamRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const [analyser, setAnalyser] = useState(null);

  // Sync Editor Mode state
  const [isSyncMode, setIsSyncMode] = useState(false);
  const [syncedTimestamps, setSyncedTimestamps] = useState([]);
  const [syncPlaybackTime, setSyncPlaybackTime] = useState(0);
  
  const timerRef = useRef(null);
  const syncPlaybackTimerRef = useRef(null);
  const lyricsContainerRef = useRef(null);
  const backingAudioElementRef = useRef(null);

  useEffect(() => {
    const currentAudio = backingAudioElementRef.current;
    return () => {
      if (currentAudio) {
        currentAudio.pause();
      }
    };
  }, []);

  useEffect(() => {
    if (selectedSong && selectedSong.lyrics) {
      // Split lyrics by line breaks and remove empty lines
      const lines = selectedSong.lyrics.split('\n').filter(l => l.trim() !== '');
      setLyricsLines(lines);
      // Initialize timestamps
      setSyncedTimestamps(lines.map((text, idx) => ({ idx, text, time: idx * 4.5 })));
    } else {
      setLyricsLines(['[Freestyle Mode]', 'Sing from the soul...', 'Express your inner frequency...']);
      setSyncedTimestamps([
        { idx: 0, text: '[Freestyle Mode]', time: 0 },
        { idx: 1, text: 'Sing from the soul...', time: 4 },
        { idx: 2, text: 'Express your inner frequency...', time: 8 }
      ]);
    }
  }, [selectedSong]);

  // Handle active lyric scrolling highlighting
  useEffect(() => {
    if (isRecording) {
      // If we have custom synced timestamps, find which line is currently active
      const active = syncedTimestamps.reduce((acc, current) => {
        if (recordTime >= current.time) {
          return current.idx;
        }
        return acc;
      }, 0);
      setActiveLineIdx(active);

      // Scroll lyrics container
      const container = lyricsContainerRef.current;
      if (container) {
        const activeLineElement = container.children[active];
        if (activeLineElement) {
          container.scrollTo({
            top: activeLineElement.offsetTop - container.offsetHeight / 2 + activeLineElement.offsetHeight / 2,
            behavior: 'smooth'
          });
        }
      }
    }
  }, [recordTime, isRecording, syncedTimestamps]);

  const startAudioCapture = async () => {
    try {
      audioChunksRef.current = [];
      
      // Request mic permission
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      streamRef.current = stream;

      // Initialize Web Audio API for reactive visualizer
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      const audioCtx = new AudioContextClass();
      audioContextRef.current = audioCtx;

      const sourceNode = audioCtx.createMediaStreamSource(stream);
      const analyserNode = audioCtx.createAnalyser();
      analyserNode.fftSize = 128;
      sourceNode.connect(analyserNode);
      setAnalyser(analyserNode);

      // Media recorder to save audio
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };
      
      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/mp3' });
        const playbackUrl = URL.createObjectURL(audioBlob);
        
        // Generate simulated voice analytical scores
        const simulatedVoiceSignature = generateVoiceSignature();
        const simulatedToneProfile = generateToneProfile();

        setCurrentRecording({
          playbackUrl,
          selectedSong: selectedSong || { title: 'Freestyle Resonance', artist: 'Self' },
          signature: simulatedVoiceSignature,
          tones: simulatedToneProfile,
          recordTime,
          analyser: analyserNode
        });

        // Redirect to results
        navigate('Results');
      };

      if (backingAudioElementRef.current) {
        backingAudioElementRef.current.currentTime = 0;
        backingAudioElementRef.current.play().catch(e => console.warn("Backing track play failed:", e));
      }

      mediaRecorder.start();
      setIsRecording(true);
      setRecordTime(0);

      // Start timer synced to backing track
      timerRef.current = setInterval(() => {
        if (backingAudioElementRef.current) {
          setRecordTime(backingAudioElementRef.current.currentTime);
        } else {
          setRecordTime(prev => prev + 0.1);
        }
      }, 100);

    } catch (err) {
      console.warn("Microphone access failed or blocked. Starting in Simulated Recording mode.", err);
      
      if (backingAudioElementRef.current) {
        backingAudioElementRef.current.currentTime = 0;
        backingAudioElementRef.current.play().catch(e => console.warn("Backing track play failed:", e));
      }

      // Fallback: Simulated visualizer and audio recording
      setIsRecording(true);
      setRecordTime(0);
      setAnalyser(null); // Passing null triggers visualizer idle flow
      
      timerRef.current = setInterval(() => {
        if (backingAudioElementRef.current) {
          setRecordTime(backingAudioElementRef.current.currentTime);
        } else {
          setRecordTime(prev => prev + 0.1);
        }
      }, 100);
    }
  };

  const stopAudioCapture = () => {
    setIsRecording(false);
    clearInterval(timerRef.current);

    if (backingAudioElementRef.current) {
      backingAudioElementRef.current.pause();
    }

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
      // Stop stream tracks
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    } else {
      // Fallback mock finalization
      const mockBlob = new Blob(['mock binary vocal waveforms'], { type: 'audio/mp3' });
      const playbackUrl = URL.createObjectURL(mockBlob);

      setCurrentRecording({
        playbackUrl,
        selectedSong: selectedSong || { title: 'Freestyle Resonance', artist: 'Self' },
        signature: generateVoiceSignature(),
        tones: generateToneProfile(),
        recordTime
      });
      navigate('Results');
    }
  };

  // Generate unique randomized metrics matching the selected song/freestyle
  const generateVoiceSignature = () => {
    const isHighPitch = selectedSong?.difficulty === 'Hard';
    const vocalTypes = isHighPitch ? ['Soprano', 'Tenor'] : ['Alto', 'Baritone'];
    const selectedType = vocalTypes[Math.floor(Math.random() * vocalTypes.length)];
    const resonances = ['Head Voice', 'Chest Voice', 'Mixed Voice', 'Mask Resonance'];

    return {
      vocalType: selectedType,
      resonanceType: resonances[Math.floor(Math.random() * resonances.length)],
      dominantFreq: isHighPitch ? `${350 + Math.floor(Math.random() * 80)} Hz` : `${110 + Math.floor(Math.random() * 50)} Hz`,
      energy: 70 + Math.floor(Math.random() * 25),
      flow: 65 + Math.floor(Math.random() * 30),
      expression: 70 + Math.floor(Math.random() * 25),
      breath: 60 + Math.floor(Math.random() * 35),
      stability: 75 + Math.floor(Math.random() * 20)
    };
  };

  const generateToneProfile = () => {
    const primaryTones = ['Warm', 'Bright', 'Airy', 'Deep', 'Clear', 'Powerful', 'Soft', 'Raspy', 'Smooth'];
    // Shuffle and pick 3
    const shuffled = [...primaryTones].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, 3);
  };

  // --- Tap Sync Lyrics Editor Handlers ---
  const startSyncEditor = () => {
    setIsSyncMode(true);
    setSyncPlaybackTime(0);
    setActiveLineIdx(0);

    if (backingAudioElementRef.current) {
      backingAudioElementRef.current.currentTime = 0;
      backingAudioElementRef.current.play().catch(e => console.warn("Backing track play failed:", e));
    }

    syncPlaybackTimerRef.current = setInterval(() => {
      if (backingAudioElementRef.current) {
        setSyncPlaybackTime(backingAudioElementRef.current.currentTime);
      } else {
        setSyncPlaybackTime(prev => prev + 0.1);
      }
    }, 100);
  };

  const handleTapSync = () => {
    if (activeLineIdx >= lyricsLines.length) return;
    
    // Assign current timestamp to active line
    setSyncedTimestamps(prev => prev.map((item, idx) => {
      if (idx === activeLineIdx) {
        return { ...item, time: parseFloat(syncPlaybackTime.toFixed(1)) };
      }
      return item;
    }));

    // Move to next line
    setActiveLineIdx(prev => Math.min(prev + 1, lyricsLines.length - 1));
  };

  const saveSyncedLyrics = () => {
    clearInterval(syncPlaybackTimerRef.current);
    if (backingAudioElementRef.current) {
      backingAudioElementRef.current.pause();
    }
    setIsSyncMode(false);
    setActiveLineIdx(0);
    alert('Vocal matrix synced and saved successfully!');
  };
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <audio 
        ref={backingAudioElementRef} 
        src={selectedSong?.audioUrl || 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3'} 
        style={{ display: 'none' }} 
      />
      
      {/* Title */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ textShadow: '0 0 10px var(--primary-glow)', margin: 0 }}>Vocal Studio</h2>
          <p style={{ color: 'var(--text-dim)', fontSize: '0.9rem' }}>
            Recording: {selectedSong ? `${selectedSong.title} - ${selectedSong.artist}` : 'Freestyle Resonance'}
          </p>
        </div>
        <button className="glowing-button secondary" onClick={() => navigate('SongLibrary')} style={{ padding: '6px 14px', fontSize: '0.8rem' }}>
          Change Track
        </button>
      </div>

      {/* Main Studio Console */}
      <div className="glass-panel" style={{ textAlign: 'center', borderColor: isRecording ? 'var(--secondary-glow)' : 'var(--glass-border)' }}>
        
        {/* Voice reactive visualizer canvas */}
        <VoiceReactiveVisualizer analyser={analyser} />

        {/* Counter */}
        <div style={{ margin: '15px 0', fontSize: '1.5rem', fontFamily: 'var(--font-family)', textShadow: '0 0 10px var(--primary-glow)' }}>
          {Math.floor(recordTime / 60)}:{(recordTime % 60).toFixed(1).padStart(4, '0')}
        </div>

        {/* Record & Stop Controls */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: '15px' }}>
          {!isRecording ? (
            <button className="glowing-button" onClick={startAudioCapture}>
              ⚡ Initiate Alignment (Mic Record)
            </button>
          ) : (
            <button className="glowing-button secondary" onClick={stopAudioCapture}>
              ⏹️ Harmonize & Finalize
            </button>
          )}
        </div>
      </div>

      {/* Interactive scrolling Karaoke Display */}
      <div className="glass-panel" style={{ margin: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <h3 style={{ margin: 0, fontSize: '1.1rem' }}>Karaoke Prompter</h3>
          {!isRecording && (
            <button 
              className="glowing-button" 
              style={{ margin: 0, padding: '5px 12px', fontSize: '0.75rem' }}
              onClick={isSyncMode ? saveSyncedLyrics : startSyncEditor}
            >
              {isSyncMode ? '✓ Save Synced Timestamps' : '⚙ Sync Prompter Timestamps'}
            </button>
          )}
        </div>

        {isSyncMode ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
            <div className="karaoke-container" ref={lyricsContainerRef} style={{ height: '140px' }}>
              {lyricsLines.map((line, idx) => (
                <div 
                  key={idx} 
                  className={`karaoke-line ${idx === activeLineIdx ? 'active' : ''}`}
                >
                  {line} {syncedTimestamps[idx] && <span style={{ color: 'var(--secondary-glow)', fontSize: '0.8rem' }}>({syncedTimestamps[idx].time}s)</span>}
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.9rem', color: 'var(--text-dim)' }}>Playback: {syncPlaybackTime.toFixed(1)}s</span>
              <button className="glowing-button secondary" onClick={handleTapSync} style={{ margin: 0 }}>
                TAP SYNC ACTIVE LINE
              </button>
            </div>
          </div>
        ) : (
          <div className="karaoke-container" ref={lyricsContainerRef}>
            {lyricsLines.map((line, idx) => (
              <div 
                key={idx} 
                className={`karaoke-line ${idx === activeLineIdx ? 'active' : idx < activeLineIdx ? 'passed' : ''}`}
              >
                {line}
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  );
};

export default RecordingStudio;
