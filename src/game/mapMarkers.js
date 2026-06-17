// Manual paper-map marker positions for the current bike parts.
export const PART_MAP_POSITIONS = {
  frontWheel: { mapSide: 'left', progress: 0.24, sidePosition: 0.56, labelOffsetX: -72, labelOffsetY: -18 },
  rearWheel: { mapSide: 'right', progress: 0.33, sidePosition: 0.76, labelOffsetX: 18, labelOffsetY: -16 },
  handlebar: { mapSide: 'leftStreet', progress: 0.44, sidePosition: 0.36, labelOffsetX: -76, labelOffsetY: -16 },
  frame: { mapSide: 'right', progress: 0.62, sidePosition: 0.76, labelOffsetX: 18, labelOffsetY: 16 },
  saddle: { mapSide: 'left', progress: 0.78, sidePosition: 0.58, labelOffsetX: -70, labelOffsetY: 18 },
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
