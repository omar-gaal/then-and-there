// Manual paper-map marker positions for the current bike parts.
export const PART_MAP_POSITIONS = {
  frontWheel: { mapSide: 'left', progress: 0.18, sidePosition: 0.58, labelOffsetX: -72, labelOffsetY: -16 },
  rearWheel: { mapSide: 'left', progress: 0.34, sidePosition: 0.75, labelOffsetX: -42, labelOffsetY: -24 },
  handlebar: { mapSide: 'right', progress: 0.54, sidePosition: 0.24, labelOffsetX: 16, labelOffsetY: -2 },
  frame: { mapSide: 'left', progress: 0.58, sidePosition: 0.75, labelOffsetX: -44, labelOffsetY: 20 },
  saddle: { mapSide: 'right', progress: 0.78, sidePosition: 0.60, labelOffsetX: 16, labelOffsetY: -26 },
}

export function getPartMapPosition(partId) {
  return PART_MAP_POSITIONS[partId] ?? {
    labelOffsetX: 12,
    labelOffsetY: 0,
    mapSide: 'right',
    progress: 0.5,
    sidePosition: 0.66,
  }
}
