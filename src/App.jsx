import { useState } from 'react'
import { AmsterdamExperience } from './components/AmsterdamExperience'
import { ParisExperience } from './components/ParisExperience'
import './App.css'

function App() {
  const [city, setCity] = useState('amsterdam')

  return (
    <main className="app-shell">
      <nav className="city-switcher" aria-label="Choose prototype">
        <strong>THEN & THERE</strong>
        <div><button type="button" data-active={city === 'paris'} onClick={() => setCity('paris')}>Paris</button><button type="button" data-active={city === 'amsterdam'} onClick={() => setCity('amsterdam')}>Amsterdam</button></div>
      </nav>
      {city === 'paris' ? <ParisExperience /> : <AmsterdamExperience />}
    </main>
  )
}

export default App
