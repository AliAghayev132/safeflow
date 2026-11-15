import { useEffect } from 'react'
import { useDispatch } from 'react-redux'
import { useSocket } from '@store/context'
import { baseApi } from '@store/api/baseApi'

const TAGS_BY_TYPE = {
  'drone:updated': ['Drones'],
  'supply:updated': ['Supplies'],
  'delivery:updated': ['Deliveries', 'Supplies'],
}

/**
 * Live drone / supply updates: realtime `evt` messages of this module
 * (channels drones + supplies) invalidate its RTK Query tags, coalesced to at
 * most one refetch per second — position ticks of a whole fleet stay cheap.
 * Queries also poll slowly as a fallback when the socket is down.
 */
export const useDroneLive = () => {
  const { socket } = useSocket()
  const dispatch = useDispatch()

  useEffect(() => {
    if (!socket) return undefined
    let pending = new Set()
    let timer = null
    const flush = () => {
      timer = null
      if (pending.size) dispatch(baseApi.util.invalidateTags([...pending]))
      pending = new Set()
    }
    const onEvt = (evt) => {
      const tags = TAGS_BY_TYPE[evt?.type]
      if (!tags) return
      tags.forEach((t) => pending.add(t))
      if (!timer) timer = setTimeout(flush, 1000)
    }
    socket.on('evt', onEvt)
    return () => {
      socket.off('evt', onEvt)
      clearTimeout(timer)
    }
  }, [socket, dispatch])
}

/** Polling fallback interval for module queries (ms). */
export const DRONE_POLL_MS = 15000
