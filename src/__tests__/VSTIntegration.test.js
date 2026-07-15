import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import Profile from '../screens/Profile';

describe('Ariyus-One VST Integration & Mobile Settings tests', () => {
  const mockNavigate = jest.fn();
  const mockUserData = {
    displayName: 'Aura Singer',
    email: 'test@ariyus.one',
    tier: 'Creator',
    xp: 500
  };
  const mockSetUserData = jest.fn();

  test('Mobile wrapper settings render inside settings panel tab', () => {
    render(
      <Profile 
        navigate={mockNavigate} 
        userData={mockUserData} 
        setUserData={mockSetUserData}
      />
    );

    // Switch to settings tab
    const settingsTab = screen.getByText(/Settings/i);
    fireEvent.click(settingsTab);

    // Verify Mobile wrapper settings labels exist
    expect(screen.getByText('Mobile Native Wrapper Settings')).toBeInTheDocument();
    expect(screen.getByText('Enable Daily Solfeggio Reminders & Battle Invites')).toBeInTheDocument();
    expect(screen.getByText('Hardware Low-Latency Audio Acceleration')).toBeInTheDocument();
  });

  test('VST modal opens, generates authentication key, and connects streaming logs', async () => {
    jest.useFakeTimers();

    render(
      <Profile 
        navigate={mockNavigate} 
        userData={mockUserData} 
        setUserData={mockSetUserData}
      />
    );

    // Open VST modal from Creator Dashboard
    const openVstBtn = screen.getByText('🔌 External VST DAW Integration');
    fireEvent.click(openVstBtn);

    expect(screen.getByText('🔌 External DAW VST Plugin Link')).toBeInTheDocument();

    // Key should start empty or with local storage mock check
    const keyInput = screen.getByRole('textbox');
    expect(keyInput).toBeInTheDocument();

    // Trigger Key Generation
    const generateBtn = screen.getByText('Generate Key');
    
    // Mock window.alert to prevent blocking test threads
    window.alert = jest.fn();
    fireEvent.click(generateBtn);

    expect(window.alert).toHaveBeenCalled();
    expect(keyInput.value).toMatch(/^AR-VST-[A-Z0-9]{4}-[A-Z0-9]{4}$/);

    // Test Connection Toggle
    const connectBtn = screen.getByText('Connect VST');
    expect(connectBtn).toBeInTheDocument();

    fireEvent.click(connectBtn);
    expect(screen.getByText((c, el) => el.tagName === 'SPAN' && el.textContent.includes('Status:'))).toHaveTextContent('Status: Connecting');

    // Run timers to verify connecting transitions to streaming status
    act(() => {
      jest.advanceTimersByTime(1300);
    });

    expect(screen.getByText((c, el) => el.tagName === 'SPAN' && el.textContent.includes('Status:'))).toHaveTextContent('Status: Streaming');
    expect(screen.getByText('Output Jitter:')).toBeInTheDocument();

    // Test download button trigger
    const downloadBtn = screen.getByText('💾 Download VST');
    fireEvent.click(downloadBtn);
    expect(window.alert).toHaveBeenCalledWith(expect.stringContaining('Initiating secure download'));

    jest.useRealTimers();
  });
});
