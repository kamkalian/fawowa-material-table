<script>
  // Fenster über der Seite für Formulare. Schließt mit Escape oder dem X, nicht durch Klick daneben,
  // damit eine halb ausgefüllte Eingabe nicht versehentlich verloren geht.
  let { titel, onclose, children } = $props();
</script>

<svelte:window onkeydown={(e) => e.key === 'Escape' && onclose()} />

<div class="modal-overlay" role="presentation">
  <div class="modal dialog" role="dialog" aria-modal="true" aria-label={titel}>
    <div class="dialog-kopf">
      <h2>{titel}</h2>
      <button type="button" class="btn btn-ghost btn-icon" aria-label="Schließen" title="Schließen" onclick={onclose}>×</button>
    </div>
    {@render children()}
  </div>
</div>

<style>
  .dialog { max-width: 760px; padding: 1.25rem 1.5rem 1.5rem; }
  .dialog-kopf { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; }
  .dialog-kopf h2 { margin: 0; font-size: 1.0625rem; }
</style>
