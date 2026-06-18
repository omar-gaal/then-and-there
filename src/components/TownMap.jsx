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
        <div className="town-map-decor town-map-house town-map-house-a"><span></span><i></i></div>
        <div className="town-map-decor town-map-house town-map-house-b"><span></span><i></i></div>
        <div className="town-map-decor town-map-house town-map-house-c"><span></span><i></i></div>
        <div className="town-map-decor town-map-tree town-map-tree-a"></div>
        <div className="town-map-decor town-map-tree town-map-tree-b"></div>
        <div className="town-map-decor town-map-bike">⌁</div>
        <div className="town-map-decor town-map-canal"></div>
        <svg className="town-map-routes" viewBox="0 0 100 100" focusable="false">
          <path className="town-map-sidewalk" d="M64 8 L64 92" />
          <path className="town-map-sidewalk" d="M16 72 L64 72" />
          <path className="town-map-road-surface" d="M64 8 L64 92" />
          <path className="town-map-road-surface" d="M16 72 L64 72" />
          <path className="town-map-road-border town-map-road-main-left" d="M51 8 L51 92" />
          <path className="town-map-road-border town-map-road-main-right" d="M77 8 L77 92" />
          <path className="town-map-road-border town-map-road-left-top" d="M16 59 L64 59" />
          <path className="town-map-road-border town-map-road-left-bottom" d="M16 85 L64 85" />
          <path className="town-map-road-center" d="M64 10 L64 90" />
          <path className="town-map-road-center" d="M18 72 L62 72" />
        </svg>
        <div className="town-map-street-label town-map-main-label">Main Street</div>
        <div className="town-map-street-label town-map-left-label">Left Street</div>
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
              '--map-x': `${(part.x ?? part.sidePosition) * 100}%`,
              '--map-y': `${(part.y ?? part.progress) * 100}%`,
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
            '--map-x': `${(player.x ?? player.sidePosition) * 100}%`,
            '--map-y': `${(player.y ?? player.progress) * 100}%`,
            '--player-arrow-rotation': `${player.playerArrowRotation ?? 0}rad`,
          }}
        >
          <span><i></i></span>
          <em>You are here</em>
        </div>
      </div>

      <ul className="town-map-legend" aria-label="Map legend">
        <li><span className="legend-player"></span> Player</li>
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
