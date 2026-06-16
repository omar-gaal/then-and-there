// Static town area data used by the map overlay and debug labels.
export const TOWN_AREAS = [
  {
    id: 'mainStreet',
    label: 'Main Street',
    description: 'The cozy Copenhagen street you are exploring now.',
    mapPosition: { x: 0.66, y: 0.66 },
    connectedAreas: ['leftStreet'],
  },
  {
    id: 'leftStreet',
    label: 'Left Street',
    description: 'A cozy side street with quiet shops and bike racks.',
    mapPosition: { x: 0.31, y: 0.48 },
    connectedAreas: ['mainStreet'],
  },
]

export function getTownAreaLabel(areaId) {
  return TOWN_AREAS.find((area) => area.id === areaId)?.label ?? 'Main Street'
}
