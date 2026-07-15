import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import SubscriptionPortal from '../screens/SubscriptionPortal';

describe('Ariyus-One Subscription Portal tests', () => {
  const mockNavigate = jest.fn();
  const mockUserData = {
    displayName: 'Aura Singer',
    email: 'test@ariyus.one',
    tier: 'Free',
    xp: 500
  };
  const mockSetUserData = jest.fn();

  test('Subscription portal renders cards and pricing options', () => {
    render(
      <SubscriptionPortal 
        navigate={mockNavigate} 
        userData={mockUserData} 
        setUserData={mockSetUserData}
      />
    );

    // Assert screen headers are present
    expect(screen.getByText('Membership & Upgrade Center')).toBeInTheDocument();
    
    // Assert plan tiers are displayed
    expect(screen.getByText('Free Tier')).toBeInTheDocument();
    expect(screen.getByText('Ariyus Pro')).toBeInTheDocument();
    expect(screen.getByText('Creator Tier')).toBeInTheDocument();

    // Assert current plan is highlighted
    expect(screen.getByText('Active Plan')).toBeInTheDocument();
  });

  test('Checkout modal validations guard inputs', () => {
    render(
      <SubscriptionPortal 
        navigate={mockNavigate} 
        userData={mockUserData} 
        setUserData={mockSetUserData}
      />
    );

    // Open checkout for Ariyus Pro
    const selectProBtn = screen.getByText('Select Ariyus Pro');
    fireEvent.click(selectProBtn);

    // Modal forms should be visible
    expect(screen.getByText('Cardholder Name')).toBeInTheDocument();
    expect(screen.getByText('Card Number')).toBeInTheDocument();

    // Trigger form submit with empty values
    const submitBtn = screen.getByText('🔒 Authorize Subscription');
    fireEvent.click(submitBtn);

    // Error alert should show for Name field
    expect(screen.getByText('⚠️ Cardholder Name is required.')).toBeInTheDocument();
  });
});
