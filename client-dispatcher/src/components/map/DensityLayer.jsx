import { useMemo } from 'react'
import { Rectangle, Tooltip } from 'react-leaflet'
import { useTranslation } from 'react-i18next'
import { HEAT_CELL_DEG, HEAT_LEVELS } from '@constants'

/**
 * SOS density "heatmap" with solid colours (no gradients): open SOS are
 * binned into a ~280 m grid and each cell is filled by count bucket.
 * Spam-flagged tickets are excluded so fake floods don't paint the map.
 */
export const DensityLayer = ({ sos }) => {
  const { t } = useTranslation()

  const cells = useMemo(() => {
    const bins = new Map()
    for (const s of sos) {
      if (s.spamFlagged || s.citizenSafe) continue
      const i = Math.floor(s.lat / HEAT_CELL_DEG)
      const j = Math.floor(s.lng / HEAT_CELL_DEG)
      const key = `${i}:${j}`
      const cell = bins.get(key) ?? { i, j, count: 0 }
      cell.count += 1
      bins.set(key, cell)
    }
    return [...bins.values()]
  }, [sos])

  return cells.map((cell) => {
    const level = HEAT_LEVELS.find((l) => cell.count >= l.min) ?? HEAT_LEVELS.at(-1)
    const bounds = [
      [cell.i * HEAT_CELL_DEG, cell.j * HEAT_CELL_DEG],
      [(cell.i + 1) * HEAT_CELL_DEG, (cell.j + 1) * HEAT_CELL_DEG],
    ]
    return (
      <Rectangle
        key={`${cell.i}:${cell.j}`}
        bounds={bounds}
        pathOptions={{
          color: level.color,
          weight: 1,
          fillColor: level.color,
          fillOpacity: level.opacity,
        }}
      >
        <Tooltip sticky>{t('map.heatCell', { count: cell.count })}</Tooltip>
      </Rectangle>
    )
  })
}
