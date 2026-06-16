// Shared Three.js tuning constants for street layout, movement, pose, pickup, and map projection.
export const INK = 0x24312f
export const ROAD_WIDTH = 9.4
export const SIDEWALK_WIDTH = 3
export const BIKE_LANE_WIDTH = 1.05
export const STREET_LENGTH = 170
export const STREET_CENTER_Z = -64
export const STREET_REPEAT = 118
export const LEFT_STREET_ENTRANCE_Z = -22
export const LEFT_STREET_HEADING = -Math.PI / 2
export const MAIN_STREET_HEADING = 0
export const RETURN_FROM_LEFT_HEADING = Math.PI / 2
export const SIDEWALK_X = ROAD_WIDTH / 2 + SIDEWALK_WIDTH / 2
export const BUILDING_X = ROAD_WIDTH / 2 + SIDEWALK_WIDTH + 1.35
export const PROP_X = ROAD_WIDTH / 2 + 0.85
export const POSE_MODE = 'screen-mirror'
export const POSE_MIRROR_X = -1
export const POSE_MIRROR_Y = 1
export const POSE_DEPTH_SCALE = -0.38
export const AVATAR_BASE_YAW = Math.PI
export const AVATAR_YAW_INFLUENCE = 0.04
export const MEDIAPIPE_MOVE_SPEED_MULTIPLIER = 0.55
export const MEDIAPIPE_MOVEMENT_SMOOTHING = 0.08
export const KEYBOARD_SPEED_MULTIPLIER = 1.5
export const KEYBOARD_FORWARD_SPEED = 0.09
export const KEYBOARD_SIDE_SPEED = 0.085
export const KEYBOARD_MOVEMENT_SMOOTHING = 0.5
export const PICKUP_ANIMATION_DURATION = 1.2
export const POSE_DEBUG_MODE = false
export const SCREEN_LEFT_LOCAL_X = 0.24
export const SCREEN_RIGHT_LOCAL_X = -0.24
export const MAP_MAIN_STREET = {
  centerX: 0.66,
  halfWidth: 0.09,
}
export const MAP_LEFT_STREET = {
  centerY: 0.48,
  endX: 0.66,
  halfWidth: 0.08,
  startX: 0.25,
}
