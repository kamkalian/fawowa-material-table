import '../style.css';
import { mount } from 'svelte';
import App from './App.svelte';
import Datenschutz from './Datenschutz.svelte';
import Impressum from './Impressum.svelte';

const savedTheme = (() => {
  try { return localStorage.getItem('theme'); } catch { return null; }
})();
document.documentElement.dataset.theme = savedTheme === 'light' ? 'light' : 'dark';

// Datenschutzerklärung und Impressum sind eigene, kleine Seiten ohne Daten aus der Datenbank
const pfad = location.pathname.replace(/\/+$/, '');
const seite = pfad === '/datenschutz' ? Datenschutz : pfad === '/impressum' ? Impressum : App;
mount(seite, { target: document.getElementById('app') });
