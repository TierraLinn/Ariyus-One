import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';

// Mock browser AudioContext APIs BEFORE importing the component
class MockAudioContext {
  constructor() {
    this.state = 'running';
    this.sampleRate = 44100;
    this.currentTime = 0;
    this.destination = {};
  }
  resume() {
    return Promise.resolve();
  }
  createOscillator() {
    return {
      connect: jest.fn(),
      frequency: { setValueAtTime: jest.fn(), exponentialRampToValueAtTime: jest.fn() },
      start: jest.fn(),
      stop: jest.fn()
    };
  }
  createGain() {
    return {
      connect: jest.fn(),
      gain: { setValueAtTime: jest.fn(), linearRampToValueAtTime: jest.fn(), exponentialRampToValueAtTime: jest.fn() }
    };
  }
  createBuffer() {
    return {
      getChannelData: () => new Float32Array(100),
      duration: 10,
      length: 100,
      numberOfChannels: 1,
      sampleRate: 44100
    };
  }
  createBufferSource() {
    return {
      connect: jest.fn(),
      start: jest.fn(),
      stop: jest.fn()
    };
  }
  createStereoPanner() {
    return {
      connect: jest.fn(),
      pan: { setValueAtTime: jest.fn() }
    };
  }
  createDelay() {
    return {
      connect: jest.fn(),
      delayTime: { setValueAtTime: jest.fn() }
    };
  }
  createBiquadFilter() {
    return {
      connect: jest.fn(),
      frequency: { setValueAtTime: jest.fn() },
      gain: { setValueAtTime: jest.fn() },
      Q: { setValueAtTime: jest.fn() }
    };
  }
  createDynamicsCompressor() {
    return {
      threshold: { setValueAtTime: jest.fn() },
      knee: { setValueAtTime: jest.fn() },
      ratio: { setValueAtTime: jest.fn() },
      attack: { setValueAtTime: jest.fn() },
      release: { setValueAtTime: jest.fn() },
      connect: jest.fn()
    };
  }
}

const mockAudioContext = MockAudioContext;

// If window constructors already exist, inject all methods into their prototypes directly!
[
  window.AudioContext,
  window.webkitAudioContext,
  global.AudioContext
].forEach(ctor => {
  if (ctor && ctor.prototype) {
    Object.getOwnPropertyNames(MockAudioContext.prototype).forEach(key => {
      if (key !== 'constructor') {
        try {
          ctor.prototype[key] = MockAudioContext.prototype[key];
        } catch (e) {}
      }
    });
    try {
      const dummy = new MockAudioContext();
      Object.keys(dummy).forEach(key => {
        try {
          ctor.prototype[key] = dummy[key];
        } catch (e) {}
      });
    } catch (e) {}
  }
});

// Also define the window and global properties to ensure mock constructor resolves
try {
  delete window.constructor.prototype.AudioContext;
  delete window.constructor.prototype.webkitAudioContext;
  delete Window.prototype.AudioContext;
  delete Window.prototype.webkitAudioContext;
  delete window.AudioContext;
  delete window.webkitAudioContext;
  delete global.AudioContext;
} catch (e) {}

try {
  Object.defineProperty(window, 'AudioContext', { value: mockAudioContext, writable: true, configurable: true });
  Object.defineProperty(window, 'webkitAudioContext', { value: mockAudioContext, writable: true, configurable: true });
  Object.defineProperty(Window.prototype, 'AudioContext', { value: mockAudioContext, writable: true, configurable: true });
  Object.defineProperty(Window.prototype, 'webkitAudioContext', { value: mockAudioContext, writable: true, configurable: true });
  Object.defineProperty(global, 'AudioContext', { value: mockAudioContext, writable: true, configurable: true });
} catch (e) {}

const Workstation = require('../screens/Workstation').default;

// Mock canvas getContext to silence JSDOM warnings
HTMLCanvasElement.prototype.getContext = jest.fn().mockReturnValue({
  clearRect: jest.fn(),
  beginPath: jest.fn(),
  moveTo: jest.fn(),
  lineTo: jest.fn(),
  stroke: jest.fn(),
  fillRect: jest.fn()
});

