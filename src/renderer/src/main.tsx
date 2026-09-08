import './assets/main.css'

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { IdeasDataProvider } from './context/IdeasDataProvider'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <IdeasDataProvider>
      <App />
    </IdeasDataProvider>
  </StrictMode>
)
