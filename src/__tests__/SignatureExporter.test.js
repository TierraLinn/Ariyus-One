import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import VoiceSignatureCard from '../components/VoiceSignatureCard';

describe('Ariyus-One Vocal Signature Exporter tests', () => {
  const mockSignature = {
    vocalType: 'Soprano',
    averagePitch: 261.6,
    resonanceType: 'Head Voice',
    dominantFreq: '261.6 Hz',
    energy: 82,
    jitter: 0.12,
    stability: 94,
    breath: 88
  };

  test('Signature exporter button mounts and triggers SVG file download', () => {
    // Mock browser URL creation APIs
    const mockCreateObjectURL = jest.fn().mockReturnValue('blob:http://localhost/mock-uuid');
    const mockRevokeObjectURL = jest.fn();
    window.URL.createObjectURL = mockCreateObjectURL;
    window.URL.revokeObjectURL = mockRevokeObjectURL;

    // Mock document.createElement to intercept the anchor element click
    const mockClick = jest.fn();
    const originalCreateElement = document.createElement;
    
    jest.spyOn(document, 'createElement').mockImplementation((tagName) => {
      const element = originalCreateElement.call(document, tagName);
      if (tagName === 'a') {
        element.click = mockClick;
      }
      return element;
    });

    render(<VoiceSignatureCard signature={mockSignature} />);

    // Assert card mounts with metadata
    expect(screen.getByText('Vocal ID Signature')).toBeInTheDocument();
    expect(screen.getByText('Soprano (Head Voice)')).toBeInTheDocument();

    // Trigger download click
    const downloadBtn = screen.getByText('💾 Download Vector SVG Card');
    expect(downloadBtn).toBeInTheDocument();

    fireEvent.click(downloadBtn);

    // Verify blob and download click were triggered
    expect(mockCreateObjectURL).toHaveBeenCalled();
    expect(mockClick).toHaveBeenCalled();
    expect(mockRevokeObjectURL).toHaveBeenCalled();

    document.createElement.mockRestore();
  });
});
