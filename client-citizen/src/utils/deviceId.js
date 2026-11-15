const STORAGE_KEY = 'crisis.deviceId'

const safeGet = (key) => {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

const safeSet = (key, value) => {
  try {
    localStorage.setItem(key, value)
  } catch {
    // storage unavailable (private mode) — id lives for this tab only
  }
}

/**
 * Anonymous, persistent device id (UUID v4). Lets the backend track this
 * citizen's route and push personal rerouting updates without an account.
 */
export const getDeviceId = () => {
  let id = safeGet(STORAGE_KEY)
  if (!id) {
    id = crypto.randomUUID()
    safeSet(STORAGE_KEY, id)
  }
  return id
}

export const storage = { get: safeGet, set: safeSet }
