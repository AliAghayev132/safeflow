/**
 * Banner slot for feature modules. Every components/modules/*Banner.jsx
 * exports `Banner` (+ optional `feature`) and is rendered under the header
 * while its feature flag is on — modules never edit the layout.
 */
import { useFeatures } from '@hooks'

const files = import.meta.glob('./modules/*Banner.jsx', { eager: true })
const BANNERS = Object.entries(files)
  .map(([path, m]) => ({ key: path, Banner: m.Banner, feature: m.feature }))
  .filter((b) => b.Banner)

export const ModuleBanners = () => {
  const features = useFeatures()
  return BANNERS.filter((b) => !b.feature || features[b.feature] === true).map(({ key, Banner }) => (
    <Banner key={key} />
  ))
}
