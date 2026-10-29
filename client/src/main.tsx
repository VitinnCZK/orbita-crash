import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
// Fontes servidas pelo próprio site, só o subconjunto latino e os pesos usados.
import '@fontsource/lilita-one/latin-400.css';
import '@fontsource/nunito/latin-700.css';
import './styles.css';

// Depois de um deploy, uma aba aberta pede chunks com hash antigo que não existem mais.
// Recarrega uma vez para pegar o HTML novo (a marca evita loop se o erro for outro).
window.addEventListener('vite:preloadError', (event) => {
  try {
    if (sessionStorage.getItem('orbita-reload')) return;
    sessionStorage.setItem('orbita-reload', '1');
  } catch {
    return;
  }
  event.preventDefault();
  location.reload();
});
window.addEventListener('load', () => {
  setTimeout(() => {
    try {
      sessionStorage.removeItem('orbita-reload');
    } catch {
      // sem sessionStorage, só não há proteção contra loop
    }
  }, 10000);
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
