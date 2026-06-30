import React, { useRef, useEffect, useState } from 'react';

const VoiceReactiveVisualizer = ({ analyser }) => {
  const canvasRef = useRef(null);
  const animationRef = useRef(null);
  const [visualMode, setVisualMode] = useState('flower'); // 'flower', 'sriyantra', 'metatron'
  const modeRef = useRef(visualMode);

  useEffect(() => {
    modeRef.current = visualMode;
  }, [visualMode]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    let width = canvas.width = canvas.offsetWidth;
    let height = canvas.height = canvas.offsetHeight;

    const resizeObserver = new ResizeObserver(() => {
      if (canvas) {
        width = canvas.width = canvas.offsetWidth;
        height = canvas.height = canvas.offsetHeight;
      }
    });
    resizeObserver.observe(canvas);

    let rotationAngle = 0;
    const bufferLength = analyser ? analyser.frequencyBinCount : 64;
    const dataArray = new Uint8Array(bufferLength);

    // Helper: Draw Flower of Life overlapping circle matrix
    const drawFlowerOfLife = (ctx, x, y, r, volume) => {
      const alpha = 0.08 + (volume / 255) * 0.15;
      ctx.strokeStyle = `rgba(0, 242, 255, ${alpha})`;
      ctx.lineWidth = 0.8;

      // Center seed
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.stroke();

      // First ring (6 circles)
      for (let i = 0; i < 6; i++) {
        const theta = (i * Math.PI) / 3;
        const cx = x + r * Math.cos(theta);
        const cy = y + r * Math.sin(theta);
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Second ring (12 circles)
      for (let i = 0; i < 12; i++) {
        const theta = (i * Math.PI) / 6;
        const dist = i % 2 === 0 ? r * Math.sqrt(3) : r * 2;
        const cx = x + dist * Math.cos(theta);
        const cy = y + dist * Math.sin(theta);
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.stroke();
      }
    };

    // Helper: Draw Sri Yantra interlocking geometric triangles
    const drawSriYantra = (ctx, x, y, r, volume) => {
      const alpha = 0.08 + (volume / 255) * 0.16;
      ctx.strokeStyle = `rgba(0, 255, 135, ${alpha})`;
      ctx.lineWidth = 0.85;

      // Concentric outer ring
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.stroke();

      const triangles = [
        { size: r * 0.85, dy: r * 0.12, up: true },
        { size: r * 0.70, dy: -r * 0.08, up: true },
        { size: r * 0.55, dy: r * 0.20, up: true },
        { size: r * 0.40, dy: -r * 0.02, up: true },
        { size: r * 0.85, dy: -r * 0.12, up: false },
        { size: r * 0.70, dy: r * 0.08, up: false },
        { size: r * 0.55, dy: -r * 0.20, up: false },
        { size: r * 0.42, dy: r * 0.02, up: false },
        { size: r * 0.28, dy: -r * 0.05, up: false }
      ];

      triangles.forEach((t, index) => {
        ctx.save();
        ctx.translate(x, y + t.dy);
        ctx.beginPath();
        const h = (t.size * Math.sqrt(3)) / 2;
        if (t.up) {
          ctx.moveTo(0, -h / 2);
          ctx.lineTo(-t.size / 2, h / 2);
          ctx.lineTo(t.size / 2, h / 2);
        } else {
          ctx.moveTo(0, h / 2);
          ctx.lineTo(-t.size / 2, -h / 2);
          ctx.lineTo(t.size / 2, -h / 2);
        }
        ctx.closePath();
        ctx.strokeStyle = `hsla(${(120 + index * 20 + volume * 0.35) % 360}, 100%, 70%, ${alpha})`;
        ctx.stroke();
        ctx.restore();
      });

      // Glowing central Bindu (golden dot)
      ctx.beginPath();
      ctx.arc(x, y, 3.5 + (volume / 50), 0, Math.PI * 2);
      ctx.fillStyle = '#ffcc00';
      ctx.shadowBlur = 10;
      ctx.shadowColor = '#ffcc00';
      ctx.fill();
      ctx.shadowBlur = 0;
    };

    // Helper: Draw Metatron's Cube connecting Fruit of Life centers
    const drawMetatronsCube = (ctx, x, y, r, volume) => {
      const alpha = 0.06 + (volume / 255) * 0.14;
      const d = r * 0.46;
      const centers = [{ x: 0, y: 0 }];

      for (let i = 0; i < 6; i++) {
        const theta = (i * Math.PI) / 3;
        centers.push({ x: d * Math.cos(theta), y: d * Math.sin(theta) });
        centers.push({ x: 2 * d * Math.cos(theta), y: 2 * d * Math.sin(theta) });
      }

      // Draw the 13 outer circles
      ctx.strokeStyle = `rgba(0, 242, 255, ${alpha * 0.8})`;
      ctx.lineWidth = 0.7;
      centers.forEach(c => {
        ctx.beginPath();
        ctx.arc(x + c.x, y + c.y, d / 2, 0, Math.PI * 2);
        ctx.stroke();
      });

      // Draw interlocking lines
      ctx.strokeStyle = `rgba(255, 0, 193, ${alpha * 1.5})`;
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      for (let i = 0; i < centers.length; i++) {
        for (let j = i + 1; j < centers.length; j++) {
          ctx.moveTo(x + centers[i].x, y + centers[i].y);
          ctx.lineTo(x + centers[j].x, y + centers[j].y);
        }
      }
      ctx.stroke();
    };

    // Helper: Draw shape-shifting bezier-curve mandala petals
    const drawMandalaPetals = (ctx, x, y, radius, volume, angle) => {
      // Scale number of petals based on volume (vocal presence)
      const numPetals = 12 + Math.floor((volume / 255) * 6);
      
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(angle * 0.25);

      for (let k = 1; k <= 3; k++) {
        const layerScale = k * 0.4;
        const layerHue = (180 + volume * 0.6 + k * 45) % 360;
        
        ctx.beginPath();
        for (let i = 0; i < numPetals; i++) {
          const petalAngle = (i * 2 * Math.PI) / numPetals;
          const rInner = radius * layerScale;
          const rOuter = radius * layerScale * 1.5;
          const cpAngle1 = petalAngle - Math.PI / numPetals;
          const cpAngle2 = petalAngle + Math.PI / numPetals;

          const xStart = rInner * Math.cos(petalAngle);
          const yStart = rInner * Math.sin(petalAngle);
          const xEnd = rInner * Math.cos(petalAngle + (2 * Math.PI) / numPetals);
          const yEnd = rInner * Math.sin(petalAngle + (2 * Math.PI) / numPetals);
          
          const cpX1 = rOuter * Math.cos(cpAngle1);
          const cpY1 = rOuter * Math.sin(cpAngle1);
          const cpX2 = rOuter * Math.cos(cpAngle2);
          const cpY2 = rOuter * Math.sin(cpAngle2);

          ctx.moveTo(xStart, yStart);
          ctx.bezierCurveTo(cpX1, cpY1, cpX2, cpY2, xEnd, yEnd);
        }

        ctx.strokeStyle = `hsla(${layerHue}, 100%, 70%, ${0.25 + (k * 0.15)})`;
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }

      ctx.restore();
    };

    // Helper: Draw Cymatics Chladni sound-resonance sand-particle patterns
    const drawCymaticsPattern = (ctx, x, y, r, volume) => {
      const alpha = 0.35 + (volume / 255) * 0.45;
      ctx.fillStyle = `rgba(0, 242, 255, ${alpha})`;
      ctx.shadowBlur = 8;
      ctx.shadowColor = 'rgba(0, 242, 255, 0.6)';

      const t = Date.now() * 0.0025;
      const n = 3 + Math.floor((volume / 255) * 5);
      const m = 2 + Math.floor((volume / 255) * 3);

      for (let pIdx = 0; pIdx < 360; pIdx++) {
        const angle = (pIdx * Math.PI * 2) / 120 + t * 0.04;
        const distRatio = Math.sin(pIdx * 0.42) * 0.45 + 0.55;
        const radiusOffset = distRatio * r * 0.85;

        const cx = radiusOffset * Math.cos(angle);
        const cy = radiusOffset * Math.sin(angle);

        // Chladni modal pattern formula
        const chladni = Math.cos(n * cx / 35) * Math.cos(m * cy / 35) - Math.cos(m * cx / 35) * Math.cos(n * cy / 35);
        const finalRadius = radiusOffset + chladni * 16 * (volume / 255 + 0.25);

        const px = x + finalRadius * Math.cos(angle);
        const py = y + finalRadius * Math.sin(angle);

        ctx.beginPath();
        ctx.arc(px, py, 1.6 + (volume / 100), 0, Math.PI * 2);
        ctx.fill();

        if (pIdx % 6 === 0) {
          ctx.beginPath();
          ctx.moveTo(px, py);
          ctx.lineTo(x + finalRadius * 0.82 * Math.cos(angle + 0.12), y + finalRadius * 0.82 * Math.sin(angle + 0.12));
          ctx.strokeStyle = `rgba(0, 255, 135, ${alpha * 0.35})`;
          ctx.lineWidth = 0.5;
          ctx.stroke();
        }
      }
      ctx.shadowBlur = 0;
    };

    const draw = () => {
      animationRef.current = requestAnimationFrame(draw);

      let volume = 0;
      if (analyser) {
        analyser.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < bufferLength; i++) {
          sum += dataArray[i];
        }
        volume = sum / bufferLength; // 0 to 255
      } else {
        // Ambient breathing pulse
        volume = 25 + Math.sin(Date.now() / 450) * 6;
      }

      // Draw background with slight trail for motion blur
      ctx.fillStyle = 'rgba(4, 3, 24, 0.22)';
      ctx.fillRect(0, 0, width, height);

      const centerX = width / 2;
      const centerY = height / 2;

      // Base sizes
      const baseRadius = Math.min(width, height) * 0.20;
      const pulse = volume * 0.50;
      const radius = baseRadius + pulse;

      // Adjust rotation speed based on volume input
      rotationAngle += 0.004 + (volume / 255) * 0.025;

      // 1. Radial Background Glow
      const radialGlow = ctx.createRadialGradient(centerX, centerY, radius * 0.1, centerX, centerY, radius * 2.2);
      radialGlow.addColorStop(0, `rgba(112, 0, 255, ${0.12 + (volume / 255) * 0.3})`);
      radialGlow.addColorStop(0.5, `rgba(0, 242, 255, ${0.04 + (volume / 255) * 0.12})`);
      radialGlow.addColorStop(1, 'rgba(4, 3, 24, 0)');
      ctx.fillStyle = radialGlow;
      ctx.fillRect(0, 0, width, height);

      // 2. Overlapping Frequency Waveforms around outer ring
      if (analyser) {
        ctx.save();
        ctx.translate(centerX, centerY);
        ctx.rotate(-rotationAngle * 0.3);
        ctx.beginPath();
        for (let i = 0; i < bufferLength; i++) {
          const barHeight = (dataArray[i] / 255) * 70;
          const rad = (i * 2 * Math.PI) / bufferLength;
          const x = (radius + 20) * Math.cos(rad);
          const y = (radius + 20) * Math.sin(rad);
          const xEnd = (radius + 20 + barHeight) * Math.cos(rad);
          const yEnd = (radius + 20 + barHeight) * Math.sin(rad);

          ctx.moveTo(x, y);
          ctx.lineTo(xEnd, yEnd);
        }
        ctx.strokeStyle = `hsla(${(rotationAngle * 25) % 360}, 100%, 65%, 0.55)`;
        ctx.lineWidth = 2.0;
        ctx.shadowBlur = 10;
        ctx.shadowColor = `hsla(${(rotationAngle * 25) % 360}, 100%, 65%, 0.8)`;
        ctx.stroke();
        ctx.restore();
      }

      // 3. Dynamic Sacred Geometry Matrix selection
      if (modeRef.current === 'sriyantra') {
        drawSriYantra(ctx, centerX, centerY, radius * 0.55, volume);
      } else if (modeRef.current === 'metatron') {
        drawMetatronsCube(ctx, centerX, centerY, radius * 0.55, volume);
      } else if (modeRef.current === 'cymatics') {
        drawCymaticsPattern(ctx, centerX, centerY, radius * 0.55, volume);
      } else {
        drawFlowerOfLife(ctx, centerX, centerY, radius * 0.55, volume);
      }

      // 4. Bezier Mandala Petals
      drawMandalaPetals(ctx, centerX, centerY, radius, volume, rotationAngle);

      // 5. Central Glowing Node
      ctx.save();
      ctx.translate(centerX, centerY);
      ctx.beginPath();
      ctx.arc(0, 0, 8 + (volume / 35), 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.shadowBlur = 18 + (volume / 15);
      ctx.shadowColor = `hsla(${(rotationAngle * 45) % 360}, 100%, 60%, 1)`;
      ctx.fill();
      ctx.restore();
    };

    draw();

    return () => {
      cancelAnimationFrame(animationRef.current);
      resizeObserver.disconnect();
    };
  }, [analyser]);

  return (
    <div className="visualizer-wrapper" style={{ position: 'relative', width: '100%', height: '320px', borderRadius: '12px', overflow: 'hidden' }}>
      
      {/* Floating geometry mode selector */}
      <div style={{
        position: 'absolute',
        top: '12px', right: '12px',
        display: 'flex', gap: '6px',
        zIndex: 10,
        background: 'rgba(6, 4, 30, 0.65)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: '8px',
        padding: '3px',
        backdropFilter: 'blur(8px)'
      }}>
        {[
          { mode: 'flower', label: '🌸 Flower' },
          { mode: 'sriyantra', label: '📐 Sri Yantra' },
          { mode: 'metatron', label: '🔷 Metatron' },
          { mode: 'cymatics', label: '🌊 Cymatics' }
        ].map(btn => (
          <button
            key={btn.mode}
            onClick={() => setVisualMode(btn.mode)}
            style={{
              background: visualMode === btn.mode ? 'var(--primary-glow)' : 'transparent',
              border: 'none',
              borderRadius: '6px',
              color: visualMode === btn.mode ? '#02001a' : '#fff',
              fontSize: '0.65rem',
              fontWeight: 'bold',
              fontFamily: '"Orbitron", sans-serif',
              padding: '4px 10px',
              cursor: 'pointer',
              textTransform: 'uppercase',
              textShadow: 'none',
              transition: 'all 0.25s ease'
            }}
          >
            {btn.label}
          </button>
        ))}
      </div>

      <canvas ref={canvasRef} style={{ width: '100%', height: '100%', display: 'block' }} />
      {!analyser && (
        <div style={{
          position: 'absolute',
          top: '50%', left: '50%',
          transform: 'translate(-50%, -50%)',
          color: 'rgba(255, 255, 255, 0.4)',
          fontFamily: '"Orbitron", sans-serif',
          fontSize: '0.8rem',
          letterSpacing: '2px',
          textTransform: 'uppercase',
          pointerEvents: 'none'
        }}>
          Resonance visualizer ready
        </div>
      )}
    </div>
  );
};

export default VoiceReactiveVisualizer;
