import '../style.css';
import { mount } from 'svelte';
import App from './App.svelte';

const savedTheme = (() => {
  try { return localStorage.getItem('theme'); } catch { return null; }
})();
document.documentElement.dataset.theme = savedTheme === 'light' ? 'light' : 'dark';

mount(App, { target: document.getElementById('app') });
