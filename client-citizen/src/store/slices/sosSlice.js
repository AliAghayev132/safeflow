import { createSlice } from '@reduxjs/toolkit'
import { storage } from '@utils/deviceId'

const STORAGE_KEY = 'crisis.sos'

const load = () => {
  try {
    const raw = storage.get(STORAGE_KEY)
    const parsed = raw ? JSON.parse(raw) : {}
    return { active: parsed.active ?? null, outbox: Array.isArray(parsed.outbox) ? parsed.outbox : [] }
  } catch {
    return { active: null, outbox: [] }
  }
}

let lastPersisted = ''
export const persistSos = ({ active, outbox }) => {
  const next = JSON.stringify({ active, outbox })
  if (next === lastPersisted) return
  lastPersisted = next
  storage.set(STORAGE_KEY, next)
}

/**
 * The citizen's live SOS ticket and the offline outbox.
 *
 * Every SOS gets a clientId (UUID) on the device; the backend treats it as an
 * idempotency key, so the outbox can retry as often as needed.
 *
 * active: { clientId, id?, type, status, sentAt, queued, approxLocation, details }
 * outbox: [{ payload, attempts, nextAttemptAt }]
 */
const sosSlice = createSlice({
  name: 'sos',
  initialState: load(),
  reducers: {
    ticketStarted: (state, { payload }) => {
      state.active = {
        clientId: payload.clientId,
        id: null,
        type: payload.type,
        status: payload.queued ? 'queued' : 'sending',
        sentAt: payload.sentAt,
        queued: Boolean(payload.queued),
        approxLocation: Boolean(payload.approxLocation),
        details: {},
      }
    },
    ticketAccepted: (state, { payload: sos }) => {
      if (!state.active) return
      state.active.id = sos.id
      state.active.status = sos.status
      state.active.queued = false
      // A repeat tap merged into an earlier ticket — follow that one
      if (sos.clientId && sos.clientId !== state.active.clientId) state.active.serverClientId = sos.clientId
    },
    ticketUpdated: (state, { payload: sos }) => {
      const a = state.active
      if (!a) return
      const same = a.id === sos.id || a.clientId === sos.clientId || a.serverClientId === sos.clientId
      if (same) {
        a.id = sos.id
        a.status = sos.status
        a.type = sos.type
      }
    },
    ticketQueued: (state) => {
      if (state.active && ['sending', 'queued'].includes(state.active.status)) {
        state.active.status = 'queued'
        state.active.queued = true
      }
    },
    ticketFailed: (state) => {
      if (state.active?.status === 'sending') state.active = null
    },
    detailsSaved: (state, { payload }) => {
      if (state.active) state.active.details = { ...state.active.details, ...payload }
    },
    clearTicket: (state) => {
      state.active = null
    },
    enqueue: (state, { payload }) => {
      if (!state.outbox.some((o) => o.payload.clientId === payload.clientId)) {
        state.outbox.push({ payload, attempts: 0, nextAttemptAt: 0 })
      }
    },
    // Follow-up answers given while the SOS still waits in the outbox
    mergeQueuedDetails: (state, { payload: { clientId, details } }) => {
      const item = state.outbox.find((o) => o.payload.clientId === clientId)
      if (item) item.payload = { ...item.payload, ...details }
    },
    dequeue: (state, { payload: clientId }) => {
      state.outbox = state.outbox.filter((o) => o.payload.clientId !== clientId)
    },
    retryLater: (state, { payload: { clientId, delayMs } }) => {
      const item = state.outbox.find((o) => o.payload.clientId === clientId)
      if (item) {
        item.attempts += 1
        item.nextAttemptAt = Date.now() + delayMs
      }
    },
  },
})

export const {
  ticketStarted,
  ticketAccepted,
  ticketUpdated,
  ticketQueued,
  ticketFailed,
  detailsSaved,
  clearTicket,
  enqueue,
  mergeQueuedDetails,
  dequeue,
  retryLater,
} = sosSlice.actions

export const selectActiveTicket = (state) => state.sos.active
export const selectOutbox = (state) => state.sos.outbox

export default sosSlice.reducer
