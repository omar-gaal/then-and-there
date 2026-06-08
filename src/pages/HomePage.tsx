import { Link } from 'react-router-dom'
import { CityCard } from '../components/CityCard'
import { cities } from '../data/cities'

export function HomePage() {
  return (
    <main className="page-shell">
      <nav className="topbar"><Link className="wordmark" to="/">Then <span>&</span> There</Link><Link className="text-link" to="/tracking-test">Tracking test</Link></nav>
      <section className="hero"><p className="eyebrow">An interactive cultural journey</p><h1>Move through Europe.</h1><p className="hero__copy">Three cities. Three gestures. Let your body become the controller.</p></section>
      <section className="city-grid" aria-label="Choose your city">{cities.map((city, index) => <CityCard city={city} index={index} key={city.id} />)}</section>
    </main>
  )
}
