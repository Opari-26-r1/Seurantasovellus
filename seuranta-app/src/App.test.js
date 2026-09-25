import { render, screen } from '@testing-library/react';
import App from './App';

test('renders heading', () => {
  global.fetch = jest.fn(() => new Promise(() => {}));
  render(<App />);
  expect(screen.getByText(/seurantasovellus/i)).toBeInTheDocument();
});
