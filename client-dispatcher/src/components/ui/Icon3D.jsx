/* eslint-disable react-refresh/only-export-components */
import { clsx } from 'clsx'

// Fluent 3D icon set (MIT, Microsoft) bundled from src/assets/icons3d/*.png
const modules = import.meta.glob('/src/assets/icons3d/*.png', {
  eager: true,
  import: 'default',
})

const ICONS = Object.fromEntries(
  Object.entries(modules).map(([path, url]) => [
    path.split('/').pop().replace('.png', ''),
    url,
  ])
)

/** URL of a 3D icon (for Leaflet divIcons and other raw HTML). */
export const icon3dUrl = (name) => ICONS[name] ?? ICONS.warning

export const Icon3D = ({ name, size = 28, className, alt = '' }) => (
  <img
    src={icon3dUrl(name)}
    width={size}
    height={size}
    alt={alt}
    draggable={false}
    className={clsx('inline-block shrink-0 select-none', className)}
  />
)
