import { baseApi, citizenApi, ALL_TAGS } from '@store/api'
import { selectPlanArgs, showRerouteNotice } from '@store/slices/sessionSlice'
import { ticketUpdated, clearTicket } from '@store/slices/sosSlice'
import { SHELTER_FULL_RATE } from '@constants'

/**
 * Applies one realtime event { seq, type, data } to the store / RTK cache.
 * Used for live socket events, socket "sync" replays and polling fallback.
 */
export const applyEvent = (evt, { dispatch, getState }) => {
  const patchPlan = (recipe) => {
    const args = selectPlanArgs(getState())
    if (args) dispatch(citizenApi.util.updateQueryData('getEvacuationPlan', args, recipe))
  }

  switch (evt.type) {
    case 'shelter:updated': {
      const shelter = evt.data
      dispatch(
        citizenApi.util.updateQueryData('getShelters', undefined, (draft) => {
          const i = draft.findIndex((s) => s.id === shelter.id)
          if (!shelter.isActive) {
            if (i !== -1) draft.splice(i, 1)
          } else if (i === -1) draft.push(shelter)
          else draft[i] = shelter
        })
      )
      patchPlan((draft) => {
        for (const option of draft.options ?? []) {
          if (option.shelter.id === shelter.id) {
            option.shelter = shelter
            option.isFull = shelter.occupancyRate >= SHELTER_FULL_RATE
          }
        }
        if (draft.recommended?.shelter.id === shelter.id) draft.recommended.shelter = shelter
      })
      break
    }

    case 'road:updated': {
      dispatch(
        citizenApi.util.updateQueryData('getRoads', undefined, (draft) => {
          for (const edge of evt.data) {
            const target = draft.edges?.find((e) => e.edgeId === edge.edgeId)
            if (target) {
              target.status = edge.status
              target.congestion = edge.congestion
            }
          }
        })
      )
      break
    }

    case 'route:updated': {
      const payload = evt.data
      patchPlan((draft) => {
        draft.recommended = payload.recommended
        draft.options = payload.options
        if (payload.routing) draft.routing = payload.routing
      })
      dispatch(
        showRerouteNotice({
          reason: payload.reason,
          context: payload.context,
          shelterName: payload.recommended?.shelter.name ?? null,
          at: payload.at ?? evt.at,
        })
      )
      navigator.vibrate?.([120, 60, 120])
      break
    }

    case 'sos:updated': {
      dispatch(ticketUpdated(evt.data))
      dispatch(citizenApi.util.invalidateTags(['CitizenState']))
      break
    }

    case 'system:reset': {
      dispatch(clearTicket())
      dispatch(baseApi.util.invalidateTags(ALL_TAGS))
      break
    }

    default:
      break
  }
}
