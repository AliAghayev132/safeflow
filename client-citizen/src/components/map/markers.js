import L from 'leaflet'
import { ICONS_3D } from '@components/ui/icons3d'
import { shelterTypes } from '@constants'
import { occupancyTone, occupancyColors } from '@utils'

/**
 * Leaflet divIcons built from the 3D icon set. Solid colours only.
 */
export const shelterIcon = (shelter, { highlighted = false } = {}) => {
  const tone = occupancyTone(shelter.occupancyRate)
  const ring = occupancyColors[tone].hex
  const size = highlighted ? 48 : 38
  const img = ICONS_3D[shelterTypes[shelter.type]?.icon ?? 'shelter']
  const pct = Math.round(shelter.occupancyRate * 100)

  return L.divIcon({
    className: 'leaflet-div-icon-reset',
    iconSize: [size, size + 16],
    iconAnchor: [size / 2, size / 2],
    html: `
      <div style="display:flex;flex-direction:column;align-items:center;">
        <div style="width:${size}px;height:${size}px;border-radius:9999px;background:#fff;border:3px solid ${highlighted ? '#12305a' : ring};display:flex;align-items:center;justify-content:center;box-shadow:0 1px 3px rgba(15,23,42,.25);">
          <img src="${img}" style="width:${size - 14}px;height:${size - 14}px;" alt="" />
        </div>
        <span style="margin-top:2px;padding:0 5px;border-radius:6px;background:${ring};color:#fff;font:700 11px/16px Inter,system-ui,sans-serif;">${pct}%</span>
      </div>`,
  })
}

export const userIcon = () =>
  L.divIcon({
    className: 'leaflet-div-icon-reset',
    iconSize: [22, 22],
    iconAnchor: [11, 11],
    html: `
      <div style="position:relative;width:22px;height:22px;">
        <span class="pulse-ring" style="position:absolute;inset:0;border-radius:9999px;background:#1d4ed8;"></span>
        <span style="position:absolute;inset:3px;border-radius:9999px;background:#1d4ed8;border:3px solid #fff;box-shadow:0 1px 3px rgba(15,23,42,.35);"></span>
      </div>`,
  })
