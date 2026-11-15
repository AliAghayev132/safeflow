import { clsx } from 'clsx'
import { ICONS_3D } from './icons3d'

/**
 * 3D icon. `name` is the file name in src/assets/icons3d (e.g. "fire").
 */
export const Icon3D = ({ name, size = 32, className, alt = '' }) => {
  const src = ICONS_3D[name]
  if (!src) return null
  return (
    <img
      src={src}
      width={size}
      height={size}
      alt={alt}
      aria-hidden={alt ? undefined : true}
      draggable={false}
      className={clsx('shrink-0 select-none object-contain', className)}
    />
  )
}
