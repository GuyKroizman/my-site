import React, { Suspense, type ReactNode } from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import App from './App.tsx'
import LoadingScreen, { type LoadingVariant } from './components/LoadingScreen.tsx'
// Self-hosted fonts (SIL OFL 1.1) — no third-party font CDN requests.
// Caveat: 400/600/700, Press Start 2P: 400, VT323: 400.
import '@fontsource/caveat/latin-400.css'
import '@fontsource/caveat/latin-600.css'
import '@fontsource/caveat/latin-700.css'
import '@fontsource/press-start-2p/latin-400.css'
import '@fontsource/vt323/latin-400.css'
import './index.css'

// Lazy load pages for code splitting
const SnakeBitter = React.lazy(() => import('./pages/SnakeBitter.tsx'))
const Rogue0 = React.lazy(() => import('./pages/Rogue0.tsx'))
const Hoot = React.lazy(() => import('./pages/Hoot.tsx'))
const RacingGame = React.lazy(() => import('./pages/RacingGame.tsx'))
const TheMask = React.lazy(() => import('./pages/TheMask.tsx'))
const FloatyMcHandface = React.lazy(() => import('./pages/FloatyMcHandface.tsx'))
const AnimViewer = React.lazy(() => import('./pages/AnimViewer.tsx'))
const TinyShooter = React.lazy(() => import('./pages/TinyShooter.tsx'))
const Gmtk2026 = React.lazy(() => import('./pages/Gmtk2026.tsx'))
const Yoga = React.lazy(() => import('./pages/Yoga.tsx'))

/** Each route waits for its own chunk behind a loading screen that matches the page. */
const withLoader = (variant: LoadingVariant, element: ReactNode) => (
  <Suspense fallback={<LoadingScreen variant={variant} />}>{element}</Suspense>
)

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<App />} />
        <Route path="/snake-bitter" element={withLoader('snake', <SnakeBitter />)} />
        <Route path="/rogue0" element={withLoader('rogue0', <Rogue0 />)} />
        <Route path="/hoot" element={withLoader('hoot', <Hoot />)} />
        <Route path="/racing-game" element={withLoader('racing', <RacingGame />)} />
        <Route path="/the-mask" element={withLoader('mask', <TheMask />)} />
        <Route
          path="/floaty-mchandface"
          element={withLoader('floaty', <FloatyMcHandface />)}
        />
        <Route path="/anim_viewer" element={withLoader('anim', <AnimViewer />)} />
        <Route path="/tiny-shooter" element={withLoader('tiny', <TinyShooter />)} />
        <Route path="/gmtk-2026" element={withLoader('gmtk', <Gmtk2026 />)} />
        <Route path="/yoga" element={withLoader('yoga', <Yoga />)} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>,
)
