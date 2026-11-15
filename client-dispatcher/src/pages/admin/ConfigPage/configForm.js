// Pure helpers for the config editor (flatten / patch building).

const isObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v)

/** Leaf paths of a config section: [{ path: 'sosCluster.windowMs', value }] */
export const flatten = (obj, prefix = '') =>
  Object.entries(obj).flatMap(([key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key
    return isObject(value) ? flatten(value, path) : [{ path, value }]
  })

export const getPath = (obj, path) =>
  path.split('.').reduce((acc, key) => (acc == null ? undefined : acc[key]), obj)

/** Nested deep-partial patch from { 'a.b.c': value } */
export const buildPatch = (draft) => {
  const patch = {}
  for (const [path, value] of Object.entries(draft)) {
    const keys = path.split('.')
    let node = patch
    keys.slice(0, -1).forEach((k) => {
      node[k] = node[k] ?? {}
      node = node[k]
    })
    node[keys.at(-1)] = value
  }
  return patch
}

/** Parse a draft input string back to the type of the default value. */
export const parseValue = (raw, sample) => {
  if (Array.isArray(sample)) {
    return String(raw)
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
  }
  if (typeof sample === 'number') {
    const n = Number(raw)
    return Number.isFinite(n) ? n : NaN
  }
  return raw
}

export const formatValue = (value) => (Array.isArray(value) ? value.join(', ') : String(value ?? ''))

/** Small human hint for a value (minutes for *Ms, percent for thresholds). */
export const valueHint = (path, value) => {
  if (typeof value !== 'number') return null
  if (/Ms$/.test(path)) {
    return value >= 60000
      ? { key: 'config.minutesHint', params: { value: +(value / 60000).toFixed(1) } }
      : { key: 'config.secondsHint', params: { value: +(value / 1000).toFixed(1) } }
  }
  if (/Threshold$/.test(path) && value <= 1) {
    return { key: 'config.percentHint', params: { value: Math.round(value * 100) } }
  }
  return null
}
