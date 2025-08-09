import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import App from './App.tsx'
import SnakeBitter from './pages/SnakeBitter.tsx'
import Rogue0 from './pages/Rogue0.tsx'
import Hoot from './pages/Hoot.tsx'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<App />} />
        <Route path="/snake-bitter" element={<SnakeBitter />} />
        <Route path="/rogue0" element={<Rogue0 />} />
        <Route path="/hoot" element={<Hoot />} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>,
)
