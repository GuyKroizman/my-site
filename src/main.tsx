import React, { Suspense } from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import App from './App.tsx'
import './index.css'

// Lazy load game pages for code splitting
const SnakeBitter = React.lazy(() => import('./pages/SnakeBitter.tsx'))
const Rogue0 = React.lazy(() => import('./pages/Rogue0.tsx'))
const Hoot = React.lazy(() => import('./pages/Hoot.tsx'))
const WorkTools = React.lazy(() => import('./pages/WorkTools.tsx'))
const RacingGame = React.lazy(() => import('./pages/RacingGame.tsx'))
const TheMask = React.lazy(() => import('./pages/TheMask.tsx'))
const FloatyMcHandface = React.lazy(() => import('./pages/FloatyMcHandface.tsx'))

// Loading fallback component
const LoadingFallback = () => (
  <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
    <div className="text-center">
      <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mb-4"></div>
      <p className="text-gray-600">Loading...</p>
    </div>
  </div>
)

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <Suspense fallback={<LoadingFallback />}>
        <Routes>
          <Route path="/" element={<App />} />
          <Route path="/snake-bitter" element={<SnakeBitter />} />
          <Route path="/rogue0" element={<Rogue0 />} />
          <Route path="/hoot" element={<Hoot />} />
          <Route path="/work-tools" element={<WorkTools />} />
          <Route path="/racing-game" element={<RacingGame />} />
          <Route path="/the-mask" element={<TheMask />} />
          <Route path="/floaty-mchandface" element={<FloatyMcHandface />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  </React.StrictMode>,
)
