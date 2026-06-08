import type { CSSProperties } from 'react'
import { Link, useParams } from 'react-router-dom'
import { getCity } from '../data/cities'

export function CityPage() {
  const city = getCity(useParams().cityId)
  if (!city) return <main className="centered-page"><h1>City not found</h1><Link className="button" to="/">Return home</Link></main>

  return (
    <main className="centered-page city-intro" style={{ '--city-accent': city.accent } as CSSProperties}>
      <p className="eyebrow">{city.country}</p><h1>{city.name}</h1><p className="large-copy">{city.activity}</p>
      <p className="status">Game module ready for development · {city.gesture}</p>
      <div className="actions"><Link className="button" to="/tracking-test">Test tracking</Link><Link className="button button--quiet" to="/">Choose another city</Link></div>
    </main>
  )
}
