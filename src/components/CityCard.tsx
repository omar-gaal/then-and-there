import { motion } from 'motion/react'
import type { CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import type { City } from '../data/cities'

type CityCardProps = { city: City; index: number }

export function CityCard({ city, index }: CityCardProps) {
  return (
    <motion.article className="city-card" style={{ '--city-accent': city.accent } as CSSProperties} initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 * index, duration: 0.45 }}>
      <div className="city-card__number">0{index + 1}</div>
      <div><p className="eyebrow">{city.country}</p><h2>{city.name}</h2><p>{city.activity}</p></div>
      <div className="city-card__footer"><span>{city.gesture}</span><Link to={`/city/${city.id}`}>Enter city</Link></div>
    </motion.article>
  )
}
