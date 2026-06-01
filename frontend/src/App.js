import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Home from './pages/Home'
import Download from './pages/Download'
import Manage from './pages/Manage'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/"               element={<Home />} />
        <Route path="/d/:token"       element={<Download />} />
        <Route path="/my/:ownerToken" element={<Manage />} />
      </Routes>
    </BrowserRouter>
  )
}
