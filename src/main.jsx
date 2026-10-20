import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'

// The API is guarded by a shared secret (functions/api/_middleware.js). Open the app once with
// `#key=<secret>` on the end of the URL; it is saved on this device and added to every /api call.
// The URL fragment is never sent to the server.
const KEY_NAME = 'hirakata_key'
const fromHash = new URLSearchParams(location.hash.slice(1)).get('key')
if (fromHash) {
  try { localStorage.setItem(KEY_NAME, fromHash) } catch {}
  history.replaceState(null, '', location.pathname + location.search)
}
const nativeFetch = window.fetch.bind(window)
window.fetch = (input, init = {}) => {
  const url = typeof input === 'string' ? input : input.url
  if (!url.startsWith('/api/')) return nativeFetch(input, init)
  let key = ''
  try { key = localStorage.getItem(KEY_NAME) || '' } catch {}
  return nativeFetch(input, { ...init, headers: { ...init.headers, 'x-hirakata-key': key } })
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
