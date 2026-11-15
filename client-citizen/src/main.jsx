import { createRoot } from 'react-dom/client'
import './i18n'
import { App } from './App.jsx'

createRoot(document.getElementById('root')).render(<App />)

// Offline support: cache the app shell so the app opens without internet.
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => null)
  })
}
