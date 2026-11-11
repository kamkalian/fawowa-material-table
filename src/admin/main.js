import '../style.css';
import './admin.css';
import { mount } from 'svelte';
import AdminApp from './AdminApp.svelte';

document.documentElement.dataset.theme = (() => {
  try { return localStorage.getItem('theme') === 'light' ? 'light' : 'dark'; } catch { return 'dark'; }
})();

mount(AdminApp, { target: document.getElementById('admin') });
