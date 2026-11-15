// Pure helpers for the config editor (flatten / patch building / field meta).

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

/** Parse a draft value back to the type of the default value. */
export const parseValue = (raw, sample) => {
  if (Array.isArray(sample)) {
    if (Array.isArray(raw)) return raw
    return String(raw)
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
  }
  if (typeof sample === 'number') {
    const n = Number(raw)
    return Number.isFinite(n) ? n : NaN
  }
  if (typeof sample === 'boolean') return raw === true || raw === 'true'
  return raw
}

export const formatValue = (value) => (Array.isArray(value) ? value.join(', ') : String(value ?? ''))

export const sameValue = (a, b) => JSON.stringify(a) === JSON.stringify(b)

/** "deviceBurstWindowMs" → "Device burst window" (fallback label). */
export const humanize = (key) => {
  const words = key
    .replace(/(Ms|Sec|Meters|Kmh|Minutes|Pct|Kg|Bytes)$/, '')
    .replace(/[._-]+/g, ' ')
    .replace(/([a-z\d])([A-Z])/g, '$1 $2')
    .trim()
    .toLowerCase()
  return words.charAt(0).toUpperCase() + words.slice(1)
}

/** Unit shown inside a number field, from the key suffix. */
export const unitOf = (path) => {
  const key = path.split('.').at(-1)
  if (/Ms$/.test(key)) return 'ms'
  if (/Sec$/.test(key)) return 'sec'
  if (/Meters$/.test(key)) return 'm'
  if (/Kmh$/.test(key)) return 'kmh'
  if (/Minutes$/.test(key)) return 'min'
  if (/Pct$/.test(key)) return 'pct'
  if (/Bytes$/.test(key)) return 'bytes'
  if (/PerMin$/.test(key)) return 'perMin'
  return null
}

/** Small human hint for a value (minutes for *Ms, percent for thresholds). */
export const valueHint = (path, value) => {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null
  if (/Ms$/.test(path)) {
    return value >= 60000
      ? { key: 'config.minutesHint', params: { value: +(value / 60000).toFixed(1) } }
      : { key: 'config.secondsHint', params: { value: +(value / 1000).toFixed(1) } }
  }
  if (/Bytes$/.test(path)) return { key: 'config.mbHint', params: { value: +(value / 1048576).toFixed(1) } }
  if (/(Threshold|Rate)$/.test(path) && value <= 1) {
    return { key: 'config.percentHint', params: { value: Math.round(value * 100) } }
  }
  return null
}

/**
 * Menu categories → config sections. Sections not listed here (a new
 * module's config) fall into "modules" automatically.
 */
export const CATEGORIES = [
  { key: 'features', icon: 'gear', sections: ['features'] },
  { key: 'alerts', icon: 'siren', sections: ['sosCluster', 'shelter'] },
  { key: 'sosTriage', icon: 'sos', sections: ['sos', 'triage'] },
  { key: 'response', icon: 'fireEngine', sections: ['brigade', 'routing'] },
  { key: 'modules', icon: 'helicopter', sections: [] },
  { key: 'security', icon: 'shield', sections: ['rateLimits', 'events'] },
]

export const categorize = (sectionKeys) => {
  const known = new Set(CATEGORIES.flatMap((c) => c.sections))
  return CATEGORIES.map((c) =>
    c.key === 'modules'
      ? { ...c, sections: sectionKeys.filter((k) => !known.has(k)) }
      : { ...c, sections: c.sections.filter((k) => sectionKeys.includes(k)) }
  ).filter((c) => c.sections.length)
}

/**
 * Leaf fields of a section grouped by their parent object:
 *   [{ group: null | 'spam', fields: [{ path, value }] }]
 */
export const groupFields = (sectionKey, sectionValue) => {
  const groups = new Map()
  for (const f of flatten({ [sectionKey]: sectionValue })) {
    const parts = f.path.split('.')
    const group = parts.length > 2 ? parts.slice(1, -1).join('.') : null
    if (!groups.has(group)) groups.set(group, [])
    groups.get(group).push(f)
  }
  // Plain fields first, then nested groups
  return [...groups.entries()]
    .sort(([a], [b]) => (a === null ? -1 : b === null ? 1 : 0))
    .map(([group, fields]) => ({ group, fields }))
}
