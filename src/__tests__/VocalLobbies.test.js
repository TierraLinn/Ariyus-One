import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import Competitions from '../screens/Competitions';

describe('Ariyus-One Vocal Chat Lobbies & Spatial Rooms tests', () => {
  const mockNavigate = jest.fn();
  const mockUserData = {
    displayName: 'Aura Singer',
    email: 'test@ariyus.one',
    tier: 'Creator',
    xp: 500
  };
  const mockSetUserData = jest.fn();

  beforeAll(() => {
    window.alert = jest.fn();
  });

  test('Parties screen switches between Contest and live Lobbies view', () => {
    render(
      <Competitions 
        navigate={mockNavigate} 
        userData={mockUserData} 
        setUserData={mockSetUserData}
      />
    );

    // Verify weekly contest promo mounts by default
    expect(screen.getByText('Solfeggio Ascension: 528Hz Hearts')).toBeInTheDocument();

    // Click Live Parties & Voice Lobbies tab
    const lobbiesTab = screen.getByText('👥 Live Parties & Voice Lobbies');
    fireEvent.click(lobbiesTab);

    // Verify lobbies screen details mount
    expect(screen.getByText('Vocal Chat Lobbies')).toBeInTheDocument();
    expect(screen.getByText('👑 Crown Chakra Resonance (528Hz)')).toBeInTheDocument();
  });

  test('Entering voice room displays spatial soundstage stage coordinates and performance queue', () => {
    render(
      <Competitions 
        navigate={mockNavigate} 
        userData={mockUserData} 
        setUserData={mockSetUserData}
      />
    );

    // Switch to lobbies tab
    const lobbiesTab = screen.getByText('👥 Live Parties & Voice Lobbies');
    fireEvent.click(lobbiesTab);

    // Join room
    const joinBtn = screen.getAllByText('🚪 Join Lobby Room')[0];
    fireEvent.click(joinBtn);

    // Check spatial stage reads exist
    expect(screen.getByText(/Spatial Soundstage Grid:/)).toBeInTheDocument();
    expect(screen.getByText('Pan:')).toBeInTheDocument();
    expect(screen.getByText('Gain:')).toBeInTheDocument();

    // Queue track
    const queueBtn = screen.getAllByText('+ Queue')[0];
    fireEvent.click(queueBtn);

    // Verify performance queue updates
    expect(screen.getByText('Solfeggio Ascension (528Hz Tuning)')).toBeInTheDocument();
  });

  test('Emoji reactions render float indicators and mute toggles work', () => {
    render(
      <Competitions 
        navigate={mockNavigate} 
        userData={mockUserData} 
        setUserData={mockSetUserData}
      />
    );

    // Join room
    fireEvent.click(screen.getByText('👥 Live Parties & Voice Lobbies'));
    fireEvent.click(screen.getAllByText('🚪 Join Lobby Room')[0]);

    // Check mic state starts muted
    const micBtn = screen.getByText('🔇 Mic Muted');
    expect(micBtn).toBeInTheDocument();

    // Toggle mic
    fireEvent.click(micBtn);
    expect(screen.getByText('🎙️ Live Mic Active')).toBeInTheDocument();

    // Fire emoji reactions
    const fireReact = screen.getByText('🔥');
    fireEvent.click(fireReact);

    // Check that multiple instances of the emoji exist (one on button, one floating)
    expect(screen.getAllByText('🔥').length).toBeGreaterThan(1);
  });
});
