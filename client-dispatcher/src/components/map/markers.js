import L from 'leaflet'
import { COLORS, SOS_TYPES, SHELTER_TYPES, BRIGADE_TYPES, BRIGADE_STATUS } from '@constants'
import { occupancyColor } from '@utils'
import { icon3dUrl } from '../ui/Icon3D'

// divIcons are cached by their visual key so react-leaflet doesn't rebuild
// marker DOM on every live update.
const cache = new Map()
const cached = (key, make) => {
  if (!cache.has(key)) cache.set(key, make())
  return cache.get(key)
}

const escapeHtml = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])

const badge = ({ size, imgSize, color, img, label, tag, extraClass = '' }) =>
  `<div class="marker-badge ${extraClass}" style="--marker-color:${color};width:${size}px;height:${size}px">` +
  // Inline size: Leaflet's marker-pane CSS sets `img { width: auto }`, which
  // overrides width/height attributes and renders the PNG at full size.
  `<img src="${img}" style="width:${imgSize}px;height:${imgSize}px" alt="" />` +
  (label ? `<span class="marker-label">${escapeHtml(label)}</span>` : '') +
  (tag ? `<span class="marker-tag">${escapeHtml(tag)}</span>` : '') +
  `</div>`

/**
 * @param {object} shelter
 * @param {object} labels  translated short labels { reserve, fillTag }
 */
export const shelterIcon = (shelter, labels = {}) => {
  const pct = Math.round(shelter.occupancyRate * 100)
  const color = shelter.isActive ? occupancyColor(shelter.occupancyRate) : COLORS.subtle
  const filling = shelter.isActive && shelter.fillingFast
  const tag = filling && Number.isFinite(shelter.fillEtaMin) ? `⏱${Math.round(shelter.fillEtaMin)}′` : null
  const label = shelter.isActive ? `${pct}%` : labels.reserve
  const key = `sh:${shelter.type}:${color}:${pct}:${shelter.isActive}:${tag}:${label}`
  return cached(key, () =>
    L.divIcon({
      className: 'map-icon',
      html: badge({
        size: 40,
        imgSize: 24,
        color,
        img: icon3dUrl(SHELTER_TYPES[shelter.type]?.icon ?? 'shelter'),
        label,
        tag,
        extraClass: [shelter.isActive ? '' : 'marker-inactive', filling ? 'marker-filling' : '']
          .join(' ')
          .trim(),
      }),
      iconSize: [40, 48],
      iconAnchor: [20, 20],
      popupAnchor: [0, -20],
    })
  )
}

export const brigadeIcon = (brigade) => {
  const color = BRIGADE_STATUS[brigade.status]?.color ?? COLORS.muted
  const key = `br:${brigade.type}:${color}`
  return cached(key, () =>
    L.divIcon({
      className: 'map-icon',
      html: badge({
        size: 34,
        imgSize: 22,
        color,
        img: icon3dUrl(BRIGADE_TYPES[brigade.type]?.icon ?? 'fireEngine'),
      }),
      iconSize: [34, 34],
      iconAnchor: [17, 17],
      popupAnchor: [0, -17],
    })
  )
}

export const sosIcon = (sos) => {
  const type = SOS_TYPES[sos.type] ?? SOS_TYPES.general
  const spam = Boolean(sos.spamFlagged)
  const color = spam ? COLORS.spam : sos.status === 'assigned' ? COLORS.warning : type.color
  const key = `sos:${sos.type}:${color}:${spam}`
  return cached(key, () =>
    L.divIcon({
      className: 'map-icon',
      html: badge({
        size: 26,
        imgSize: 16,
        color,
        img: icon3dUrl(type.icon),
        extraClass: spam ? 'marker-spam' : '',
      }),
      iconSize: [26, 26],
      iconAnchor: [13, 13],
      popupAnchor: [0, -13],
    })
  )
}

export const alertPulseIcon = () =>
  cached('alert-pulse', () =>
    L.divIcon({
      className: 'map-icon',
      html: '<div class="alert-pulse"><span class="alert-core"></span></div>',
      iconSize: [64, 64],
      iconAnchor: [32, 32],
    })
  )

export const pickedPointIcon = () =>
  cached('picked', () =>
    L.divIcon({
      className: 'map-icon',
      html: `<img src="${icon3dUrl('pin')}" style="width:36px;height:36px" alt="" />`,
      iconSize: [36, 36],
      iconAnchor: [18, 34],
    })
  )
