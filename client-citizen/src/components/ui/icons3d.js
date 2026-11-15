// All 3D icons (Microsoft Fluent Emoji 3D, MIT) bundled at build time.
const files = import.meta.glob('/src/assets/icons3d/*.png', { eager: true, import: 'default' })

/** name → bundled URL, e.g. ICONS_3D.fire */
export const ICONS_3D = Object.fromEntries(
  Object.entries(files).map(([path, url]) => [path.split('/').pop().replace('.png', ''), url])
)
