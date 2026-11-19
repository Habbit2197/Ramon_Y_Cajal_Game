import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { installAudioUnlock } from './engine/mobile';

installAudioUnlock();

// Pulsación larga en el juego: sin menú contextual (en móvil interrumpe la partida)
document.addEventListener('contextmenu', (e) => {
  if ((e.target as HTMLElement | null)?.closest?.('canvas, [data-game-surface]')) e.preventDefault();
});

createRoot(document.getElementById('root')!).render(<App />);

// Jugar sin internet: el service worker solo se registra en la versión publicada
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      /* si el navegador lo bloquea (modo privado estricto), el juego funciona igual con conexión */
    });
  });
}
