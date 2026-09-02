import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { Providers } from './app/providers'

if (import.meta.env.VITE_APP_ENV === 'qas') {
  document.documentElement.setAttribute('data-theme', 'qas')
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Providers />
  </StrictMode>,
)
