import { createSlice, createEntityAdapter, createSelector } from '@reduxjs/toolkit'

/**
 * Live operational picture. Seeded from GET /dispatcher/overview + /roads +
 * /dispatcher/sos/queue and patched by realtime events
 * (see store/context/SocketContext.jsx).
 */
const byCreatedDesc = (a, b) => new Date(b.createdAt) - new Date(a.createdAt)

const sheltersAdapter = createEntityAdapter({
  sortComparer: (a, b) => a.code.localeCompare(b.code),
})
const brigadesAdapter = createEntityAdapter({
  sortComparer: (a, b) => a.code.localeCompare(b.code),
})
const alertsAdapter = createEntityAdapter({ sortComparer: byCreatedDesc })
// No sortComparer: re-sorting thousands of ids on every insert was a major
// cost during SOS floods. Ordering is done once per batch in memoized selectors.
const sosAdapter = createEntityAdapter()

// Keep the store bounded: every open ticket + the most recent closed ones.
const MAX_CLOSED_SOS = 300
const pruneClosedSos = (sosState) => {
  const closed = []
  for (const id of sosState.ids) {
    const s = sosState.entities[id]
    if (s.status !== 'pending' && s.status !== 'assigned') closed.push(s)
  }
  if (closed.length <= MAX_CLOSED_SOS) return
  closed.sort(byCreatedDesc)
  sosAdapter.removeMany(
    sosState,
    closed.slice(MAX_CLOSED_SOS).map((s) => s.id)
  )
}

/**
 * Apply one realtime event to the slice state (used for single events and
 * for coalesced batches — a whole batch is ONE state update / ONE render).
 */
const applyEventToState = (state, { type, data }) => {
  switch (type) {
    case 'sos:new':
    case 'sos:updated': {
      // Spam-flagged SOS (e.g. a bot flood) never stay on the dispatcher panel
      const list = Array.isArray(data) ? data : [data]
      sosAdapter.removeMany(state.sos, list.filter((x) => x.spamFlagged).map((x) => x.id))
      sosAdapter.upsertMany(state.sos, list.filter((x) => !x.spamFlagged))
      break
    }
    case 'shelter:updated':
      sheltersAdapter.upsertOne(state.shelters, data)
      break
    case 'brigade:updated':
      brigadesAdapter.upsertOne(state.brigades, data)
      break
    case 'alert:new':
    case 'alert:updated':
      alertsAdapter.upsertOne(state.alerts, data)
      break
    case 'road:updated':
      for (const edge of data) {
        const current = state.roads.edges[edge.edgeId]
        if (current) state.roads.edges[edge.edgeId] = { ...current, ...edge }
      }
      break
    case 'stats:updated':
      state.summary = data.summary
      state.zones = data.zones
      break
    case 'scenario:updated':
      state.scenario = data
      break
    default:
      break
  }
}

const initialState = {
  hydrated: false,
  summary: null,
  zones: [],
  roads: { nodes: [], edges: {} }, // edges keyed by edgeId
  shelters: sheltersAdapter.getInitialState(),
  brigades: brigadesAdapter.getInitialState(),
  alerts: alertsAdapter.getInitialState(),
  sos: sosAdapter.getInitialState(),
  profiles: {}, // deviceId → optional citizen medical profile
  scenario: null, // running / last demo scenario status
}

