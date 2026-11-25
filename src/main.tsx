import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { initFbInstant } from './game/fbInstant';
import './index.css';

async function bootstrap() {
  await initFbInstant();
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>
  );
}

bootstrap();