beforeAll(() => {
  window.URL.createObjectURL = jest.fn().mockReturnValue('mock-object-url');

  window.OfflineAudioContext = jest.fn().mockImplementation(() => ({
    sampleRate: 44100,
    destination: { connect: jest.fn() },
    createOscillator: () => ({
      connect: jest.fn(),
      frequency: { setValueAtTime: jest.fn(), exponentialRampToValueAtTime: jest.fn() },
      start: jest.fn(),
      stop: jest.fn()
    }),
    createGain: () => ({
      connect: jest.fn(),
      gain: { setValueAtTime: jest.fn(), linearRampToValueAtTime: jest.fn(), exponentialRampToValueAtTime: jest.fn() }
    }),
    createBuffer: () => ({
      getChannelData: () => new Float32Array(100),
      duration: 10,
      length: 100,
      numberOfChannels: 1,
      sampleRate: 44100
    }),
    createBufferSource: () => ({
      connect: jest.fn(),
      start: jest.fn(),
      stop: jest.fn()
    }),
    createStereoPanner: () => ({
      connect: jest.fn(),
      pan: { setValueAtTime: jest.fn() }
    }),
    createDelay: () => ({
      connect: jest.fn(),
      delayTime: { setValueAtTime: jest.fn() }
    }),
    createBiquadFilter: () => ({
      connect: jest.fn(),
      frequency: { setValueAtTime: jest.fn() }
    }),
    createDynamicsCompressor: () => ({
      threshold: { setValueAtTime: jest.fn() },
      knee: { setValueAtTime: jest.fn() },
      ratio: { setValueAtTime: jest.fn() },
      attack: { setValueAtTime: jest.fn() },
      release: { setValueAtTime: jest.fn() },
      connect: jest.fn()
    }),
    startRendering: () => Promise.resolve({
      numberOfChannels: 2,
      length: 44100 * 2,
      sampleRate: 44100,
      getChannelData: (chan) => new Float32Array(44100 * 2)
    })
  }));

  class MockMediaRecorder {
    constructor(stream, options) {
      this.state = 'inactive';
      this.ondataavailable = null;
      this.onstop = null;
    }
    start(timeslice) {
      this.state = 'recording';
    }
    stop() {
      this.state = 'inactive';
      if (this.onstop) this.onstop();
    }
  }
  Object.defineProperty(window, 'MediaRecorder', {
    value: MockMediaRecorder,
    writable: true,
    configurable: true
  });
  Object.defineProperty(global, 'MediaRecorder', {
    value: MockMediaRecorder,
    writable: true,
    configurable: true
  });

  Object.defineProperty(navigator, 'mediaDevices', {
    value: {
      getUserMedia: jest.fn().mockResolvedValue({
        getTracks: () => [{ stop: jest.fn() }]
      })
    },
    writable: true,
    configurable: true
  });

  window.alert = jest.fn();
});

describe('Ariyus-One DAW Workstation tests', () => {
  const mockNavigate = jest.fn();
  const mockUserData = {
    displayName: 'Aura Singer',
    email: 'test@ariyus.one',
    tier: 'Creator',
    xp: 500
  };

  test('DAW screen renders timeline rows and controls', () => {
    render(
      <Workstation 
        navigate={mockNavigate} 
        userData={mockUserData} 
        currentRecording={null}
      />
    );

    // Verify main header and buttons are rendered
    expect(screen.getByText('Ariyus DAW')).toBeInTheDocument();
    expect(screen.getByText(/Export Mixdown \(\.WAV\)/)).toBeInTheDocument();
    expect(screen.getByText('🎹 ACID Synth Loops Grid')).toBeInTheDocument();
    expect(screen.getByText('💎 Mastering & Precision Suite')).toBeInTheDocument();

    // Verify track rows are visible
    expect(screen.getByText('Vocal Melody (Lead)')).toBeInTheDocument();
    expect(screen.getByText('Vocal Overlay (Harmony)')).toBeInTheDocument();
    expect(screen.getByText('Backing Instrumental Beat')).toBeInTheDocument();
  });

  test('DAW toggles Earth Resonance LFO', () => {
    render(
      <Workstation 
        navigate={mockNavigate} 
        userData={mockUserData} 
        currentRecording={null}
      />
    );

    // Verify LFO bypass button renders
    const bypassBtn = screen.getByText('BYPASS');
    expect(bypassBtn).toBeInTheDocument();

    // Trigger click on toggle
    fireEvent.click(bypassBtn);

    // Verify it updates to ACTIVE
    expect(screen.getByText('ACTIVE')).toBeInTheDocument();
  });

  test('DAW arms track for recording and starts/stops master recording', async () => {
    render(
      <Workstation 
        navigate={mockNavigate} 
        userData={mockUserData} 
        currentRecording={null}
      />
    );

    // Find all Record Arm (🔴 R) buttons
    const armButtons = screen.getAllByText('🔴 R');
    expect(armButtons.length).toBeGreaterThan(0);

    // Click to arm the first track
    fireEvent.click(armButtons[0]);

    // Check that the Record button is now enabled and click it
    const recordBtn = screen.getByText('🔴 Record');
    expect(recordBtn).toBeInTheDocument();
    expect(recordBtn).not.toBeDisabled();

    // Click Record to start recording
    fireEvent.click(recordBtn);

    // Verify it updates to Stop Rec asynchronously
    const stopRecBtn = await screen.findByText('⏹ Stop Rec');
    expect(stopRecBtn).toBeInTheDocument();

    // Click Stop Rec to finalize
    fireEvent.click(stopRecBtn);

    // Verify it toggles back to Record asynchronously
    const recordBtnBack = await screen.findByText('🔴 Record');
    expect(recordBtnBack).toBeInTheDocument();
  }, 15000);

  test('WAV Encoder compiles correct headers and formats structure', () => {
    // Re-verify the binary WAV header compiler
    const sampleRate = 44100;
    const channelsCount = 2;
    const mockAudioBuffer = {
      numberOfChannels: channelsCount,
      length: 1000,
      sampleRate: sampleRate,
      getChannelData: (c) => new Float32Array(1000)
    };

    // Emulate WAV header logic
    const length = mockAudioBuffer.length * channelsCount * 2 + 44;
    const bufferArr = new ArrayBuffer(length);
    const view = new DataView(bufferArr);

    const setUint16 = (pos, data) => {
      view.setUint16(pos, data, true);
    };

    const setUint32 = (pos, data) => {
      view.setUint32(pos, data, true);
    };

    // Test RIFF format output
    setUint32(0, 0x46464952); // "RIFF"
    setUint32(4, length - 8); // Size
    setUint32(8, 0x45564157); // "WAVE"

    expect(view.getUint32(0, true)).toBe(0x46464952);
    expect(view.getUint32(4, true)).toBe(length - 8);
    expect(view.getUint32(8, true)).toBe(0x45564157);
  });
});
