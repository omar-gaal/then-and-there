// Paper map overlay: renders town areas, player position, bike part markers, and map legend.
import { TOWN_AREAS } from '../game/townAreas'

export function TownMap({ mapData, onClose }) {
  const parts = mapData.parts
  const player = mapData.player
  const currentArea = TOWN_AREAS.find((area) => area.id === mapData.areaId) ?? TOWN_AREAS[0]
  const foundCount = parts.filter((part) => part.collected).length

  return (
    <aside className="town-map" aria-label="Copenhagen street map">
      <div className="town-map-header">
        <div>
          <strong>Copenhagen pocket map</strong>
          <span>Parts found: {foundCount} / {parts.length}</span>
          <span>Current area: {currentArea.label}</span>
        </div>
        <button type="button" onClick={onClose} aria-label="Close map">×</button>
      </div>

      <div className="town-map-diagram" aria-hidden="true">
        <div className="town-map-left-street">
          <span></span>
        </div>
        <div className="town-map-street">
          <span></span>
        </div>
        {TOWN_AREAS.map((area) => (
          <div
            key={area.id}
            className="town-map-area"
            data-current={area.id === currentArea.id ? 'true' : 'false'}
            style={{
              '--area-x': `${area.mapPosition.x * 100}%`,
              '--area-y': `${area.mapPosition.y * 100}%`,
            }}
            title={area.description}
          >
            <span></span>
            <em>{area.label}</em>
          </div>
        ))}
        {parts.map((part) => (
          <div
            key={part.id}
            className="town-map-part"
            data-collected={part.collected ? 'true' : 'false'}
            data-area={part.areaId ?? 'mainStreet'}
            data-map-side={part.mapSide ?? 'right'}
            style={{
              '--label-x': `${part.labelOffsetX ?? 14}px`,
              '--label-y': `${part.labelOffsetY ?? 0}px`,
              '--map-x': `${part.sidePosition * 100}%`,
              '--map-y': `${part.progress * 100}%`,
            }}
            title={part.label}
          >
            <span>{part.collected ? '✓' : getPartMapIcon(part.label)}</span>
            <em>{toTitleCase(part.label)}</em>
          </div>
        ))}
        <div
          className="town-map-player"
          data-side={player.side}
          style={{
            '--map-x': `${player.sidePosition * 100}%`,
            '--map-y': `${player.progress * 100}%`,
          }}
        >
          <span></span>
          <em>You are here</em>
        </div>
      </div>

      <ul className="town-map-legend" aria-label="Map legend">
        <li><span className="legend-player"></span> Player</li>
        <li><span className="legend-area"></span> Future area</li>
        <li><span className="legend-part"></span> Bike part</li>
        <li><span className="legend-collected">✓</span> Collected</li>
      </ul>
    </aside>
  )
}

function getPartMapIcon(label) {
  if (label.includes('wheel')) {
    return '○'
  }

  if (label.includes('handlebar')) {
    return '⌁'
  }

  if (label.includes('frame')) {
    return '△'
  }

  if (label.includes('saddle')) {
    return '▰'
  }

  return '•'
}

function toTitleCase(label) {
  return label
    .split(' ')
    .map((word) => `${word.charAt(0).toUpperCase()}${word.slice(1)}`)
    .join(' ')
}
