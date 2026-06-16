// Progress panel: shows collected bike parts and remaining checklist items.
export function CollectionPanel({ parts }) {
  const collectedCount = parts.filter((part) => part.collected).length
  const totalCount = parts.length
  const remainingCount = totalCount - collectedCount

  return (
    <aside className="collection-panel" aria-label="Bike parts collection progress">
      <strong>Bike parts</strong>
      <span>Collected: {collectedCount} / {totalCount}</span>
      <span>Remaining: {remainingCount}</span>
      <ul>
        {parts.map((part) => (
          <li key={part.id} data-collected={part.collected ? 'true' : 'false'}>
            <span>{part.collected ? '✓' : '○'}</span>
            {toTitleCase(part.label)}
          </li>
        ))}
      </ul>
    </aside>
  )
}

function toTitleCase(label) {
  return label
    .split(' ')
    .map((word) => `${word.charAt(0).toUpperCase()}${word.slice(1)}`)
    .join(' ')
}
