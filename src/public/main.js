import '../style.css';
import { mount } from 'svelte';
import App from './App.svelte';
import Datenschutz from './Datenschutz.svelte';

const savedTheme = (() => {
  try { return localStorage.getItem('theme'); } catch { return null; }
})();
document.documentElement.dataset.theme = savedTheme === 'light' ? 'light' : 'dark';

// Die Datenschutzerklärung ist eine eigene, kleine Seite ohne Daten aus der Datenbank
const istDatenschutz = location.pathname.replace(/\/+$/, '') === '/datenschutz';
mount(istDatenschutz ? Datenschutz : App, { target: document.getElementById('app') });
