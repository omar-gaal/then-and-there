import {
  LEFT_STREET_ENTRANCE_Z,
  MAIN_STREET_HEADING,
} from '../scene/constants'

const MAP_LAYOUT = {
  leftStreetEndX: 0.64,
  leftStreetLength: 24,
  leftStreetStartX: 0.18,
  mainStreetBottomY: 0.88,
  mainStreetCenterX: 0.64,
  mainStreetHalfWidth: 0.12,
  mainStreetTopWorldZ: -110,
  streetLateralScale: 36,
}

const LEFT_STREET_ORIGIN_X = -5.2

export function worldToMapPosition(worldX = 0, worldZ = 0, areaId = 'mainStreet') {
  const safeWorldX = Number.isFinite(worldX) ? worldX : 0
  const safeWorldZ = Number.isFinite(worldZ) ? worldZ : 0
  const safeAreaId = areaId === 'leftStreet' ? 'leftStreet' : 'mainStreet'

  if (safeAreaId === 'leftStreet') {
    const localForward = Math.max(0, LEFT_STREET_ORIGIN_X - safeWorldX)
    const localLateral = safeWorldZ - LEFT_STREET_ENTRANCE_Z
    const branchProgress = clamp(localForward / MAP_LAYOUT.leftStreetLength, 0, 1)
    const x = clamp(
      MAP_LAYOUT.leftStreetEndX -
        branchProgress * (MAP_LAYOUT.leftStreetEndX - MAP_LAYOUT.leftStreetStartX),
      MAP_LAYOUT.leftStreetStartX,
      MAP_LAYOUT.leftStreetEndX,
    )
    const y = clamp(getMainStreetY(LEFT_STREET_ENTRANCE_Z) - localLateral / MAP_LAYOUT.streetLateralScale, 0.08, 0.92)

    return {
      areaId: safeAreaId,
      localForward,
      localLateral,
      mapX: x,
      mapY: y,
      side: 'leftStreet',
      x,
      y,
    }
  }

  const localForward = Math.max(0, -safeWorldZ)
  const localLateral = safeWorldX
  const x = getMainStreetX(localLateral)
  const y = getMainStreetY(safeWorldZ)

  return {
    areaId: safeAreaId,
    localForward,
    localLateral,
    mapX: x,
    mapY: y,
    side: getStreetSideLabel(localLateral),
    x,
    y,
  }
}

export function playerToMapMarker({ currentHeading = MAIN_STREET_HEADING, worldX = 0, worldZ = 0, areaId = 'mainStreet' }) {
  const point = worldToMapPosition(worldX, worldZ, areaId)

  return {
    ...point,
    playerArrowRotation: getPlayerArrowRotation(currentHeading),
    progress: point.mapY,
    sidePosition: point.mapX,
  }
}

export function partToMapMarker(part) {
  const point = worldToMapPosition(part.x, part.z, part.areaId ?? 'mainStreet')
  const labelOffset = getLabelOffset(point, part.id)

  return {
    areaId: point.areaId,
    labelOffsetX: labelOffset.x,
    labelOffsetY: labelOffset.y,
    localForward: point.localForward,
    localLateral: point.localLateral,
    mapX: point.mapX,
    mapY: point.mapY,
    mapSide: point.side,
    progress: point.mapY,
    sidePosition: point.mapX,
    worldX: part.x,
    worldZ: part.z,
    x: point.mapX,
    y: point.mapY,
  }
}

function getMainStreetX(localLateral) {
  return clamp(
    MAP_LAYOUT.mainStreetCenterX + localLateral / MAP_LAYOUT.streetLateralScale,
    MAP_LAYOUT.mainStreetCenterX - MAP_LAYOUT.mainStreetHalfWidth,
    MAP_LAYOUT.mainStreetCenterX + MAP_LAYOUT.mainStreetHalfWidth,
  )
}

function getMainStreetY(worldZ) {
  const worldProgress = clamp(-worldZ / Math.abs(MAP_LAYOUT.mainStreetTopWorldZ), 0, 1)

  return clamp(MAP_LAYOUT.mainStreetBottomY - worldProgress * 0.76, 0.08, 0.92)
}

function getStreetSideLabel(localLateral) {
  if (localLateral < -0.65) {
    return 'left'
  }

  if (localLateral > 0.65) {
    return 'right'
  }

  return 'center'
}

function getLabelOffset(point, partId) {
  if (partId === 'frontWheel') {
    return { x: -112, y: -24 }
  }

  if (partId === 'rearWheel') {
    return { x: 44, y: 2 }
  }

  if (partId === 'handlebar') {
    return { x: -98, y: 30 }
  }

  if (partId === 'frame') {
    return { x: 44, y: -10 }
  }

  if (partId === 'saddle') {
    return { x: -88, y: -28 }
  }

  if (point.side === 'leftStreet' || point.side === 'left') {
    return { x: -74, y: -14 }
  }

  if (point.side === 'right') {
    return { x: 18, y: -14 }
  }

  return { x: 16, y: -14 }
}

function getPlayerArrowRotation(currentHeading) {
  return normalizeAngle(currentHeading - MAIN_STREET_HEADING)
}

function normalizeAngle(angle) {
  return Math.atan2(Math.sin(angle), Math.cos(angle))
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value))
}
