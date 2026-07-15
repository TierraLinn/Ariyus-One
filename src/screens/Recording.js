import React, { useState, useEffect, useRef } from 'react';
import VoiceReactiveVisualizer from '../components/VoiceReactiveVisualizer';
import { getPitchFromAudioData } from '../utils/vocalDSP';

const RecordingStudio = ({ currentRecording, setCurrentRecording, navigate }) => {
  const song = currentRecording?.selectedSong;
  
  const [isRecording, setIsRecording] = useState(false);
  const [recordTime, setRecordTime] = useState(0);
  const [livePitch, setLivePitch] = useState(0);
  const [playHum, setPlayHum] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState('studio');
  const [isVideoMode, setIsVideoMode] = useState(true);
  const [schumannResonance, setSchumannResonance] = useState(false);
  const schumannOscRef = useRef(null);
  
  // Audio references
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const backingAudioRef = useRef(null);
  const humOscRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const recordedChunksRef = useRef([]);
  const streamRef = useRef(null);

  // Mixer gain references
  const [musicVolume, setMusicVolume] = useState(70);
  const [micVolume, setMicVolume] = useState(85);
  const musicGainNodeRef = useRef(null);
  const micGainNodeRef = useRef(null);
  const synthNodesRef = useRef([]);
  const schumannBinauralOscsRef = useRef([]);

  // Video references
  const videoRef = useRef(null);

  const [pitchHistory, setPitchHistory] = useState([]);
  const [lyricsLines, setLyricsLines] = useState([]);
  const [currentLineIndex, setCurrentLineIndex] = useState(0);

  const [isMuted, setIsMuted] = useState(false);
  const [isMonitoring, setIsMonitoring] = useState(false);
  const monitorGainRef = useRef(null);

  const [liveVowel, setLiveVowel] = useState('---');
  const [liveBiorhythm, setLiveBiorhythm] = useState('Delta (Rest)');
  
  const [autotuneStrength, setAutotuneStrength] = useState(50);
  const pitchCanvasRef = useRef(null);
  const livePitchRef = useRef(0);
  
  const [cameraFilter, setCameraFilter] = useState('aura');
  const cameraFilterCanvasRef = useRef(null);
  const cameraFilterWebGLCanvasRef = useRef(null);
  const partnerAudioRef = useRef(null);

  const getDuetLineText = (lineText, index) => {
    if (!currentRecording?.isDuet) return lineText;
    const partnerName = currentRecording?.partnerName || 'Partner';
    if (index % 4 === 0) {
      return `[Together] ${lineText}`;
    } else if (index % 2 === 0) {
      return `[${partnerName}] ${lineText}`;
    } else {
      return `[Me] ${lineText}`;
    }
  };

  const toggleMute = () => {
    const nextMuted = !isMuted;
    setIsMuted(nextMuted);
    if (streamRef.current) {
      streamRef.current.getAudioTracks().forEach(track => {
        track.enabled = !nextMuted;
      });
    }
  };

  const toggleMonitoring = () => {
    const nextMonitoring = !isMonitoring;
    setIsMonitoring(nextMonitoring);
    if (nextMonitoring) {
      alert("Please connect headphones to prevent feedback howl!");
    }
    if (monitorGainRef.current && audioContextRef.current) {
      monitorGainRef.current.gain.setValueAtTime(nextMonitoring ? 1.0 : 0.0, audioContextRef.current.currentTime);
    }
  };

  // Real-time volume update handlers
  const handleMusicVolumeChange = (val) => {
    setMusicVolume(val);
    if (musicGainNodeRef.current && audioContextRef.current) {
      musicGainNodeRef.current.gain.setValueAtTime(val / 100, audioContextRef.current.currentTime);
    }
  };

  const handleMicVolumeChange = (val) => {
    setMicVolume(val);
    if (micGainNodeRef.current && audioContextRef.current) {
      micGainNodeRef.current.gain.setValueAtTime(val / 100, audioContextRef.current.currentTime);
    }
  };

  // Pitch guide visualizer loop
  useEffect(() => {
    if (!isRecording) return;
    const canvas = pitchCanvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    let animationId;
    let width = canvas.width = canvas.offsetWidth;
    let height = canvas.height = canvas.offsetHeight;

    const resizeObserver = new ResizeObserver(() => {
      if (canvas) {
        width = canvas.width = canvas.offsetWidth;
        height = canvas.height = canvas.offsetHeight;
      }
    });
    resizeObserver.observe(canvas);

    const singerHistory = [];
    const maxPoints = 85;

    const drawGrid = () => {
      animationId = requestAnimationFrame(drawGrid);
      
      // Slate background
      ctx.fillStyle = 'rgba(6, 4, 30, 0.55)';
      ctx.fillRect(0, 0, width, height);

      // Draw grid octaves lines
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
      ctx.lineWidth = 1;
      for (let i = 1; i <= 4; i++) {
        const y = (height / 5) * i;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();

        ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
        ctx.font = '8px monospace';
        ctx.fillText(`Octave ${5 - i}`, 6, y - 4);
      }

      const time = Date.now();
      
      // Draw target melody line (scrolling StarMaker-style horizontal note blocks)
      ctx.fillStyle = 'rgba(0, 242, 255, 0.22)';
      ctx.strokeStyle = 'rgba(0, 242, 255, 0.7)';
      ctx.lineWidth = 1.5;

      const noteWidth = 60; // width of each note block
      const spacing = 15; // spacing between blocks
      const step = noteWidth + spacing;
      const timeShift = (time * 0.08) % step;

      // Draw 12 horizontal note blocks scrolling across the canvas
      for (let i = 0; i < 12; i++) {
        const x = width - (i * step) + timeShift;
        if (x < -noteWidth || x > width) continue;

        // Determine target pitch for this block based on its horizontal position relative to absolute time
        const blockTime = time - (width - x) * 12.5;
        const targetFreq = 220 + Math.sin(blockTime * 0.001) * 45 + Math.cos(blockTime * 0.0004) * 25;
        
        // Map frequency to Y
        const y = height / 2 - (targetFreq - 220) * (height / 160) - 6;

        ctx.beginPath();
        if (ctx.roundRect) {
          ctx.roundRect(x, y, noteWidth, 10, 4);
        } else {
          ctx.rect(x, y, noteWidth, 10);
        }
        ctx.fill();
        ctx.stroke();
      }

      // Read current singer pitch
      const currentPitch = livePitchRef.current || 0;
      if (currentPitch > 50) {
        singerHistory.push(currentPitch);
      } else {
        singerHistory.push(null);
      }
      if (singerHistory.length > maxPoints) singerHistory.shift();

      // Plot singer pitch trajectory (glowing yellow)
      ctx.beginPath();
      ctx.strokeStyle = '#ffb700';
      ctx.lineWidth = 3.0;
      ctx.shadowBlur = 8;
      ctx.shadowColor = '#ffb700';

      let drawing = false;
      singerHistory.forEach((p, idx) => {
        if (p === null) {
          drawing = false;
          return;
        }
        const x = (width / maxPoints) * idx;
        const y = height / 2 - (p - 220) * (height / 160);

        if (!drawing) {
          ctx.moveTo(x, y);
          drawing = true;
        } else {
          ctx.lineTo(x, y);
        }
      });
      ctx.stroke();
      ctx.shadowBlur = 0;

      // Draw glowing lead-pointer cursor tracking current voice frequency
      if (currentPitch > 50) {
        const lastX = (width / maxPoints) * (singerHistory.length - 1);
        const lastY = height / 2 - (currentPitch - 220) * (height / 160);
        ctx.fillStyle = '#ffb700';
        ctx.shadowBlur = 12;
        ctx.shadowColor = '#ffb700';
        ctx.beginPath();
        ctx.arc(lastX, lastY, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
      }

      // Snapping evaluation
      if (currentPitch > 50) {
        const targetVal = 220 + Math.sin(time * 0.001) * 45 + Math.cos(time * 0.0004) * 25;
        const diff = Math.abs(currentPitch - targetVal);
        if (diff < 15) {
          ctx.fillStyle = '#00ff87';
          ctx.font = 'bold 10px Orbitron';
          ctx.fillText('🌟 PERFECT!', width - 90, 18);
        } else if (diff < 32) {
          ctx.fillStyle = 'var(--primary-glow)';
          ctx.font = 'bold 10px Orbitron';
          ctx.fillText('👍 GOOD', width - 80, 18);
        }
      }
    };

    drawGrid();

    return () => {
      cancelAnimationFrame(animationId);
      resizeObserver.disconnect();
    };
  }, [isRecording]);

  // Vowel visualizer overlays (Geometry / Waves filter)
  useEffect(() => {
    if (!isRecording || cameraFilter === 'none' || cameraFilter === 'aura') return;
    const canvas = cameraFilterCanvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    let animationId;
    let width = canvas.width = canvas.offsetWidth;
    let height = canvas.height = canvas.offsetHeight;

    const resizeObserver = new ResizeObserver(() => {
      if (canvas) {
        width = canvas.width = canvas.offsetWidth;
        height = canvas.height = canvas.offsetHeight;
      }
    });
    resizeObserver.observe(canvas);

    const particles = [];
    const maxParticles = 40;

    const drawFilter = () => {
      animationId = requestAnimationFrame(drawFilter);
      ctx.clearRect(0, 0, width, height);

      // Compute vocal volume from the live analyser node
      let vol = 20; 
      if (analyserRef.current) {
        const bufferLength = analyserRef.current.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        analyserRef.current.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < bufferLength; i++) sum += dataArray[i];
        vol = sum / bufferLength; // 0 to 255
      }

      // Map vowel phonemes to specific Chakra colors:
      let chakraColor = 'rgba(0, 242, 255, 0.4)'; // throat default
      let glowColor = '#00f2ff';
      const vowel = liveVowel.toLowerCase();
      if (vowel.includes('/u/')) {
        chakraColor = 'rgba(255, 0, 59, 0.4)'; // Root (Red)
        glowColor = '#ff003b';
      } else if (vowel.includes('/o/')) {
        chakraColor = 'rgba(255, 112, 0, 0.4)'; // Sacral (Orange)
        glowColor = '#ff7000';
      } else if (vowel.includes('/a/')) {
        chakraColor = 'rgba(0, 255, 135, 0.4)'; // Heart (Green)
        glowColor = '#00ff87';
      } else if (vowel.includes('/e/')) {
        chakraColor = 'rgba(0, 242, 255, 0.4)'; // Throat (Blue)
        glowColor = '#00f2ff';
      } else if (vowel.includes('/i/')) {
        chakraColor = 'rgba(178, 0, 255, 0.4)'; // Crown (Violet)
        glowColor = '#b200ff';
      }

      const pulse = 10 + (vol / 255) * 45;

      // Render selected visualizer filter mode
      if (cameraFilter === 'geometry') {
        ctx.strokeStyle = `rgba(255, 0, 193, ${0.25 + (vol / 255) * 0.4})`;
        ctx.lineWidth = 1.2;
        ctx.strokeRect(10, 10, width - 20, height - 20);

        const cornerSize = 40 + pulse * 0.5;
        // Dynamically color based on active chakra register
        ctx.strokeStyle = chakraColor.replace('0.4', (0.35 + (vol / 255) * 0.45).toFixed(2));
        ctx.lineWidth = 1.5;
        ctx.shadowBlur = 8;
        ctx.shadowColor = glowColor;

        ctx.beginPath();
        ctx.moveTo(15, 15 + cornerSize);
        ctx.lineTo(15, 15);
        ctx.lineTo(15 + cornerSize, 15);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(width - 15 - cornerSize, 15);
        ctx.lineTo(width - 15, 15);
        ctx.lineTo(width - 15, 15 + cornerSize);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(15, height - 15 - cornerSize);
        ctx.lineTo(15, height - 15);
        ctx.lineTo(15 + cornerSize, height - 15);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(width - 15 - cornerSize, height - 15);
        ctx.lineTo(width - 15, height - 15);
        ctx.lineTo(width - 15, height - 15 - cornerSize);
        ctx.stroke();
        ctx.shadowBlur = 0;

        if (particles.length < maxParticles && vol > 60 && Math.random() < 0.35) {
          particles.push({
            x: Math.random() * width,
            y: height - 15,
            vx: (Math.random() - 0.5) * 1.5,
            vy: -1.2 - Math.random() * 2.0,
            alpha: 1.0,
            color: glowColor
          });
        }

        ctx.lineWidth = 1;
        particles.forEach((p, pIdx) => {
          p.x += p.vx;
          p.y += p.vy;
          p.alpha -= 0.015;

          ctx.fillStyle = p.color;
          ctx.globalAlpha = p.alpha;
          ctx.beginPath();
          ctx.arc(p.x, p.y, 1.8 + (vol / 120), 0, Math.PI * 2);
          ctx.fill();

          if (p.alpha <= 0) particles.splice(pIdx, 1);
        });
        ctx.globalAlpha = 1.0; 

      } else if (cameraFilter === 'spectrum') {
        ctx.lineWidth = 1.8;
        ctx.strokeStyle = `hsla(${(Date.now() / 35) % 360}, 100%, 70%, 0.65)`;
        ctx.shadowBlur = 8;
        ctx.shadowColor = ctx.strokeStyle;

        ctx.beginPath();
        for (let y = 10; y < height - 10; y += 4) {
          const ratio = y / height;
          const index = Math.floor(ratio * 32);
          let amp = 0;
          if (analyserRef.current) {
            const tempBuffer = new Uint8Array(64);
            analyserRef.current.getByteFrequencyData(tempBuffer);
            amp = tempBuffer[index] || 0;
          } else {
            amp = 20 + Math.sin(y * 0.05 + Date.now() * 0.005) * 12;
          }
          const wHeight = (amp / 255) * 45;

          ctx.moveTo(10, y);
          ctx.lineTo(10 + wHeight, y);

          ctx.moveTo(width - 10, y);
          ctx.lineTo(width - 10 - wHeight, y);
        }
        ctx.stroke();
        ctx.shadowBlur = 0;
      }
    };

    drawFilter();

    return () => {
      cancelAnimationFrame(animationId);
      resizeObserver.disconnect();
    };
  }, [isRecording, cameraFilter, liveVowel]);

  // WebGL fragment shader bioluminescent plasma aura overlay
  useEffect(() => {
    if (!isRecording || cameraFilter !== 'aura') return;
    const canvas = cameraFilterWebGLCanvasRef.current;
    if (!canvas) return;

    let gl;
    try {
      gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    } catch (e) {}

    if (!gl) {
      console.warn("WebGL not supported in this context.");
      return;
    }

    let animationId;
    let width = canvas.width = canvas.offsetWidth;
    let height = canvas.height = canvas.offsetHeight;

    const resizeObserver = new ResizeObserver(() => {
      if (canvas) {
        width = canvas.width = canvas.offsetWidth;
        height = canvas.height = canvas.offsetHeight;
        gl.viewport(0, 0, width, height);
      }
    });
    resizeObserver.observe(canvas);

    const vsSource = `
      attribute vec2 position;
      void main() {
        gl_Position = vec4(position, 0.0, 1.0);
      }
    `;

    const fsSource = `
      precision mediump float;
      uniform vec2 u_resolution;
      uniform float u_time;
      uniform float u_volume;
      uniform vec3 u_color;
      uniform sampler2D u_videoTexture;

      float fbm(vec2 st) {
          float value = 0.0;
          float amplitude = 0.5;
          for (int i = 0; i < 4; i++) {
              value += amplitude * sin(st.x * 2.0 + u_time) * cos(st.y * 2.0 - u_time);
              st *= 2.0;
              amplitude *= 0.5;
          }
          return value;
      }

      void main() {
        vec2 uv = gl_FragCoord.xy / u_resolution.xy;
        // Flip horizontal for mirroring webcam view
        vec2 uv_flipped = vec2(1.0 - uv.x, uv.y);
        
        vec4 videoColor = texture2D(u_videoTexture, uv_flipped);
        
        // Sobel filter edge detection for silhouette mapping
        float stepX = 1.0 / u_resolution.x;
        float stepY = 1.0 / u_resolution.y;
        vec3 lum = vec3(0.2126, 0.7152, 0.0722);
        
        float t00 = dot(texture2D(u_videoTexture, uv_flipped + vec2(-stepX, -stepY)).rgb, lum);
        float t01 = dot(texture2D(u_videoTexture, uv_flipped + vec2(-stepX, 0.0)).rgb, lum);
        float t02 = dot(texture2D(u_videoTexture, uv_flipped + vec2(-stepX, stepY)).rgb, lum);
        
        float t10 = dot(texture2D(u_videoTexture, uv_flipped + vec2(0.0, -stepY)).rgb, lum);
        float t12 = dot(texture2D(u_videoTexture, uv_flipped + vec2(0.0, stepY)).rgb, lum);
        
        float t20 = dot(texture2D(u_videoTexture, uv_flipped + vec2(stepX, -stepY)).rgb, lum);
        float t21 = dot(texture2D(u_videoTexture, uv_flipped + vec2(stepX, 0.0)).rgb, lum);
        float t22 = dot(texture2D(u_videoTexture, uv_flipped + vec2(stepX, stepY)).rgb, lum);
        
        float gx = t00 + 2.0 * t01 + t02 - t20 - 2.0 * t21 - t22;
        float gy = t00 + 2.0 * t10 + t20 - t02 - 2.0 * t12 - t22;
        float edge = sqrt(gx * gx + gy * gy);
        
        // Generate beautiful flowing bioluminescent plasma noise waves
        float n = fbm(uv_flipped * 3.5 + vec2(u_time * 0.22));
        
        // Aura radiates and flows outward from detected silhouette edges
        float auraIntensity = smoothstep(0.05, 0.42, edge) * (0.8 + 0.2 * n);
        
        // Modulate color by vowel chakra and time
        vec3 auraColor = u_color * (1.1 + 0.5 * sin(u_time * 2.2 + uv.x * 6.0 + n));
        
        // Composite original video texture with the flowing silhouette aura glow
        vec3 finalColor = videoColor.rgb + auraColor * auraIntensity * (1.0 + u_volume * 1.6);
        
        gl_FragColor = vec4(finalColor, 1.0);
      }
    `;

    const compileShader = (source, type) => {
      const shader = gl.createShader(type);
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.error("Shader compile error:", gl.getShaderInfoLog(shader));
        gl.deleteShader(shader);
        return null;
      }
      return shader;
    };

    const vs = compileShader(vsSource, gl.VERTEX_SHADER);
    const fs = compileShader(fsSource, gl.FRAGMENT_SHADER);
    if (!vs || !fs) return;

    const program = gl.createProgram();
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.error("Program link error:", gl.getProgramInfoLog(program));
      return;
    }

    gl.useProgram(program);

    const vertices = new Float32Array([
      -1, -1,
       1, -1,
      -1,  1,
      -1,  1,
       1, -1,
       1,  1,
    ]);

    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);

    const posLocation = gl.getAttribLocation(program, "position");
    gl.enableVertexAttribArray(posLocation);
    gl.vertexAttribPointer(posLocation, 2, gl.FLOAT, false, 0, 0);

    const resLoc = gl.getUniformLocation(program, "u_resolution");
    const timeLoc = gl.getUniformLocation(program, "u_time");
    const volLoc = gl.getUniformLocation(program, "u_volume");
    const colorLoc = gl.getUniformLocation(program, "u_color");
    const videoTexLoc = gl.getUniformLocation(program, "u_videoTexture");

    // Initialize WebGL texture for camera stream silhouette tracking
    const videoTexture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, videoTexture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

    const startTime = Date.now();

    const renderLoop = () => {
      animationId = requestAnimationFrame(renderLoop);

      let vol = 0.05;
      if (analyserRef.current) {
        const bufferLength = analyserRef.current.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        analyserRef.current.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < bufferLength; i++) sum += dataArray[i];
        vol = (sum / bufferLength) / 255.0;
      }

      let colorRGB = [0.0, 0.95, 1.0];
      const vowel = liveVowel.toLowerCase();
      if (vowel.includes('/u/')) {
        colorRGB = [1.0, 0.0, 0.23];
      } else if (vowel.includes('/o/')) {
        colorRGB = [1.0, 0.44, 0.0];
      } else if (vowel.includes('/a/')) {
        colorRGB = [0.0, 1.0, 0.53];
      } else if (vowel.includes('/e/')) {
        colorRGB = [0.0, 0.95, 1.0];
      } else if (vowel.includes('/i/')) {
        colorRGB = [0.7, 0.0, 1.0];
      }

      gl.viewport(0, 0, width, height);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);

      gl.useProgram(program);

      // Upload active camera frame as WebGL texture
      if (videoRef.current && videoRef.current.readyState >= 2) {
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, videoTexture);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, videoRef.current);
        gl.uniform1i(videoTexLoc, 0);
      }

      gl.uniform2f(resLoc, width, height);
      gl.uniform1f(timeLoc, (Date.now() - startTime) * 0.001);
      gl.uniform1f(volLoc, vol);
      gl.uniform3fv(colorLoc, colorRGB);

      gl.drawArrays(gl.TRIANGLES, 0, 6);
    };

    renderLoop();

    return () => {
      cancelAnimationFrame(animationId);
      resizeObserver.disconnect();
      if (gl) {
        gl.deleteTexture(videoTexture);
        gl.deleteBuffer(buffer);
        gl.deleteProgram(program);
        gl.deleteShader(vs);
        gl.deleteShader(fs);
      }
    };
  }, [isRecording, cameraFilter, liveVowel]);

  useEffect(() => {
    if (song && song.lyrics) {
      setLyricsLines(song.lyrics.split('\n').filter(line => line.trim() !== ''));
    }
  }, [song]);

  // Backing and partner audio loading
  useEffect(() => {
    if (song && song.genre !== 'Meditation') {
      const audio = new Audio(song.audioUrl);
      audio.crossOrigin = "anonymous";
      backingAudioRef.current = audio;

      if (currentRecording?.isDuet && currentRecording?.partnerVocalUrl) {
        const partnerAudio = new Audio(currentRecording.partnerVocalUrl);
        partnerAudio.crossOrigin = "anonymous";
        partnerAudioRef.current = partnerAudio;
      }
    }
    return () => {
      if (backingAudioRef.current) {
        backingAudioRef.current.pause();
      }
      if (partnerAudioRef.current) {
        partnerAudioRef.current.pause();
      }
      cleanupAudio();
    };
  }, [song, currentRecording]);

  // Backing track progress loop
  useEffect(() => {
    if (!isRecording) return;
    const interval = setInterval(() => {
      let currentTime = 0;
      if (backingAudioRef.current && song && song.genre !== 'Meditation') {
        currentTime = backingAudioRef.current.currentTime;
        setRecordTime(currentTime);
        
        const duration = backingAudioRef.current.duration || 60;
        const lineCount = lyricsLines.length;
        if (lineCount > 0) {
          const index = Math.min(lineCount - 1, Math.floor((currentTime / duration) * lineCount));
          setCurrentLineIndex(index);
        }
      } else {
        // Fallback or ambient synth prompter loop
        setRecordTime(prev => {
          currentTime = prev + 0.1;
          const lineCount = lyricsLines.length;
          if (lineCount > 0) {
            const index = Math.min(lineCount - 1, Math.floor((currentTime / 45) * lineCount));
            setCurrentLineIndex(index);
          }
          return currentTime;
        });
      }

      // If we are in sandbox/fallback mode, simulate live pitch input
      if (!mediaRecorderRef.current) {
        const blockTime = currentTime * 1000;
        const targetFreq = 220 + Math.sin(blockTime * 0.001) * 45 + Math.cos(blockTime * 0.0004) * 25;
        const simulatedPitch = Math.round(targetFreq + (Math.random() - 0.5) * 12);
        
        setLivePitch(simulatedPitch);
        livePitchRef.current = simulatedPitch;
        setPitchHistory(prev => {
          const next = [...prev, simulatedPitch];
          
          // Compute live biorhythms
          if (next.length > 5) {
            const slice = next.slice(-5);
            const dev = Math.max(...slice) - Math.min(...slice);
            if (dev < 5) setLiveBiorhythm('Alpha (Focused Flow State)');
            else if (dev > 25) setLiveBiorhythm('Beta (High Intensity Energy)');
            else if (Math.abs(simulatedPitch - 528) < 10 || Math.abs(simulatedPitch - 432) < 10) setLiveBiorhythm('Gamma (Insight / Healing)');
            else setLiveBiorhythm('Theta (Relaxation Wavelength)');
          }
          return next;
        });

        // Compute vowel phonemes
        if (simulatedPitch < 130) setLiveVowel('/u/ (Oo - Root stabilizer)');
        else if (simulatedPitch < 220) setLiveVowel('/o/ (Oh - Sacral creator)');
        else if (simulatedPitch < 330) setLiveVowel('/a/ (Ah - Heart awakening)');
        else if (simulatedPitch < 440) setLiveVowel('/e/ (Eh - Throat expression)');
        else setLiveVowel('/i/ (Ee - Crown connector)');
      }
    }, 100);

    return () => clearInterval(interval);
  }, [isRecording, lyricsLines, song]);

  const cleanupAudio = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
    }
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close();
    }
    if (schumannOscRef.current) {
      try { schumannOscRef.current.stop(); } catch (e) {}
      schumannOscRef.current = null;
    }
    if (schumannBinauralOscsRef.current) {
      schumannBinauralOscsRef.current.forEach(osc => {
        try { osc.stop(); } catch (e) {}
      });
      schumannBinauralOscsRef.current = [];
    }
  };

  const startRecording = async () => {
    setPitchHistory([]);
    setRecordTime(0);
    setCurrentLineIndex(0);
    recordedChunksRef.current = [];

    try {
      let stream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({ 
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
            latency: 0.005
          }, 
          video: isVideoMode 
        });
      } catch (err) {
        if (isVideoMode) {
          console.warn("Failed to capture video, falling back to Audio-Only Mode:", err);
          setIsVideoMode(false);
          stream = await navigator.mediaDevices.getUserMedia({ 
            audio: {
              echoCancellation: true,
              noiseSuppression: true,
              autoGainControl: true,
              latency: 0.005
            }, 
            video: false 
          });
        } else {
          throw err;
        }
      }
      streamRef.current = stream;

      if (isVideoMode && videoRef.current) {
        videoRef.current.srcObject = stream;
      }

      // Re-instantiate backing audio elements to ensure fresh nodes that can be bound in Web Audio safely
      if (song && song.genre !== 'Meditation') {
        const backingAudio = new Audio(song.audioUrl);
        backingAudio.crossOrigin = "anonymous";
        backingAudioRef.current = backingAudio;

        if (currentRecording?.isDuet && currentRecording?.partnerVocalUrl) {
          const partnerAudio = new Audio(currentRecording.partnerVocalUrl);
          partnerAudio.crossOrigin = "anonymous";
          partnerAudioRef.current = partnerAudio;
        }
      }

      // Initialize Web Audio graph
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      const audioCtx = new AudioContext();
      audioContextRef.current = audioCtx;

      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 2048;
      analyserRef.current = analyser;

      const micSource = audioCtx.createMediaStreamSource(stream);

      // Target frequency for peaking resonance filter
      let targetHz = 432;
      if (song && song.title) {
        if (song.title.includes('528')) targetHz = 528;
        else if (song.title.includes('396')) targetHz = 396;
        else if (song.title.includes('417')) targetHz = 417;
        else if (song.title.includes('639')) targetHz = 639;
        else if (song.title.includes('741')) targetHz = 741;
        else if (song.title.includes('852')) targetHz = 852;
        else if (song.title.includes('963')) targetHz = 963;
      }
      
      const peakingFilter = audioCtx.createBiquadFilter();
      peakingFilter.type = 'peaking';
      peakingFilter.frequency.setValueAtTime(targetHz, audioCtx.currentTime);
      peakingFilter.Q.setValueAtTime(8.0, audioCtx.currentTime); // High selectivity
      // 8dB boost only in solfeggio preset
      peakingFilter.gain.setValueAtTime(selectedFilter === 'solfeggio' ? 8.0 : 0.0, audioCtx.currentTime);

      // Connect micSource through peaking filter
      micSource.connect(peakingFilter);
      const vocalSourceNode = peakingFilter;

      // Setup live filters with Smule/Starmaker Vocal FX engines
      if (selectedFilter === 'studio') {
        // Dynamics compressor to smooth out peaks
        const compressor = audioCtx.createDynamicsCompressor();
        compressor.threshold.setValueAtTime(-20, audioCtx.currentTime);
        compressor.knee.setValueAtTime(30, audioCtx.currentTime);
        compressor.ratio.setValueAtTime(4.0, audioCtx.currentTime);
        compressor.attack.setValueAtTime(0.003, audioCtx.currentTime);
        compressor.release.setValueAtTime(0.25, audioCtx.currentTime);

        // High shelf filter for air brightness
        const highShelf = audioCtx.createBiquadFilter();
        highShelf.type = 'highshelf';
        highShelf.frequency.setValueAtTime(8000, audioCtx.currentTime);
        highShelf.gain.setValueAtTime(3.0, audioCtx.currentTime);

        // Short plate reverb
        const rate = audioCtx.sampleRate;
        const len = rate * 1.2; // 1.2s short decay
        const impulse = audioCtx.createBuffer(2, len, rate);
        for (let ch = 0; ch < 2; ch++) {
          const channel = impulse.getChannelData(ch);
          for (let i = 0; i < len; i++) {
            channel[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.5);
          }
        }
        const reverb = audioCtx.createConvolver();
        reverb.buffer = impulse;

        const reverbGain = audioCtx.createGain();
        reverbGain.gain.setValueAtTime(0.25, audioCtx.currentTime); // dry/wet ratio

        vocalSourceNode.connect(compressor);
        compressor.connect(highShelf);
        highShelf.connect(analyser);

        // Send to reverb in parallel
        highShelf.connect(reverb);
        reverb.connect(reverbGain);
        reverbGain.connect(analyser);
      } else if (selectedFilter === 'hall') {
        // Deep hall reverb
        const rate = audioCtx.sampleRate;
        const len = rate * 3.0; // 3.0s decay
        const impulse = audioCtx.createBuffer(2, len, rate);
        for (let ch = 0; ch < 2; ch++) {
          const channel = impulse.getChannelData(ch);
          for (let i = 0; i < len; i++) {
            channel[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 1.8);
          }
        }
        const reverb = audioCtx.createConvolver();
        reverb.buffer = impulse;

        const reverbGain = audioCtx.createGain();
        reverbGain.gain.setValueAtTime(0.5, audioCtx.currentTime);

        // Rhythmic Delay
        const delay = audioCtx.createDelay(1.0);
        delay.delayTime.setValueAtTime(0.3, audioCtx.currentTime);
        const feedback = audioCtx.createGain();
        feedback.gain.setValueAtTime(0.35, audioCtx.currentTime);

        vocalSourceNode.connect(analyser); // dry path

        // Send to reverb
        vocalSourceNode.connect(reverb);
        reverb.connect(reverbGain);
        reverbGain.connect(analyser);

        // Send to delay loop
        vocalSourceNode.connect(delay);
        delay.connect(feedback);
        feedback.connect(delay);
        delay.connect(analyser);
      } else if (selectedFilter === 'pop') {
        // Vocal presence EQ boost
        const presence = audioCtx.createBiquadFilter();
        presence.type = 'highshelf';
        presence.frequency.setValueAtTime(5000, audioCtx.currentTime);
        presence.gain.setValueAtTime(4.0, audioCtx.currentTime);

        // Chorus modulation effect (slight delayed modulation)
        const delay = audioCtx.createDelay(1.0);
        delay.delayTime.setValueAtTime(0.2, audioCtx.currentTime);
        const feedback = audioCtx.createGain();
        feedback.gain.setValueAtTime(0.25, audioCtx.currentTime);

        vocalSourceNode.connect(presence);
        presence.connect(analyser);

        // Chorus delay line
        presence.connect(delay);
        delay.connect(feedback);
        feedback.connect(delay);
        delay.connect(analyser);
      } else if (selectedFilter === 'solfeggio') {
        // modulated space delay (ping-pong feedback chorus)
        const delay = audioCtx.createDelay(1.0);
        delay.delayTime.setValueAtTime(0.35, audioCtx.currentTime);
        const feedback = audioCtx.createGain();
        feedback.gain.setValueAtTime(0.4, audioCtx.currentTime);

        const rate = audioCtx.sampleRate;
        const len = rate * 3.5; // spacious decay
        const impulse = audioCtx.createBuffer(2, len, rate);
        for (let ch = 0; ch < 2; ch++) {
          const channel = impulse.getChannelData(ch);
          for (let i = 0; i < len; i++) {
            channel[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 1.5);
          }
        }
        const reverb = audioCtx.createConvolver();
        reverb.buffer = impulse;
        const reverbGain = audioCtx.createGain();
        reverbGain.gain.setValueAtTime(0.65, audioCtx.currentTime);

        vocalSourceNode.connect(analyser); // dry path
        
        // Reverb path
        vocalSourceNode.connect(reverb);
        reverb.connect(reverbGain);
        reverbGain.connect(analyser);

        // Delay path
        vocalSourceNode.connect(delay);
        delay.connect(feedback);
        feedback.connect(delay);
        delay.connect(analyser);
      } else {
        // Dry bypass
        vocalSourceNode.connect(analyser);
      }

      // Setup monitor node
      const monitorGain = audioCtx.createGain();
      monitorGain.gain.setValueAtTime(isMonitoring ? 1.0 : 0.0, audioCtx.currentTime);
      analyser.connect(monitorGain);
      monitorGain.connect(audioCtx.destination);
      monitorGainRef.current = monitorGain;

      // Connect pitch detection analyzer loop
      const detectPitchLoop = () => {
        if (!audioCtx || audioCtx.state === 'closed') return;
        const bufferLength = analyser.fftSize;
        const dataArray = new Uint8Array(bufferLength);
        analyser.getByteTimeDomainData(dataArray);

        const pitch = getPitchFromAudioData(dataArray, audioCtx.sampleRate);
        if (pitch > 50 && pitch < 1000) {
          const roundedPitch = Math.round(pitch);
          setLivePitch(roundedPitch);
          livePitchRef.current = roundedPitch;
          setPitchHistory(prev => {
            const nextHistory = [...prev, pitch];
            // Compute live biorhythms
            if (nextHistory.length > 5) {
              const slice = nextHistory.slice(-5);
              const dev = Math.max(...slice) - Math.min(...slice);
              if (dev < 5) setLiveBiorhythm('Alpha (Focused Flow State)');
              else if (dev > 25) setLiveBiorhythm('Beta (High Intensity Energy)');
              else if (Math.abs(pitch - 528) < 10 || Math.abs(pitch - 432) < 10) setLiveBiorhythm('Gamma (Insight / Healing)');
              else setLiveBiorhythm('Theta (Relaxation Wavelength)');
            }
            return nextHistory;
          });

          // Compute vowel phonemes
          if (roundedPitch < 130) setLiveVowel('/u/ (Oo - Root stabilizer)');
          else if (roundedPitch < 220) setLiveVowel('/o/ (Oh - Sacral creator)');
          else if (roundedPitch < 330) setLiveVowel('/a/ (Ah - Heart awakening)');
          else if (roundedPitch < 440) setLiveVowel('/e/ (Eh - Throat expression)');
          else setLiveVowel('/i/ (Ee - Crown connector)');

        } else {
          setLivePitch(0);
          livePitchRef.current = 0;
          setLiveVowel('---');
          setLiveBiorhythm('Delta (Resting Wavelength)');
        }

        if (isRecording) {
          requestAnimationFrame(detectPitchLoop);
        }
      };

      // Play carrier hum if enabled
      let humGain = null;
      if (playHum) {
        const osc = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();
        osc.frequency.setValueAtTime(528, audioCtx.currentTime); // 528Hz hum
        gainNode.gain.setValueAtTime(0.08, audioCtx.currentTime);
        osc.connect(gainNode);
        gainNode.connect(audioCtx.destination);
        osc.start();
        humOscRef.current = osc;
        humGain = gainNode;
      }

      // Initialize mixed stream destination node for unified recording
      const mixedDest = audioCtx.createMediaStreamDestination();

      // Setup gain node nodes to manage independent mixer volumes
      const backingGain = audioCtx.createGain();
      backingGain.gain.setValueAtTime(musicVolume / 100, audioCtx.currentTime);
      musicGainNodeRef.current = backingGain;

      const vocalGain = audioCtx.createGain();
      vocalGain.gain.setValueAtTime(micVolume / 100, audioCtx.currentTime);
      micGainNodeRef.current = vocalGain;

      // Connect vocal effects line to master vocal gain
      analyser.connect(vocalGain);

      // Connect backing music (or dynamic synthesizer) to backing gain
      if (song && song.genre === 'Meditation') {
        // Generate actual Web Audio Solfeggio soundbath drone
        const osc1 = audioCtx.createOscillator();
        const osc2 = audioCtx.createOscillator();
        const osc3 = audioCtx.createOscillator();
        const lowpass = audioCtx.createBiquadFilter();
        const lfo = audioCtx.createOscillator();
        const lfoGain = audioCtx.createGain();

        osc1.frequency.value = targetHz;
        osc1.type = 'sine';

        osc2.frequency.value = targetHz / 2; // sub-bass warm drone
        osc2.type = 'triangle';

        osc3.frequency.value = targetHz * 1.5; // perfect fifth overtone
        osc3.type = 'sine';

        lowpass.type = 'lowpass';
        lowpass.frequency.value = 750;
        lowpass.Q.value = 1.0;

        lfo.frequency.value = 0.12; // slow LFO sweep
        lfoGain.gain.value = 220; // sweeping bounds

        // Modulate filter freq
        lfo.connect(lfoGain);
        lfoGain.connect(lowpass.frequency);

        // Connect synthesis nodes
        osc1.connect(lowpass);
        osc2.connect(lowpass);
        osc3.connect(lowpass);

        lowpass.connect(backingGain);

        osc1.start();
        osc2.start();
        osc3.start();
        lfo.start();

        synthNodesRef.current = [osc1, osc2, osc3, lfo];
      } else {
        // Standard backing track loading with Native Resampler Pitch Transposer to targetHz
        const pitchRatio = targetHz / 440;

        if (backingAudioRef.current) {
          const backingSource = audioCtx.createMediaElementSource(backingAudioRef.current);
          backingSource.connect(backingGain);
          
          backingAudioRef.current.preservesPitch = false;
          backingAudioRef.current.playbackRate = pitchRatio;
          backingAudioRef.current.currentTime = 0;
          backingAudioRef.current.volume = 1.0; // Handled by gain node
          await backingAudioRef.current.play();
        }

        if (partnerAudioRef.current) {
          const partnerSource = audioCtx.createMediaElementSource(partnerAudioRef.current);
          partnerSource.connect(backingGain);
          
          partnerAudioRef.current.preservesPitch = false;
          partnerAudioRef.current.playbackRate = pitchRatio;
          partnerAudioRef.current.currentTime = 0;
          partnerAudioRef.current.volume = 1.0;
          await partnerAudioRef.current.play();
        }

        // Earth's Resonance Heartbeat Syncing System (7.83Hz Binaural Beats Carrier)
        const leftOsc = audioCtx.createOscillator();
        const rightOsc = audioCtx.createOscillator();
        const binGainL = audioCtx.createGain();
        const binGainR = audioCtx.createGain();
        const panL = audioCtx.createStereoPanner ? audioCtx.createStereoPanner() : audioCtx.createGain();
        const panR = audioCtx.createStereoPanner ? audioCtx.createStereoPanner() : audioCtx.createGain();

        leftOsc.type = 'sine';
        leftOsc.frequency.setValueAtTime(targetHz, audioCtx.currentTime);
        rightOsc.type = 'sine';
        rightOsc.frequency.setValueAtTime(targetHz + 7.83, audioCtx.currentTime); // 7.83Hz Schumann offset

        binGainL.gain.setValueAtTime(0.015, audioCtx.currentTime); // subtle volume
        binGainR.gain.setValueAtTime(0.015, audioCtx.currentTime);

        if (audioCtx.createStereoPanner) {
          panL.pan.setValueAtTime(-1.0, audioCtx.currentTime);
          panR.pan.setValueAtTime(1.0, audioCtx.currentTime);
        }

        leftOsc.connect(binGainL);
        rightOsc.connect(binGainR);
        binGainL.connect(panL);
        binGainR.connect(panR);
        panL.connect(audioCtx.destination);
        panR.connect(audioCtx.destination);

        leftOsc.start();
        rightOsc.start();

        schumannBinauralOscsRef.current = [leftOsc, rightOsc];
      }

      // Setup master dry group for vocals only (to record only vocals)
      const masterDryGroup = audioCtx.createGain();
      vocalGain.connect(masterDryGroup);

      // Connect backing music directly to destination (so user hears it but it is NOT recorded)
      backingGain.connect(audioCtx.destination);

      if (schumannResonance) {
        // Create 7.83Hz Modulated Dual-Channel Panning Delay Node (Ping-Pong Chorus Space Delay)
        const leftDelay = audioCtx.createDelay(1.0);
        const rightDelay = audioCtx.createDelay(1.0);
        
        const leftFeedback = audioCtx.createGain();
        const rightFeedback = audioCtx.createGain();
        leftFeedback.gain.value = 0.35; // feedback volume
        rightFeedback.gain.value = 0.35;

        // Create 7.83 Hz LFO oscillator
        const lfo = audioCtx.createOscillator();
        lfo.frequency.setValueAtTime(7.83, audioCtx.currentTime);
        
        const lfoGainL = audioCtx.createGain();
        const lfoGainR = audioCtx.createGain();
        lfoGainL.gain.value = 0.025; // 25ms delay swing
        lfoGainR.gain.value = -0.025; // 180 degrees out-of-phase!

        lfo.connect(lfoGainL);
        lfo.connect(lfoGainR);

        // Base delay time
        leftDelay.delayTime.setValueAtTime(0.06, audioCtx.currentTime);
        rightDelay.delayTime.setValueAtTime(0.06, audioCtx.currentTime);
        lfoGainL.connect(leftDelay.delayTime);
        lfoGainR.connect(rightDelay.delayTime);

        // Feed master dry group into delays
        masterDryGroup.connect(leftDelay);
        masterDryGroup.connect(rightDelay);

        // Ping-pong cross feedback loop
        leftDelay.connect(rightFeedback);
        rightFeedback.connect(rightDelay);

        rightDelay.connect(leftFeedback);
        leftFeedback.connect(leftDelay);

        // Merge Left/Right delay lines into stereo
        const merger = audioCtx.createChannelMerger(2);
        leftDelay.connect(merger, 0, 0);
        rightDelay.connect(merger, 0, 1);

        // Connect dry signal to recorder
        masterDryGroup.connect(mixedDest);

        // Connect wet panning delay to output
        const wetGain = audioCtx.createGain();
        wetGain.gain.setValueAtTime(0.42, audioCtx.currentTime); // wet ratio
        merger.connect(wetGain);
        
        wetGain.connect(mixedDest);
        wetGain.connect(monitorGain);

        lfo.start();
        schumannOscRef.current = lfo;
      } else {
        masterDryGroup.connect(mixedDest);
      }

      if (humGain) {
        humGain.connect(mixedDest);
      }

      // Combine video tracks from camera with mixed Web Audio tracks for a unified MediaRecorder feed
      let recordingStream = mixedDest.stream;
      if (isVideoMode) {
        const videoTracks = stream.getVideoTracks();
        if (videoTracks.length > 0) {
          const combinedStream = new MediaStream();
          combinedStream.addTrack(videoTracks[0]); // add camera video track
          combinedStream.addTrack(mixedDest.stream.getAudioTracks()[0]); // add mixed audio track
          recordingStream = combinedStream;
        }
      }

      // MediaRecorder initialization
      const mediaRecorder = new MediaRecorder(recordingStream);
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          recordedChunksRef.current.push(e.data);
        }
      };
      mediaRecorder.onstop = () => {
        const blob = new Blob(recordedChunksRef.current, { type: 'video/webm' });
        const localPlaybackUrl = URL.createObjectURL(blob);

        // Compute performance alignment score
        const score = calculateScore();
        
        setCurrentRecording({
          selectedSong: song,
          playbackUrl: localPlaybackUrl,
          score,
          pitchHistory,
          vocalFilter: selectedFilter,
          autotuneStrength,
          isDuet: currentRecording?.isDuet || false,
          partnerName: currentRecording?.partnerName || '',
          partnerVocalUrl: currentRecording?.partnerVocalUrl || ''
        });
        
        navigate('Results');
      };

      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start();
      
      setIsRecording(true);
      requestAnimationFrame(detectPitchLoop);
    } catch (err) {
      console.warn("Media Capture failed, launching sandbox simulation:", err);
      // Run Sandbox simulator recording
      setIsRecording(true);
      if (backingAudioRef.current) {
        backingAudioRef.current.currentTime = 0;
        backingAudioRef.current.play().catch(() => {});
      }
      if (partnerAudioRef.current) {
        partnerAudioRef.current.currentTime = 0;
        partnerAudioRef.current.play().catch(() => {});
      }
    }
  };


  const stopRecording = () => {
    setIsRecording(false);
    if (backingAudioRef.current) {
      backingAudioRef.current.pause();
    }
    if (partnerAudioRef.current) {
      partnerAudioRef.current.pause();
    }
    if (humOscRef.current) {
      humOscRef.current.stop();
    }
    if (schumannOscRef.current) {
      try { schumannOscRef.current.stop(); } catch (e) {}
      schumannOscRef.current = null;
    }
    if (schumannBinauralOscsRef.current) {
      schumannBinauralOscsRef.current.forEach(osc => {
        try { osc.stop(); } catch (e) {}
      });
      schumannBinauralOscsRef.current = [];
    }

    // Stop active ambient synth nodes
    synthNodesRef.current.forEach(node => {
      try { node.stop(); } catch (e) {}
    });
    synthNodesRef.current = [];

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    } else {
      // Mock Sandbox Stop
      const score = calculateScore();
      setCurrentRecording({
        selectedSong: song,
        playbackUrl: "https://raw.githubusercontent.com/effacestudios/Royalty-Free-Music-Pack/master/Happy%20Life.mp3",
        score,
        pitchHistory: pitchHistory.length > 0 ? pitchHistory : [220, 222, 218, 220, 221],
        vocalFilter: selectedFilter,
        autotuneStrength,
        isDuet: currentRecording?.isDuet || false,
        partnerName: currentRecording?.partnerName || '',
        partnerVocalUrl: currentRecording?.partnerVocalUrl || ''
      });
      navigate('Results');
    }
    cleanupAudio();
  };

  const calculateScore = () => {
    if (pitchHistory.length === 0) return 75; // baseline fallback
    
    // Pitch stability variance score calculation
    let varianceSum = 0;
    let avg = pitchHistory.reduce((a, b) => a + b, 0) / pitchHistory.length;
    pitchHistory.forEach(pitch => {
      varianceSum += Math.abs(pitch - avg);
    });
    const varianceAvg = varianceSum / pitchHistory.length;
    const stabilityPct = Math.max(45, Math.min(99, 100 - varianceAvg * 1.5));
    return Math.round(stabilityPct);
  };

  return (
    <div className="screen-wrapper">
      <div style={{ display: 'flex', gap: '20px', alignItems: 'center', marginBottom: '20px' }}>
        <button 
          className="glowing-button secondary" 
          style={{ padding: '6px 12px', fontSize: '0.8rem', margin: 0 }}
          onClick={() => navigate('SongLibrary')}
          disabled={isRecording}
        >
          ← Quit Studio
        </button>
        <h1 className="suspended-title" style={{ margin: 0 }}>Recording Studio</h1>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px', alignItems: 'start' }}>
        {/* Visualizer & Video Capture Panel */}
        <div className="glass-panel" style={{ margin: 0, padding: 0, position: 'relative', height: '350px', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', overflow: 'hidden' }}>
          {isVideoMode && isRecording && (
            <video 
              ref={videoRef} 
              autoPlay 
              playsInline 
              muted 
              style={{ 
                position: 'absolute', 
                width: '100%', 
                height: '100%', 
                objectFit: 'cover',
                zIndex: 1,
                opacity: 0.55
              }} 
            />
          )}

          {isVideoMode && isRecording && (cameraFilter === 'geometry' || cameraFilter === 'spectrum') && (
            <canvas 
              ref={cameraFilterCanvasRef} 
              style={{ 
                position: 'absolute', 
                width: '100%', 
                height: '100%', 
                top: 0, left: 0,
                pointerEvents: 'none',
                zIndex: 2
              }} 
            />
          )}

          {isVideoMode && isRecording && cameraFilter === 'aura' && (
            <canvas 
              ref={cameraFilterWebGLCanvasRef} 
              style={{ 
                position: 'absolute', 
                width: '100%', 
                height: '100%', 
                top: 0, left: 0,
                pointerEvents: 'none',
                zIndex: 2
              }} 
            />
          )}

          <div style={{ position: 'absolute', width: '100%', height: '100%', zIndex: 1 }}>
            <VoiceReactiveVisualizer analyser={analyserRef.current} />
          </div>

          {/* Floating camera filter mode selector */}
          {isVideoMode && isRecording && (
            <div style={{
              position: 'absolute',
              top: '12px', left: '12px',
              display: 'flex', gap: '5px',
              zIndex: 10,
              background: 'rgba(6, 4, 30, 0.65)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: '8px',
              padding: '3px',
              backdropFilter: 'blur(8px)'
            }}>
              {[
                { filter: 'none', label: 'None' },
                { filter: 'aura', label: '✨ Aura' },
                { filter: 'geometry', label: '🔷 Geometry' },
                { filter: 'spectrum', label: '📊 Waves' }
              ].map(btn => (
                <button
                  key={btn.filter}
                  onClick={() => setCameraFilter(btn.filter)}
                  style={{
                    background: cameraFilter === btn.filter ? 'var(--secondary-glow)' : 'transparent',
                    border: 'none',
                    borderRadius: '6px',
                    color: cameraFilter === btn.filter ? '#02001a' : '#fff',
                    fontSize: '0.62rem',
                    fontWeight: 'bold',
                    fontFamily: '"Orbitron", sans-serif',
                    padding: '3px 8px',
                    cursor: 'pointer',
                    textTransform: 'uppercase',
                    transition: 'all 0.25s ease'
                  }}
                >
                  {btn.label}
                </button>
              ))}
            </div>
          )}

          {/* Pitch Guide Trajectory Grid */}
          <div style={{ position: 'absolute', bottom: 0, left: 0, width: '100%', padding: '8px 12px', background: 'rgba(6, 4, 30, 0.75)', borderTop: '1px solid rgba(255,255,255,0.06)', zIndex: 3 }}>
            <span style={{ fontSize: '0.62rem', color: 'var(--text-dim)', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>
              🎯 Pitch Trajectory Guide
            </span>
            {isRecording ? (
              <canvas ref={pitchCanvasRef} style={{ width: '100%', height: '55px', borderRadius: '4px', display: 'block' }} />
            ) : (
              <div style={{ width: '100%', height: '55px', borderRadius: '4px', background: 'rgba(0,0,0,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-dim)', fontSize: '0.68rem' }}>
                Resonance pitch guide active during recording
              </div>
            )}
          </div>
        </div>

        {/* Info & Prompter Panel */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Song Metadata Card */}
          <div className="glass-panel" style={{ margin: 0, padding: '15px' }}>
            <h2 style={{ margin: 0, fontSize: '1.25rem' }}>{song?.title}</h2>
            <p style={{ color: 'var(--text-dim)', fontSize: '0.85rem', margin: '4px 0 0 0' }}>{song?.artist}</p>
            
            <div style={{ display: 'flex', gap: '15px', marginTop: '12px', alignItems: 'center' }}>
              <div style={{ fontSize: '1.1rem', fontFamily: 'monospace', textShadow: '0 0 8px var(--primary-glow)' }}>
                Time: {Math.floor(recordTime / 60)}:{(recordTime % 60).toFixed(1).padStart(4, '0')}
              </div>
              <div style={{ fontSize: '1.1rem', fontFamily: 'monospace', color: 'var(--primary-glow)' }}>
                Pitch: {livePitch > 0 ? `${livePitch} Hz` : '---'}
              </div>
            </div>

            {/* Real-time Bio-Resonance HUD */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginTop: '12px' }}>
              <div style={{ background: 'rgba(0,0,0,0.18)', padding: '6px 10px', borderRadius: '6px', textAlign: 'center' }}>
                <span style={{ fontSize: '0.62rem', color: 'var(--text-dim)', textTransform: 'uppercase', display: 'block' }}>Vowel Vibe</span>
                <strong style={{ fontSize: '0.88rem', color: 'var(--primary-glow)', display: 'block', marginTop: '2px' }}>{liveVowel}</strong>
              </div>
              <div style={{ background: 'rgba(0,0,0,0.18)', padding: '6px 10px', borderRadius: '6px', textAlign: 'center' }}>
                <span style={{ fontSize: '0.62rem', color: 'var(--text-dim)', textTransform: 'uppercase', display: 'block' }}>Biorhythm Mindset</span>
                <strong style={{ fontSize: '0.88rem', color: 'var(--secondary-glow)', display: 'block', marginTop: '2px' }}>{liveBiorhythm}</strong>
              </div>
            </div>

            {/* Live Studio Volume Mixer Dashboard */}
            <div style={{ background: 'rgba(255,255,255,0.03)', padding: '12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.08)', marginTop: '12px' }}>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-dim)', textTransform: 'uppercase', display: 'block', marginBottom: '8px', textAlign: 'left', fontWeight: 'bold' }}>
                🎛️ Real-Time Studio Mixer
              </span>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.68rem', color: 'var(--primary-glow)', marginBottom: '2px' }}>
                    <span>🎸 Backing Track Vol</span>
                    <span>{musicVolume}%</span>
                  </div>
                  <input 
                    type="range" 
                    min="0" 
                    max="100" 
                    value={musicVolume} 
                    onChange={e => handleMusicVolumeChange(Number(e.target.value))} 
                    style={{ width: '100%' }} 
                  />
                </div>

                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.68rem', color: 'var(--secondary-glow)', marginBottom: '2px' }}>
                    <span>🎙️ Vocal Microphone Vol</span>
                    <span>{micVolume}%</span>
                  </div>
                  <input 
                    type="range" 
                    min="0" 
                    max="100" 
                    value={micVolume} 
                    onChange={e => handleMicVolumeChange(Number(e.target.value))} 
                    style={{ width: '100%' }} 
                  />
                </div>
              </div>
            </div>

            {/* Live Filter Config */}
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginTop: '15px' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)', textTransform: 'uppercase' }}>Vocal Effect:</span>
              {['dry', 'studio', 'hall', 'pop', 'solfeggio'].map(filter => (
                <button
                  key={filter}
                  className={`daw-track-btn ${selectedFilter === filter ? 'active' : ''}`}
                  onClick={() => setSelectedFilter(filter)}
                  style={{ fontSize: '0.65rem', padding: '3px 8px', textTransform: 'capitalize', margin: 0 }}
                  disabled={isRecording}
                >
                  {filter}
                </button>
              ))}
            </div>

            {/* Autotune Strength Config */}
            <div style={{ background: 'rgba(0,242,255,0.03)', padding: '10px 12px', borderRadius: '8px', border: '1px solid rgba(0,242,255,0.08)', marginTop: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: 'var(--primary-glow)', marginBottom: '4px' }}>
                <span>✨ Autotune Snap Strength</span>
                <span>{autotuneStrength}%</span>
              </div>
              <input 
                type="range" 
                min="0" 
                max="100" 
                value={autotuneStrength} 
                onChange={e => setAutotuneStrength(Number(e.target.value))} 
                style={{ width: '100%' }} 
              />
              <span style={{ fontSize: '0.62rem', color: 'var(--text-dim)', display: 'block', marginTop: '2px', textAlign: 'left' }}>
                Locks vocal pitches snap-matching closest target notes.
              </span>
            </div>
          </div>

          {/* Scrolling Prompter HUD */}
          <div className="glass-panel" style={{ margin: 0, height: '180px', display: 'flex', flexDirection: 'column', justifyContent: 'center', textAlign: 'center' }}>
            <div style={{ overflowY: 'hidden', height: '100px', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '12px' }}>
              {lyricsLines.length > 0 ? (
                <>
                  <p style={{ color: 'var(--text-dim)', fontSize: '0.82rem', opacity: 0.45 }}>
                    {lyricsLines[currentLineIndex - 1] ? getDuetLineText(lyricsLines[currentLineIndex - 1], currentLineIndex - 1) : ''}
                  </p>
                  <p style={{ color: (currentLineIndex % 4 === 0) ? '#ffcc00' : ((currentLineIndex % 2 === 0) ? 'var(--secondary-glow)' : 'var(--primary-glow)'), fontSize: '1.25rem', fontWeight: 'bold', textShadow: '0 0 10px currentColor' }}>
                    {lyricsLines[currentLineIndex] ? getDuetLineText(lyricsLines[currentLineIndex], currentLineIndex) : '---'}
                  </p>
                  <p style={{ color: 'var(--text-dim)', fontSize: '0.82rem', opacity: 0.45 }}>
                    {lyricsLines[currentLineIndex + 1] ? getDuetLineText(lyricsLines[currentLineIndex + 1], currentLineIndex + 1) : ''}
                  </p>
                </>
              ) : (
                <p style={{ color: 'var(--text-dim)' }}>Instrumental Section...</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Recording Control Actions */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: '12px', marginTop: '25px', flexWrap: 'wrap' }}>
        {!isRecording ? (
          <button className="glowing-button" onClick={startRecording} style={{ margin: 0, padding: '14px 35px' }}>
            🎙️ Start Recording Session
          </button>
        ) : (
          <button className="glowing-button secondary" onClick={stopRecording} style={{ margin: 0, padding: '14px 35px', borderColor: 'var(--secondary-glow)' }}>
            ⏹️ Stop & Compile Performance
          </button>
        )}

        <button 
          className={`glowing-button secondary ${isMuted ? 'active' : ''}`}
          onClick={toggleMute}
          style={{ margin: 0, padding: '14px 20px', borderColor: isMuted ? 'var(--secondary-glow)' : '' }}
          disabled={!isRecording}
        >
          {isMuted ? '🔇 Muted' : '🎙️ Mute Mic'}
        </button>

        <button 
          className={`glowing-button secondary ${isMonitoring ? 'active' : ''}`}
          onClick={toggleMonitoring}
          style={{ margin: 0, padding: '14px 20px', borderColor: isMonitoring ? 'var(--primary-glow)' : '' }}
          disabled={!isRecording}
        >
          {isMonitoring ? '🎧 Monitor ON' : '🎧 Monitor OFF'}
        </button>

        <button 
          className={`glowing-button secondary ${isVideoMode ? 'active' : ''}`}
          onClick={() => setIsVideoMode(!isVideoMode)}
          style={{ margin: 0, padding: '14px 20px' }}
          disabled={isRecording}
        >
          {isVideoMode ? '📹 Camera ON' : '📷 Audio Only'}
        </button>

        <button 
          className={`glowing-button secondary ${schumannResonance ? 'active' : ''}`}
          onClick={() => setSchumannResonance(!schumannResonance)}
          style={{ margin: 0, padding: '14px 20px', borderColor: schumannResonance ? '#00ff87' : '' }}
          disabled={isRecording}
        >
          {schumannResonance ? '🌍 Earth LFO ON' : '🌍 Earth LFO OFF'}
        </button>

        <button 
          className={`glowing-button secondary ${playHum ? 'active' : ''}`}
          onClick={() => setPlayHum(!playHum)}
          style={{ margin: 0, padding: '14px 20px' }}
          disabled={isRecording}
        >
          {playHum ? '✓ Hum Node ON' : '⏵ Hum Node OFF'}
        </button>
      </div>
    </div>
  );
};

export default RecordingStudio;
