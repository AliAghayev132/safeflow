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
const sosAdapter = createEntityAdapter({ sortComparer: byCreatedDesc })

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

export const { selectAll: selectSos } = sosAdapter.getSelectors((state) => selectLive(state).sos)

export const selectActiveAlerts = createSelector([selectAlerts], (alerts) =>
  alerts.filter((a) => a.status === 'active')
)

const OPEN = ['pending', 'assigned']

/** Open SOS (pending / assigned) — map + density layer. */
export const selectOpenSos = createSelector([selectSos], (sos) =>
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
