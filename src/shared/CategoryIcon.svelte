<script>
  // Zeigt das Icon einer Kategorie in der Akzentfarbe. Die Zeichnungen und Stilregeln stehen in Icon.svelte.
  // Unbekannte oder fehlende Namen ergeben einen neutralen Kreis.
  import Icon from './Icon.svelte';

  let { name = null, size = 16, title = '' } = $props();
</script>

<span class="cat-icon" role={title ? 'img' : undefined} aria-label={title || undefined} aria-hidden={title ? undefined : 'true'} {title}>
  <Icon name={name ?? 'circle'} {size} />
</span>

<style>
  .cat-icon { display: inline-flex; align-items: center; vertical-align: middle; flex-shrink: 0; color: var(--primary); }
</style>
