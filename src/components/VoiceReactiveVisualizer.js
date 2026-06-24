import React, { useRef, useEffect } from 'react';

const VoiceReactiveVisualizer = ({ analyser }) => {
  const canvasRef = useRef(null);
  const animationRef = useRef(null);

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

    let angle = 0;
    const bufferLength = analyser ? analyser.frequencyBinCount : 64;
    const dataArray = new Uint8Array(bufferLength);

    const draw = () => {
      animationRef.current = requestAnimationFrame(draw);

      // Fetch audio data if analyser is active
      let volume = 0;
      if (analyser) {
        analyser.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < bufferLength; i++) {
          sum += dataArray[i];
        }
        volume = sum / bufferLength; // 0 to 255
      } else {
        // Idle breathing animation
        volume = 20 + Math.sin(Date.now() / 400) * 8;
      }

      // Clear with slight trailing opacity
      ctx.fillStyle = 'rgba(6, 4, 30, 0.25)';
      ctx.fillRect(0, 0, width, height);

      const centerX = width / 2;
      const centerY = height / 2;
      
      // Calculate scaling based on audio volume
      const baseRadius = Math.min(width, height) * 0.22;
      const pulse = volume * 0.45;
      const radius = baseRadius + pulse;

      // Increment rotation angle
      angle += 0.005 + (volume / 250) * 0.03;

      // Draw glowing background glow
      const radialGlow = ctx.createRadialGradient(centerX, centerY, radius * 0.1, centerX, centerY, radius * 2.5);
      radialGlow.addColorStop(0, `rgba(112, 0, 255, ${0.1 + (volume / 255) * 0.3})`);
      radialGlow.addColorStop(0.5, `rgba(0, 242, 255, ${0.03 + (volume / 255) * 0.1})`);
      radialGlow.addColorStop(1, 'rgba(6, 4, 30, 0)');
      ctx.fillStyle = radialGlow;
      ctx.fillRect(0, 0, width, height);

      // Draw Orbiting frequency ring
      if (analyser) {
        ctx.save();
        ctx.translate(centerX, centerY);
        ctx.rotate(-angle * 0.5);
        ctx.beginPath();
        for (let i = 0; i < bufferLength; i++) {
          const barHeight = (dataArray[i] / 255) * 60;
          const rad = (i * 2 * Math.PI) / bufferLength;
          const x = (radius + 15) * Math.cos(rad);
          const y = (radius + 15) * Math.sin(rad);
          const xEnd = (radius + 15 + barHeight) * Math.cos(rad);
          const yEnd = (radius + 15 + barHeight) * Math.sin(rad);

          ctx.moveTo(x, y);
          ctx.lineTo(xEnd, yEnd);
        }
        ctx.strokeStyle = `hsla(${(angle * 30) % 360}, 100%, 70%, 0.65)`;
        ctx.lineWidth = 2.5;
        ctx.shadowBlur = 12;
        ctx.shadowColor = `hsla(${(angle * 30) % 360}, 100%, 70%, 0.8)`;
        ctx.stroke();
        ctx.restore();
      }

      // Draw Sacred Geometry (Overlapping Concentric Circles / Sri Yantra style star)
      ctx.save();
      ctx.translate(centerX, centerY);
      ctx.rotate(angle);

      const petalCount = 8;
      const hue = (180 + volume * 0.6) % 360;
      
      // Draw outer geometric ring
      ctx.beginPath();
      ctx.arc(0, 0, radius * 1.2, 0, Math.PI * 2);
      ctx.strokeStyle = `hsla(${hue}, 100%, 65%, 0.45)`;
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Draw geometric nodes on the ring
      for (let i = 0; i < petalCount; i++) {
        const rad = (i * 2 * Math.PI) / petalCount;
        const x = radius * 1.2 * Math.cos(rad);
        const y = radius * 1.2 * Math.sin(rad);
        
        ctx.beginPath();
        ctx.arc(x, y, 4 + (volume / 60), 0, Math.PI * 2);
        ctx.fillStyle = `hsla(${(hue + 60) % 360}, 100%, 70%, 0.8)`;
        ctx.fill();
        ctx.shadowBlur = 10;
        ctx.shadowColor = `hsla(${(hue + 60) % 360}, 100%, 70%, 1)`;
      }

      // Draw overlapping nested polygons (cosmic sacred geometry)
      for (let k = 0; k < 3; k++) {
        const polyRadius = radius * (1 - k * 0.28);
        const sides = 3 + k * 2; // Triangles, Pentagons, Heptagons
        ctx.beginPath();
        for (let i = 0; i <= sides; i++) {
          const rad = (i * 2 * Math.PI) / sides - (Math.PI / 2);
          const x = polyRadius * Math.cos(rad);
          const y = polyRadius * Math.sin(rad);
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.strokeStyle = `hsla(${(hue - k * 40) % 360}, 100%, 60%, ${0.35 + (k * 0.1)})`;
        ctx.lineWidth = 2 - k * 0.3;
        ctx.stroke();
      }

      // Draw central core
      ctx.beginPath();
      ctx.arc(0, 0, 8 + (volume / 40), 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.shadowBlur = 20;
      ctx.shadowColor = `hsla(${hue}, 100%, 50%, 1)`;
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
    <div className="visualizer-wrapper">
      <canvas ref={canvasRef} className="visualizer-canvas" />
      {!analyser && <div className="visualizer-overlay-text">Ariyus Resonance Engine Idle</div>}
    </div>
  );
};

export default VoiceReactiveVisualizer;
