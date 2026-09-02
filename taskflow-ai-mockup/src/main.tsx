import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { Providers } from './app/providers'

if (import.meta.env.VITE_APP_ENV === 'qas') {
  document.documentElement.setAttribute('data-theme', 'qas')
  // The favicon is a data: URI baked into index.html, so it can't react to
  // the [data-theme="qas"] CSS override like everything else — swap it here
  // to the same orange used everywhere else (--color-primary-600).
  const favicon = document.querySelector<HTMLLinkElement>('link[rel="icon"]')
  if (favicon) {
    favicon.href =
      "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'><rect width='32' height='32' rx='8' fill='%23ea580c'/><rect x='7' y='9' width='11' height='3' rx='1.5' fill='white'/><rect x='7' y='14.5' width='18' height='3' rx='1.5' fill='white'/><rect x='7' y='20' width='14' height='3' rx='1.5' fill='white'/></svg>"
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Providers />
  </StrictMode>,
)
