import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './styles/globals.css'

// NOTE: StrictMode intentionally removed — it double-invokes effects in development,
// which aborts in-flight fetches on the first invocation and causes the second
// invocation to skip fetching entirely (id-guard fires). Result: AI panel
// freezes with loading=true and never resolves. AIAnalysis is now StrictMode-safe
// via token-based stale-result discard, but removing StrictMode avoids the
// double-fetch overhead and double-store-subscription warnings in the console.
ReactDOM.createRoot(document.getElementById('root')).render(
  <App />
)
// Feature — uptime tracking
window._shyenStart = Date.now()
