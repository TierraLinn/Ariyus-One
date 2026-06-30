import { render, screen } from '@testing-library/react';
import App from './App';

test('renders App and confirms loading panel is showing', () => {
  render(<App />);
  const loadingElement = screen.getByText(/Syncing acoustic/i);
  expect(loadingElement).toBeInTheDocument();
});
