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
        <svg className="town-map-routes" viewBox="0 0 100 100" focusable="false">
          <path className="town-map-road-edge town-map-road-edge-a" d="M58 8 C57 25 58 39 57 52 C56 68 57 80 58 92" />
          <path className="town-map-road-edge town-map-road-edge-b" d="M75 8 C74 24 75 38 74 51 C73 67 74 80 75 92" />
          <path className="town-map-road-center" d="M66 9 C66.8 24 65.6 37 66.3 49 C67 64 65.7 78 66.4 91" />
          <path className="town-map-road-edge town-map-road-edge-a" d="M24 43 C36 42 48 43 58 45" />
          <path className="town-map-road-edge town-map-road-edge-b" d="M24 54 C37 54 49 53 58 52" />
          <path className="town-map-road-center" d="M25 48 C37 48.8 49 48 66 49" />
        </svg>
        <div className="town-map-street-label town-map-main-label">Main Street</div>
        <div className="town-map-street-label town-map-left-label">Left Street</div>
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
