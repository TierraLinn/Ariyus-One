import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import SongLibrary from '../screens/Sing';

describe('Ariyus-One Vocal Training Warmup Launchers tests', () => {
  const mockNavigate = jest.fn();
  const mockSetCurrentRecording = jest.fn();

  test('Vocal Coach and Vocal Arcade launchers render and click-through', () => {
    render(
      <SongLibrary 
        navigate={mockNavigate} 
        setCurrentRecording={mockSetCurrentRecording}
        user={{ uid: 'test_user_123' }}
      />
    );

    // Verify launcher cards are visible
    expect(screen.getByText('🎙️ AI Vocal Coach Warmups')).toBeInTheDocument();
    expect(screen.getByText('🚀 Space Journey Vocal Arcade')).toBeInTheDocument();

    // Trigger AI Vocal Coach navigation
    const coachBtn = screen.getByText('Launch Warmup Coach');
    fireEvent.click(coachBtn);
    expect(mockNavigate).toHaveBeenCalledWith('VocalCoach');

    // Trigger Vocal Arcade navigation
    const arcadeBtn = screen.getByText('Launch Flight Arcade');
    fireEvent.click(arcadeBtn);
    expect(mockNavigate).toHaveBeenCalledWith('VocalArcade');
  });
});
