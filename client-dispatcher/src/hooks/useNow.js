import { useEffect, useState } from 'react'

/** Current timestamp, re-rendering every `intervalMs` (live clocks, "ago"). */
export const useNow = (intervalMs = 1000) => {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs)
    return () => clearInterval(id)
  }, [intervalMs])
  return now
}

export default useNow
