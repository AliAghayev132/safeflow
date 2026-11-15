import { useCallback, useEffect, useRef, useState } from 'react'
import { speechSupported } from '@utils'

/**
 * Web Speech API wrapper. `start(lang)` → resolves with the final transcript
 * (or null). Works hands-free for people who can't type (e.g. trapped).
 */
export const useSpeech = () => {
  const [listening, setListening] = useState(false)
  const [interim, setInterim] = useState('')
  const [errorKey, setErrorKey] = useState(null)
  const recRef = useRef(null)
  const supported = speechSupported()

  useEffect(() => () => recRef.current?.abort?.(), [])

  const start = useCallback(
    (lang) =>
      new Promise((resolve) => {
        if (!supported) {
          resolve(null)
          return
        }
        const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition
        const rec = new Recognition()
        recRef.current = rec
        rec.lang = lang
        rec.interimResults = true
        rec.maxAlternatives = 1
        rec.continuous = false

        let finalText = ''
        setInterim('')
        setErrorKey(null)
        setListening(true)

        rec.onresult = (e) => {
          let text = ''
          for (let i = 0; i < e.results.length; i++) {
            text += e.results[i][0].transcript
            if (e.results[i].isFinal) finalText = text
          }
          setInterim(text)
        }
        rec.onerror = (e) => {
          setErrorKey(e.error === 'not-allowed' || e.error === 'service-not-allowed' ? 'denied' : 'error')
        }
        rec.onend = () => {
          setListening(false)
          resolve(finalText.trim() || null)
        }
        try {
          rec.start()
        } catch {
          setListening(false)
          resolve(null)
        }
      }),
    [supported]
  )

  const stop = useCallback(() => recRef.current?.stop(), [])

  return { supported, listening, interim, errorKey, start, stop }
}
