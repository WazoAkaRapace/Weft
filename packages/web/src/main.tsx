import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <div className="app">
      <h1>Weft Web</h1>
      <p>Welcome to the Weft web application.</p>
    </div>
  </StrictMode>
);