const liveSlice = createSlice({
  name: 'live',
  initialState,
  reducers: {
    overviewLoaded: (state, { payload }) => {
      state.summary = payload.summary
      state.zones = payload.zones
      sheltersAdapter.setAll(state.shelters, payload.shelters)
      brigadesAdapter.setAll(state.brigades, payload.brigades)
      alertsAdapter.setAll(state.alerts, payload.alerts)
      // Keep queue entries already loaded (older but still open tickets)
      sosAdapter.upsertMany(state.sos, payload.sos)
      state.hydrated = true
    },
    roadsLoaded: (state, { payload }) => {
      state.roads.nodes = payload.nodes
      state.roads.edges = Object.fromEntries(payload.edges.map((e) => [e.edgeId, e]))
    },
    // Realtime edge updates carry no geometry — keep the stored path.
    roadsUpdated: (state, { payload }) => {
      for (const edge of payload) {
        const current = state.roads.edges[edge.edgeId]
        if (current) state.roads.edges[edge.edgeId] = { ...current, ...edge }
      }
    },
    statsUpdated: (state, { payload }) => {
      state.summary = payload.summary
      state.zones = payload.zones
    },
    shelterUpserted: (state, { payload }) => {
      sheltersAdapter.upsertOne(state.shelters, payload)
    },
    brigadeUpserted: (state, { payload }) => {
      brigadesAdapter.upsertOne(state.brigades, payload)
    },
    alertUpserted: (state, { payload }) => {
      alertsAdapter.upsertOne(state.alerts, payload)
    },
    sosUpserted: (state, { payload }) => {
      sosAdapter.upsertMany(state.sos, Array.isArray(payload) ? payload : [payload])
      pruneClosedSos(state.sos)
    },
    /** Coalesced realtime events → a single state update. */
    eventsBatched: (state, { payload }) => {
      for (const evt of payload) applyEventToState(state, evt)
      pruneClosedSos(state.sos)
    },
    profilesLoaded: (state, { payload }) => {
      state.profiles = { ...state.profiles, ...(payload ?? {}) }
    },
    scenarioUpdated: (state, { payload }) => {
      state.scenario = payload
    },
    reset: () => initialState,
  },
  // Drop the operational picture when the session ends (incl. 401 logout)
  extraReducers: (builder) => {
    builder.addCase('auth/logout', () => initialState)
  },
})

export const {
  overviewLoaded,
  roadsLoaded,
  roadsUpdated,
  statsUpdated,
  shelterUpserted,
  brigadeUpserted,
  alertUpserted,
  sosUpserted,
  eventsBatched,
  profilesLoaded,
  scenarioUpdated,
  reset: resetLive,
} = liveSlice.actions

export default liveSlice.reducer

// ============ SELECTORS ============
const selectLive = (state) => state.live

export const selectHydrated = (state) => state.live.hydrated
export const selectSummary = (state) => state.live.summary
export const selectZones = (state) => state.live.zones
export const selectProfiles = (state) => state.live.profiles
export const selectScenario = (state) => state.live.scenario

export const {
  selectAll: selectShelters,
  selectById: selectShelterById,
  selectEntities: selectShelterEntities,
} = sheltersAdapter.getSelectors((state) => selectLive(state).shelters)

export const {
  selectAll: selectBrigades,
  selectById: selectBrigadeById,
  selectEntities: selectBrigadeEntities,
} = brigadesAdapter.getSelectors((state) => selectLive(state).brigades)

export const { selectAll: selectAlerts, selectById: selectAlertById } =
  alertsAdapter.getSelectors((state) => selectLive(state).alerts)

const { selectAll: selectSosUnordered } = sosAdapter.getSelectors((state) => selectLive(state).sos)

/** All SOS, newest first (sorted once per state change, memoized). */
export const selectSos = createSelector([selectSosUnordered], (sos) => [...sos].sort(byCreatedDesc))

export const selectActiveAlerts = createSelector([selectAlerts], (alerts) =>
  alerts.filter((a) => a.status === 'active')
)

const OPEN = ['pending', 'assigned']

/** Open SOS (pending / assigned) — map + density layer. */
export const selectOpenSos = createSelector([selectSosUnordered], (sos) =>
  sos.filter((s) => OPEN.includes(s.status))
)

/** Triage queue: highest priority first, then oldest first (pinned on top). */
export const selectTriageQueue = createSelector([selectOpenSos], (sos) =>
  [...sos].sort(
    (a, b) =>
      (b.priority ?? 0) - (a.priority ?? 0) ||
      new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  )
)

export const selectRoadEdges = createSelector(
  [(state) => state.live.roads.edges],
  (edges) => Object.values(edges)
)

export const selectClosedRoads = createSelector([selectRoadEdges], (edges) =>
  edges.filter((e) => e.status === 'closed')
)

export const selectZoneById = createSelector([selectZones], (zones) =>
  Object.fromEntries(zones.map((z) => [z.id, z]))
)
