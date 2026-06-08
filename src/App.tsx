import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { CityPage } from './pages/CityPage'
import { HomePage } from './pages/HomePage'
import { TrackingTestPage } from './pages/TrackingTestPage'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/city/:cityId" element={<CityPage />} />
        <Route path="/tracking-test" element={<TrackingTestPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
