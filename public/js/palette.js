// Colour names for data colours. Path and draw-category colours are stored as hex in the data files;
// hue() swaps a known hex for a CSS variable so each colour has a light and a dark-theme value.
const HUES = {
  '#1f4fa8': 'blue', '#b4263a': 'red', '#1d7650': 'green', '#8a5a00': 'amber', '#2f6fd1': 'azure', '#6a4bc4': 'violet',
  '#0f7b83': 'teal', '#155e75': 'cyan', '#9d174d': 'pink', '#4d7c0f': 'lime', '#65731b': 'olive', '#b45309': 'orange',
  '#7c2d12': 'brown', '#475569': 'slate'
};
export const hue = (c) => { const n = HUES[String(c).toLowerCase()]; return n ? 'var(--hue-' + n + ')' : c; };
// Recolour a list of paths in place (safe to call more than once)
export const huePaths = (paths) => { for (const p of paths || []) p.color = hue(p.color); return paths; };
