import { render, screen } from '@testing-library/react';
import App from './App';

test('renders App and confirms portal elements are showing', () => {
  render(<App />);
  const portalElement = screen.queryByText(/Syncing acoustic/i) || screen.getAllByText(/Ariyus/i)[0];
  expect(portalElement).toBeInTheDocument();
});
