// Main Three.js scene controller: owns street rendering, avatar updates, movement, pickup, and map data.
import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { BIKE_PARTS } from '../game/bikeParts'
import { getPartMapPosition } from '../game/mapMarkers'
import {
  AVATAR_BASE_YAW,
  AVATAR_YAW_INFLUENCE,
  INK,
  KEYBOARD_FORWARD_SPEED,
  KEYBOARD_MOVEMENT_SMOOTHING,
  KEYBOARD_SIDE_SPEED,
  KEYBOARD_SPEED_MULTIPLIER,
  LEFT_STREET_ENTRANCE_Z,
  LEFT_STREET_HEADING,
  MAIN_STREET_HEADING,
  MAP_LEFT_STREET,
  MAP_MAIN_STREET,
  MEDIAPIPE_MOVEMENT_SMOOTHING,
  MEDIAPIPE_MOVE_SPEED_MULTIPLIER,
  PICKUP_ANIMATION_DURATION,
  POSE_DEBUG_MODE,
  POSE_DEPTH_SCALE,
  POSE_MIRROR_X,
  POSE_MIRROR_Y,
  POSE_MODE,
  RETURN_FROM_LEFT_HEADING,
  SCREEN_LEFT_LOCAL_X,
  SCREEN_RIGHT_LOCAL_X,
  STREET_CENTER_Z,
  STREET_LENGTH,
  STREET_REPEAT,
} from '../scene/constants'

const ARM_TURN_SWIPE_THRESHOLD = 0.12
const ARM_TURN_MAX_WINDOW_SECONDS = 0.7
const ARM_TURN_MIN_SAMPLE_SECONDS = 0.05
const ARM_TURN_COOLDOWN_SECONDS = 0.8
const ARM_TURN_SETTLE_THRESHOLD = 0.05
const ARM_TURN_SETTLE_SECONDS = 0.2
const PERFORMANCE_MODE = true
const PERFORMANCE_STREET_DETAIL_Z = -68
const VISUAL_ROAD_WIDTH = 5.6
const VISUAL_SIDEWALK_WIDTH = 1.55
const VISUAL_CURB_X = VISUAL_ROAD_WIDTH / 2 + 0.08
const VISUAL_SIDEWALK_X = VISUAL_ROAD_WIDTH / 2 + VISUAL_SIDEWALK_WIDTH / 2
const VISUAL_BUILDING_FACE_X = VISUAL_ROAD_WIDTH / 2 + VISUAL_SIDEWALK_WIDTH + 0.22
const VISUAL_PROP_X = VISUAL_ROAD_WIDTH / 2 + 0.72
const HOUSE_BLOCKS = [
  { floors: 4, length: 2.35, shopKind: 'cafe', width: 1.35 },
  { floors: 5, length: 1.7, width: 1.05 },
  { floors: 3, length: 2.85, width: 1.55 },
  { floors: 6, length: 1.95, width: 1.18 },
  { floors: 4, length: 2.25, width: 1.32 },
  { floors: 5, length: 1.55, width: 0.98 },
  { floors: 4, length: 3.05, shopKind: 'flowers', width: 1.7 },
  { floors: 6, length: 2.05, width: 1.2 },
  { floors: 3, length: 2.55, width: 1.42 },
  { floors: 5, length: 1.85, width: 1.08 },
]
export function ThreeStreetScene({ onMapData, onPickupDebug, onWorldDebug, tracking }) {
  const mountRef = useRef(null)
  const trackingRef = useRef(tracking)
  const onMapDataRef = useRef(onMapData)
  const onPickupDebugRef = useRef(onPickupDebug)
  const onWorldDebugRef = useRef(onWorldDebug)

  useEffect(() => {
    trackingRef.current = tracking
  }, [tracking])

  useEffect(() => {
    onMapDataRef.current = onMapData
  }, [onMapData])

  useEffect(() => {
    onPickupDebugRef.current = onPickupDebug
  }, [onPickupDebug])

  useEffect(() => {
    onWorldDebugRef.current = onWorldDebug
  }, [onWorldDebug])

  useEffect(() => {
    const mount = mountRef.current

    if (!mount) {
      return undefined
    }

    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0xf3d8c8)
    scene.fog = new THREE.Fog(0xf3d8c8, 34, 108)

    const camera = new THREE.PerspectiveCamera(54, 16 / 9, 0.1, 160)
    camera.position.set(0, 1.55, 8.8)
    camera.lookAt(0, 1.18, -22)

    const renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.outputColorSpace = THREE.SRGBColorSpace
    renderer.shadowMap.enabled = !PERFORMANCE_MODE
    renderer.shadowMap.type = THREE.PCFSoftShadowMap
    mount.appendChild(renderer.domElement)

    const ambient = new THREE.HemisphereLight(0xfff7ea, 0xd8c4ac, 2.9)
    scene.add(ambient)

    const sun = new THREE.DirectionalLight(0xffe2bd, 1.85)
    sun.position.set(-9, 10, 6)
    sun.castShadow = !PERFORMANCE_MODE
    sun.shadow.mapSize.set(1536, 1536)
    sun.shadow.camera.left = -22
    sun.shadow.camera.right = 22
    sun.shadow.camera.top = 18
    sun.shadow.camera.bottom = -28
    scene.add(sun)

    const world = new THREE.Group()
    const mainStreet = new THREE.Group()
    const leftStreet = new THREE.Group()
    const streetA = new THREE.Group()
    const streetB = new THREE.Group()
    const leftStreetA = new THREE.Group()
    const leftStreetB = new THREE.Group()

    buildStreet(streetA)
    buildStreet(streetB)
    addLeftStreetEntrance(streetA)
    addLeftStreetEntrance(streetB)
    streetB.position.z = -STREET_REPEAT
    mainStreet.add(streetA, streetB)
    buildLeftStreet(leftStreetA)
    buildLeftStreet(leftStreetB)
    leftStreetB.position.z = -STREET_REPEAT
      leftStreet.add(leftStreetA, leftStreetB)
    leftStreet.position.set(-5.4, 0, LEFT_STREET_ENTRANCE_Z)
    leftStreet.rotation.y = Math.PI * 0.5
    world.add(mainStreet, leftStreet)
    const bikeParts = createBikeParts()
    world.add(bikeParts.group)
    scene.add(world)
    const avatar = createPoseAvatar()
    const avatarMotion = {
      facingAngle: AVATAR_BASE_YAW,
      currentAreaId: 'mainStreet',
      currentHeading: MAIN_STREET_HEADING,
      lastDebugAt: 0,
      lastTransitionAt: -Infinity,
      lastMapAt: 0,
      lateralOffset: 0,
      armTurnCooldownUntil: 0,
      armTurnCooldownMs: 0,
      armTurnArmed: true,
      armTurnBlockedReason: 'ready',
      armTurnReleased: true,
      armTurnSettledSince: 0,
      armTurnTriggerAccepted: false,
      armTurnTriggerAttempted: false,
      armTurnTriggered: '',
      armTurnTriggeredUntil: 0,
      leftArmOut: false,
      leftWristDeltaX: 0,
      leftWristHistory: [],
      rawLeftWristX: 0.5,
      playerWorldX: 0,
      playerWorldZ: 0,
      rightArmOut: false,
      rightWristDeltaX: 0,
      rightWristHistory: [],
      rawRightWristX: 0.5,
      swipeLeftDetected: false,
      swipeRightDetected: false,
      targetHeading: MAIN_STREET_HEADING,
      transitionLabel: '',
      transitionLabelUntil: 0,
      turnHint: '',
      keyboardActive: false,
      keyboardForward: 0,
      keyboardMovementValue: 0,
      keyboardSide: 0,
      keyboardVx: 0,
      keyboardVz: 0,
      poseVx: 0,
      poseVz: 0,
      smoothedSpeed: 0,
      scrolling: false,
      walkPhase: 0,
      worldTravel: 0,
      vx: 0,
      vz: 0,
      x: 0,
      z: 3.15,
    }
    const pickupState = {
      feedback: '',
      feedbackUntil: 0,
      gestureState: 'waiting',
      lastDebugAt: 0,
      nearbyPartId: null,
    }
    scene.add(avatar)
    const animated = addAmbientDetails(scene)
    const sceneStats = countSceneObjects(scene)
    const perfState = {
      avgAmbientMs: 0,
      avgAvatarMs: 0,
      avgFrameMs: 0,
      avgHeadingMs: 0,
      avgMapDebugMs: 0,
      avgPickupMs: 0,
      avgRenderMs: 0,
      avgWorldMs: 0,
      drawCalls: 0,
      fps: 0,
      lastFrameAt: performance.now(),
      lastFpsAt: performance.now(),
      meshCount: sceneStats.meshCount,
      totalObjects: sceneStats.totalObjects,
      visibleObjects: sceneStats.visibleObjects,
      framesSinceFps: 0,
    }
    const keys = {
      bend: false,
      forward: false,
      left: false,
      right: false,
      returnMain: false,
      turnLeft: false,
      turnRight: false,
    }

    let frameId = 0
    const startedAt = performance.now()

    function resize() {
      const width = mount.clientWidth || 1280
      const height = mount.clientHeight || 720

      camera.aspect = width / height
      camera.updateProjectionMatrix()
      renderer.setSize(width, height, false)
    }

    function animate() {
      const frameStartedAt = performance.now()
      const frameDelta = frameStartedAt - perfState.lastFrameAt

      perfState.lastFrameAt = frameStartedAt
      perfState.avgFrameMs = smoothMetric(perfState.avgFrameMs, frameDelta)
      perfState.framesSinceFps += 1
      if (frameStartedAt - perfState.lastFpsAt >= 500) {
        perfState.fps = (perfState.framesSinceFps * 1000) / (frameStartedAt - perfState.lastFpsAt)
        perfState.framesSinceFps = 0
        perfState.lastFpsAt = frameStartedAt
      }

      const elapsed = (performance.now() - startedAt) / 1000

      const ambientStartedAt = performance.now()
      for (let index = 0; index < animated.clouds.length; index += 1) {
        const cloud = animated.clouds[index]

        cloud.position.x += 0.0018 + index * 0.0001
        if (cloud.position.x > 13) {
          cloud.position.x = -13
        }
      }

      for (let index = 0; index < animated.trees.length; index += 1) {
        const tree = animated.trees[index]
        const sway = Math.sin(elapsed * 0.85 + index) * 0.018

        tree.rotation.z = sway
      }
      perfState.avgAmbientMs = smoothMetric(perfState.avgAmbientMs, performance.now() - ambientStartedAt)

      const avatarStartedAt = performance.now()
      updateAvatar(avatar, avatarMotion, trackingRef.current, elapsed, keys)
      perfState.avgAvatarMs = smoothMetric(perfState.avgAvatarMs, performance.now() - avatarStartedAt)
      const headingStartedAt = performance.now()
      updateHeadingAndArea(avatarMotion, bikeParts, pickupState, keys, trackingRef.current, elapsed)
      perfState.avgHeadingMs = smoothMetric(perfState.avgHeadingMs, performance.now() - headingStartedAt)
      const worldStartedAt = performance.now()
      updateWorldScroll(world, avatarMotion)
      updateCameraFollow(camera, avatar, avatarMotion)
      perfState.avgWorldMs = smoothMetric(perfState.avgWorldMs, performance.now() - worldStartedAt)
      const pickupStartedAt = performance.now()
      updateBikeParts(bikeParts, avatarMotion, avatar, trackingRef.current, keys, pickupState, onPickupDebugRef.current, elapsed)
      updateBackpackGlow(avatar, elapsed)
      perfState.avgPickupMs = smoothMetric(perfState.avgPickupMs, performance.now() - pickupStartedAt)
      const mapDebugStartedAt = performance.now()
      publishMapData(avatarMotion, bikeParts.parts, onMapDataRef.current, elapsed)
      publishWorldDebug(avatarMotion, onWorldDebugRef.current, elapsed, scene, renderer, perfState, trackingRef.current)
      perfState.avgMapDebugMs = smoothMetric(perfState.avgMapDebugMs, performance.now() - mapDebugStartedAt)
      const renderStartedAt = performance.now()
      renderer.render(scene, camera)
      perfState.avgRenderMs = smoothMetric(perfState.avgRenderMs, performance.now() - renderStartedAt)
      perfState.drawCalls = renderer.info.render.calls
      frameId = requestAnimationFrame(animate)
    }

    function handleKeyDown(event) {
      if (setKeyState(event.code, keys, true)) {
        event.preventDefault()
      }
    }

    function handleKeyUp(event) {
      if (setKeyState(event.code, keys, false)) {
        event.preventDefault()
      }
    }

    resize()
    animate()
    window.addEventListener('resize', resize)
    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)

    return () => {
      cancelAnimationFrame(frameId)
      window.removeEventListener('resize', resize)
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
      mount.removeChild(renderer.domElement)
      renderer.dispose()
    }
  }, [])

  return <div ref={mountRef} className="three-street-scene" aria-hidden="true" />
}

function buildStreet(scene) {
  const road = new THREE.Mesh(
    new THREE.BoxGeometry(VISUAL_ROAD_WIDTH, 0.08, STREET_LENGTH),
    material(0xe8d8bf)
  )
  road.position.set(0, -0.04, STREET_CENTER_Z)
  road.receiveShadow = true
  addOutlined(scene, road, 0.012)
  addPavingPattern(scene, VISUAL_ROAD_WIDTH * 0.94, STREET_LENGTH, 0, STREET_CENTER_Z, 0.018)

  for (const side of [-1, 1]) {
    const bikeLane = new THREE.Mesh(
      new THREE.BoxGeometry(0.46, 0.025, STREET_LENGTH),
      material(0xd9c5ad)
    )
    const innerTrack = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.03, STREET_LENGTH), material(0xc8b08f))
    const outerTrack = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.032, STREET_LENGTH), material(0xf5e5c9))

    bikeLane.position.set(side * (VISUAL_ROAD_WIDTH / 2 - 0.42), 0.025, STREET_CENTER_Z)
    innerTrack.position.set(side * (VISUAL_ROAD_WIDTH / 2 - 0.92), 0.034, STREET_CENTER_Z)
    outerTrack.position.set(side * (VISUAL_ROAD_WIDTH / 2 - 0.12), 0.036, STREET_CENTER_Z)
    addOutlined(scene, bikeLane, 0.006)
    addOutlined(scene, innerTrack, 0.003)
    addOutlined(scene, outerTrack, 0.003)
  }

  const laneMaterial = material(0xf4ead8)
  for (let i = 0; i < 44; i += 1) {
    const line = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.025, 0.72), laneMaterial)

    line.position.set(0, 0.025, 7.5 - i * 3.4)
    addOutlined(scene, line, 0.006)
  }

  for (const side of [-1, 1]) {
    createSidewalk(scene, side)
    createBuildingRow(scene, side)
    createStreetProps(scene, side)
  }
  addMainStreetTrees(scene)

  const farCrosswalk = createCrosswalk()
  farCrosswalk.position.z = -38
  scene.add(farCrosswalk)

  const canal = createCanalHint()
  canal.position.set(-11.9, -0.02, -35)
  scene.add(canal)

  const dome = createDistantDome()
  dome.position.set(0, 0.05, -58)
  scene.add(dome)
}

function addLeftStreetEntrance(scene) {
  const entrance = new THREE.Group()
  const sideRoad = new THREE.Mesh(new THREE.BoxGeometry(4.4, 0.045, 8.4), material(0xe4d4bd))
  const leftCurb = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.12, 8.2), material(0xd9cdbb))
  const rightCurb = leftCurb.clone()
  const sign = createStreetSign('Left Street')
  const planter = createPlanter()
  const lamp = createLamp()
  const bike = createParkedBike(4)

  sideRoad.position.set(-6.95, 0.018, 0)
  sideRoad.rotation.y = Math.PI * 0.5
  addOutlined(entrance, sideRoad, 0.008)
  leftCurb.position.set(-6.95, 0.09, -2.3)
  leftCurb.rotation.y = Math.PI * 0.5
  rightCurb.position.set(-6.95, 0.09, 2.3)
  rightCurb.rotation.y = Math.PI * 0.5
  addOutlined(entrance, leftCurb, 0.006)
  addOutlined(entrance, rightCurb, 0.006)
  addTJunctionDetails(entrance)
  sign.position.set(-4.95, 0.34, -2.7)
  sign.rotation.y = -0.25
  planter.position.set(-5.55, 0.14, 3.45)
  lamp.position.set(-5.05, 0.05, 3.2)
  bike.position.set(-6.75, 0.12, -3.25)
  bike.rotation.y = Math.PI * 0.5
  entrance.add(sign, planter, lamp, bike)
  entrance.position.z = LEFT_STREET_ENTRANCE_Z
  scene.add(entrance)
}

function addTJunctionDetails(entrance) {
  const apron = new THREE.Mesh(new THREE.BoxGeometry(6.3, 0.028, 6.2), material(0xe4d4bd))
  const transition = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.03, 4.9), material(0xead9bf))
  const northCorner = new THREE.Mesh(new THREE.BoxGeometry(1.25, 0.08, 1.05), material(0xf3eee4))
  const southCorner = northCorner.clone()
  const bikeTurnA = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.032, 2.45), material(0xd9c5ad))
  const bikeTurnB = new THREE.Mesh(new THREE.BoxGeometry(1.85, 0.032, 0.22), material(0xd9c5ad))
  const planterA = createPlanter()
  const planterB = createPlanter()
  const lampA = createLamp()

  apron.position.set(-4.85, 0.04, 0)
  transition.position.set(-5.5, 0.062, 0)
  transition.rotation.y = Math.PI * 0.5
  addOutlined(entrance, apron, 0.006)
  addOutlined(entrance, transition, 0.004)
  northCorner.position.set(-4.55, 0.09, -3.35)
  southCorner.position.set(-4.55, 0.09, 3.35)
  addOutlined(entrance, northCorner, 0.006)
  addOutlined(entrance, southCorner, 0.006)

  for (let i = -1; i <= 1; i += 1) {
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.032, 2.65), material(0xf7f5ed))

    stripe.position.set(-2.28 + i * 0.7, 0.07, -3.05)
    stripe.rotation.y = Math.PI * 0.5
    addOutlined(entrance, stripe, 0.003)
  }

  for (let i = -1; i <= 1; i += 1) {
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.032, 2.2), material(0xf7f5ed))

    stripe.position.set(-5.85, 0.07, i * 0.52)
    addOutlined(entrance, stripe, 0.003)
  }

  bikeTurnA.position.set(-4.35, 0.076, 1.1)
  bikeTurnB.position.set(-5.05, 0.078, 2.1)
  addOutlined(entrance, bikeTurnA, 0.004)
  addOutlined(entrance, bikeTurnB, 0.004)
  planterA.position.set(-4.35, 0.16, -3.85)
  planterB.position.set(-4.35, 0.16, 3.85)
  lampA.position.set(-3.95, 0.05, -3.55)
  entrance.add(planterA, planterB, lampA)
}

function buildLeftStreet(scene) {
  const sideRoadWidth = 5.6
  const sideStreetCenterZ = STREET_CENTER_Z
  const road = new THREE.Mesh(
    new THREE.BoxGeometry(sideRoadWidth, 0.08, STREET_LENGTH),
    material(0xe4d4bd)
  )

  road.position.set(0, -0.04, sideStreetCenterZ)
  road.receiveShadow = true
  addOutlined(scene, road, 0.012)
  addPavingPattern(scene, sideRoadWidth * 0.9, STREET_LENGTH, 0, sideStreetCenterZ, 0.018)

  for (const side of [-1, 1]) {
    const sidewalk = new THREE.Mesh(new THREE.BoxGeometry(2.15, 0.14, STREET_LENGTH), material(0xf3eee4))
    const curb = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.18, STREET_LENGTH), material(0xd8d0c2))

    sidewalk.position.set(side * 3.9, 0.02, sideStreetCenterZ)
    curb.position.set(side * (sideRoadWidth / 2 + 0.08), 0.08, sideStreetCenterZ)
    addOutlined(scene, sidewalk, 0.01)
    addOutlined(scene, curb, 0.008)

    const leftStreetBuildingCount = PERFORMANCE_MODE ? 9 : 26
    const leftStreetPropCount = PERFORMANCE_MODE ? 3 : 18
    const leftStreetLampCount = PERFORMANCE_MODE ? 3 : 12

    for (let i = 0; i < leftStreetBuildingCount; i += 1) {
      const buildingZ = 7.5 - i * 4.8

      if (buildingZ > -8) {
        continue
      }

      const building = createBuilding({
        depth: 1.2 + (i % 2) * 0.18,
        height: 3.8 + (i % 4) * 0.34,
        index: i + 2,
        side,
        width: 1.05 + (i % 3) * 0.14,
      })

      building.position.set(side * (5.1 + (i % 2) * 0.16), (3.8 + (i % 4) * 0.34) / 2, buildingZ)
      building.rotation.y = side * 0.025
      scene.add(building)
    }

    for (let i = 0; i < leftStreetPropCount; i += 1) {
      const propZ = 5.8 - i * 5.8

      if (propZ > -7) {
        continue
      }

      const planter = createPlanter()

      planter.position.set(side * 4.05, 0.14, propZ - 1.7)
      scene.add(planter)
    }

    for (let i = 0; i < leftStreetLampCount; i += 1) {
      const lampZ = 7.2 - i * 8.2

      if (lampZ > -7) {
        continue
      }

      const lamp = createLamp()

      lamp.position.set(side * 3.2, 0.05, lampZ)
      scene.add(lamp)
    }
  }

  const returnSign = createStreetSign('Main Street')
  const returnPlanter = createPlanter()

  returnSign.position.set(2.45, 0.34, -12)
  returnSign.rotation.y = 0.28
  returnPlanter.position.set(2.1, 0.14, -9.8)
  scene.add(returnSign, returnPlanter)
}

function createSidewalk(scene, side) {
  const sidewalk = new THREE.Mesh(
    new THREE.BoxGeometry(VISUAL_SIDEWALK_WIDTH, 0.14, STREET_LENGTH),
    material(0xf0e5d2)
  )
  sidewalk.position.set(side * VISUAL_SIDEWALK_X, 0.02, STREET_CENTER_Z)
  sidewalk.receiveShadow = true
  addOutlined(scene, sidewalk, 0.01)

  const curb = new THREE.Mesh(
    new THREE.BoxGeometry(0.18, 0.18, STREET_LENGTH),
    material(0xd5c7b4)
  )
  curb.position.set(side * VISUAL_CURB_X, 0.08, STREET_CENTER_Z)
  addOutlined(scene, curb, 0.008)

  const sidewalkSeamCount = PERFORMANCE_MODE ? 12 : 32
  const sidewalkStoneRows = PERFORMANCE_MODE ? 1 : 2
  const sidewalkStoneCount = PERFORMANCE_MODE ? 8 : 24

  for (let i = 0; i < sidewalkSeamCount; i += 1) {
    const seam = new THREE.Mesh(new THREE.BoxGeometry(VISUAL_SIDEWALK_WIDTH * 0.92, 0.012, 0.035), material(0xd7cab8))

    seam.position.set(side * VISUAL_SIDEWALK_X, 0.105, 8 - i * (PERFORMANCE_MODE ? 12.4 : 4.8))
    scene.add(seam)
  }

  for (let row = 0; row < sidewalkStoneRows; row += 1) {
    for (let i = 0; i < sidewalkStoneCount; i += 1) {
      const stone = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.014, 0.035), material(0xe7dcc9))

      stone.position.set(side * (VISUAL_SIDEWALK_X - 0.42 + row * 0.52), 0.112, 6.2 - i * (PERFORMANCE_MODE ? 17 : 6.4) - row * 0.8)
      scene.add(stone)
    }
  }
}

function createBuildingRow(scene, side) {
  let zCursor = 8.45
  let i = 0

  const farLimit = PERFORMANCE_MODE ? PERFORMANCE_STREET_DETAIL_Z : -STREET_LENGTH + 12

  while (zCursor > farLimit) {
    const block = HOUSE_BLOCKS[i % HOUSE_BLOCKS.length]
    const depth = block.length + ((i + side + 20) % 3) * 0.08
    const width = block.width + ((i + 1) % 3) * 0.04
    const height = 2.75 + block.floors * 0.58 + (i % 5 === 0 ? 0.28 : 0)
    const shopKind = side < 0 && i % HOUSE_BLOCKS.length === 0
      ? 'cafe'
      : side > 0 && i % HOUSE_BLOCKS.length === 6
        ? 'flowers'
        : ''
    const buildingZ = zCursor - depth / 2

    if (isLeftStreetOpening(side, buildingZ, depth)) {
      zCursor -= depth + 0.035
      i += 1
      continue
    }

    const building = createBuilding({ depth, height, index: i, shopKind, side, width })

    building.position.set(side * (VISUAL_BUILDING_FACE_X + width / 2), height / 2, buildingZ)
    building.rotation.y = side * (0.008 + (i % 3) * 0.004)
    scene.add(building)
    zCursor -= depth + 0.035
    i += 1
  }
}

function isLeftStreetOpening(side, buildingZ, depth) {
  return side < 0 && Math.abs(buildingZ - LEFT_STREET_ENTRANCE_Z) < 4.6 + depth / 2
}

function createStreetProps(scene, side) {
  const lampCount = PERFORMANCE_MODE ? 5 : 18
  const benchCount = PERFORMANCE_MODE ? 0 : 5
  const planterCount = PERFORMANCE_MODE ? 3 : 12
  const rackCount = PERFORMANCE_MODE ? 0 : 8
  const cafeSetCount = PERFORMANCE_MODE ? 0 : 4

  for (let i = 0; i < lampCount; i += 1) {
    const lamp = createLamp()

    lamp.position.set(side * (VISUAL_PROP_X - 0.08), 0.05, 7.2 - i * 6.8)
    lamp.scale.setScalar(0.9)
    scene.add(lamp)
  }

  for (let i = 0; i < benchCount; i += 1) {
    const bench = createBench()

    bench.position.set(side * (VISUAL_PROP_X + 0.65), 0.2, -10.8 - i * 18.4)
    bench.rotation.y = side * Math.PI * 0.5
    scene.add(bench)
  }

  for (let i = 0; i < planterCount; i += 1) {
    const planter = createPlanter()

    planter.position.set(side * (VISUAL_PROP_X + 0.55 + (i % 2) * 0.12), 0.14, 6.6 - i * 8.2)
    scene.add(planter)
  }

  addLandmarkBikes(scene, side)

  for (let i = 0; i < rackCount; i += 1) {
    const rack = createBikeRack()

    rack.position.set(side * (VISUAL_PROP_X + 0.48), 0.06, 3.2 - i * 12.6)
    rack.rotation.y = side * Math.PI * 0.5
    scene.add(rack)
  }

  for (let i = 0; i < cafeSetCount; i += 1) {
    const cafe = createCafeSet(i)

    cafe.position.set(side * (VISUAL_PROP_X + 0.7), 0.08, -16.2 - i * 20.5)
    cafe.rotation.y = side * Math.PI * 0.5
    scene.add(cafe)
  }

  if (side < 0) {
    const cafe = createCafeStreetMoment()

    cafe.position.set(side * (VISUAL_PROP_X + 0.5), 0.05, 3.9)
    cafe.rotation.y = side * Math.PI * 0.5
    scene.add(cafe)
  } else {
    const flowers = createFlowerShopStreetMoment()

    flowers.position.set(side * (VISUAL_PROP_X + 0.54), 0.05, -0.2)
    flowers.rotation.y = side * Math.PI * 0.5
    scene.add(flowers)
  }

  if (side > 0) {
    const postbox = createPostbox()

    postbox.position.set(side * (VISUAL_PROP_X + 0.34), 0.05, -4.9)
    scene.add(postbox)
  }
}

function addMainStreetTrees(scene) {
  const treePositions = [
    { side: -1, z: 2.4, scale: 0.78 },
    { side: 1, z: -1.8, scale: 0.78 },
    { side: -1, z: -34, scale: 0.72 },
  ]

  for (const { side, z, scale } of treePositions) {
    const tree = createTree()

    tree.position.set(side * (VISUAL_PROP_X + 0.42), 0.12, z)
    tree.scale.setScalar(scale)
    scene.add(tree)
  }
}

function addLandmarkBikes(scene, side) {
  const bikePositions = side < 0
    ? [
        { index: 0, z: 3.2, xOffset: 0.44 },
        { index: 8, z: -46, xOffset: 0.5 },
      ]
    : [
        { index: 1, z: -1.2, xOffset: 0.42 },
      ]

  for (const bikePosition of bikePositions) {
    const bike = createParkedBike(bikePosition.index)

    bike.position.set(side * (VISUAL_PROP_X + bikePosition.xOffset), 0.12, bikePosition.z)
    bike.rotation.y = side * Math.PI * 0.5
    scene.add(bike)
  }
}

function createBuilding({ depth, height, index, shopKind = '', side, width }) {
  const group = new THREE.Group()
  const isNearBuilding = !PERFORMANCE_MODE || index < 8 || Boolean(shopKind)
  const colors = [0x8ba7ca, 0xeac77c, 0x86a889, 0xc86f58, 0xf1e5ce, 0xe0a982, 0xa7b6c8, 0xd7a2bb]
  const brickColors = [0xb96958, 0xc98267, 0xa65f53]
  const bodyColor = shopKind === 'cafe'
    ? 0x8ba7ca
    : shopKind === 'flowers'
      ? 0xeac77c
      : index % 5 === 2
        ? brickColors[index % brickColors.length]
        : colors[index % colors.length]
  const body = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), material(bodyColor))

  body.castShadow = !PERFORMANCE_MODE || index < 8
  body.receiveShadow = true
  addOutlined(group, body, 0.015)

  if (isNearBuilding && index % 5 === 2) {
    addBrickLines(group, width, height, depth)
  }
  if (isNearBuilding) {
    addFacadeTexture(group, width, height, depth, bodyColor, index)
  }

  const roofColor = shopKind === 'cafe' ? 0x594238 : index % 3 === 0 ? 0x334047 : index % 3 === 1 ? 0x67423a : 0x596665
  const roof = createGableRoof(width * 1.18, depth * 1.08, 0.72 + (index % 4) * 0.08, roofColor)

  roof.position.y = height / 2 + 0.02
  roof.castShadow = !PERFORMANCE_MODE || index < 8
  group.add(roof)

  const windowRows = PERFORMANCE_MODE
    ? Math.max(2, Math.floor(height / 1.25))
    : Math.max(4, Math.floor(height / 0.72))
  const windowStep = PERFORMANCE_MODE ? 2 : 1
  for (let row = 0; row < windowRows; row += windowStep) {
    for (let col = -1; col <= 1; col += 2) {
      const recess = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.56, 0.032), material(row % 3 === 0 ? 0xd8c8b8 : 0xe7d7c4))
      const windowPane = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.45, 0.035), material(row % 4 === 0 ? 0x4b5658 : 0xf8f3e8))
      const mullionV = PERFORMANCE_MODE ? null : new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.45, 0.05), material(0xffffff))
      const mullionH = PERFORMANCE_MODE ? null : new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.025, 0.052), material(0xffffff))

      recess.position.set((col * width) / 4, -height / 2 + 0.76 + row * 0.62, depth / 2 + 0.016)
      windowPane.position.set(recess.position.x, recess.position.y, depth / 2 + 0.04)
      mullionV?.position.copy(windowPane.position).setZ(depth / 2 + 0.064)
      mullionH?.position.copy(windowPane.position).setZ(depth / 2 + 0.066)
      addOutlined(group, recess, 0.004)
      addOutlined(group, windowPane, 0.004)
      if (!PERFORMANCE_MODE && row % 4 !== 0) {
        group.add(mullionV, mullionH)
      }

      const sill = new THREE.Mesh(new THREE.BoxGeometry(0.31, 0.035, 0.055), material(0xf8f0e2))

      sill.position.set(windowPane.position.x, windowPane.position.y - 0.29, depth / 2 + 0.04)
      addOutlined(group, sill, 0.004)
      if (!PERFORMANCE_MODE && (row + index) % 4 === 1) {
        const flowerBox = createFlowerBox()

        flowerBox.position.set(windowPane.position.x, windowPane.position.y - 0.34, depth / 2 + 0.075)
        group.add(flowerBox)
      }
    }
  }

  const shop = new THREE.Mesh(new THREE.BoxGeometry(width * 0.78, 0.52, 0.055), material(0xf9edd9))
  const awning = new THREE.Mesh(
    new THREE.BoxGeometry(width * 0.88, 0.09, 0.36),
    material(index % 2 === 0 ? 0xc96f63 : 0xe2c66f)
  )
  const door = new THREE.Mesh(new THREE.BoxGeometry(width * 0.22, 0.48, 0.075), material(0x68909a))
  const sign = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.18, 0.07), material(index % 3 === 0 ? 0x7aa39d : 0xe3bd6f))
  const shopMark = index % 2 === 0
    ? new THREE.Mesh(new THREE.TorusGeometry(0.075, 0.017, 8, 18), material(0x8d5a3d))
    : new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 0.12, 12), material(0xf1b86b))

  shop.position.set(0, -height / 2 + 0.39, depth / 2 + 0.035)
  awning.position.set(0, -height / 2 + 0.75, depth / 2 + 0.16)
  door.position.set(side * width * 0.23, -height / 2 + 0.3, depth / 2 + 0.075)
  sign.position.set(-side * width * 0.16, -height / 2 + 1.02, depth / 2 + 0.09)
  shopMark.position.set(sign.position.x, sign.position.y, depth / 2 + 0.135)
  shopMark.rotation.x = Math.PI * 0.5
  if (!PERFORMANCE_MODE || shopKind || index < 4) {
    addOutlined(group, shop, 0.006)
    addOutlined(group, awning, 0.008)
    addOutlined(group, door, 0.006)
    addOutlined(group, sign, 0.006)
    addOutlined(group, shopMark, 0.004)
  } else {
    group.add(shop, awning, door, sign)
  }

  if (shopKind) {
    const frontage = shopKind === 'cafe'
      ? createCafeBuildingFrontage(width, height, depth)
      : createFlowerBuildingFrontage(width, height, depth)

    group.add(frontage)
  }

  group.add(createStreetFacingFacade({ depth, height, index, shopKind, side, width }))

  if (!PERFORMANCE_MODE || shopKind) for (let i = -1; i <= 1; i += 2) {
    const box = createFlowerBox()

    box.position.set((i * width) / 4, -height / 2 + 1.35, depth / 2 + 0.07)
    group.add(box)
  }

  return group
}

function createPoseAvatar() {
  const group = new THREE.Group()
  const skin = material(0xffc59e)
  const coat = material(0x6f8faa)
  const accent = material(0xd8bd6d)
  const backpackMaterial = material(0xd79a6f)
  const dark = material(0x26302f)
  const screenLeftHand = material(0x8aaea8)
  const screenRightHand = material(0xd89aa7)

  group.userData.parts = {
    head: new THREE.Mesh(new THREE.SphereGeometry(0.18, 18, 12), skin),
    torso: createAvatarLimb(0.12, coat),
    backpack: new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.38, 0.11), backpackMaterial),
    leftUpperArm: createAvatarLimb(0.045, accent),
    leftLowerArm: createAvatarLimb(0.04, accent),
    rightUpperArm: createAvatarLimb(0.045, accent),
    rightLowerArm: createAvatarLimb(0.04, accent),
    leftHand: new THREE.Mesh(new THREE.SphereGeometry(0.06, 12, 8), screenLeftHand),
    rightHand: new THREE.Mesh(new THREE.SphereGeometry(0.06, 12, 8), screenRightHand),
    leftUpperLeg: createAvatarLimb(0.052, dark),
    leftLowerLeg: createAvatarLimb(0.046, dark),
    rightUpperLeg: createAvatarLimb(0.052, dark),
    rightLowerLeg: createAvatarLimb(0.046, dark),
    leftFoot: new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.055, 0.28), dark),
    rightFoot: new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.055, 0.28), dark),
  }

  for (const part of Object.values(group.userData.parts)) {
    addAvatarOutlined(group, part, 0.012)
  }

  group.userData.parts.backpack.userData.baseColor = new THREE.Color(0xd79a6f)
  group.userData.parts.backpack.userData.glowColor = new THREE.Color(0xffedb7)
  group.scale.setScalar(1.15)

  return group
}

function createBikeParts() {
  const group = new THREE.Group()
  const parts = BIKE_PARTS.map((definition) => {
    const mesh = createBikePart(definition.kind)
    const halo = createPartHalo()

    mesh.position.set(definition.x, 0.24, definition.z)
    halo.position.set(definition.x, 0.08, definition.z)
    halo.visible = false
    group.add(mesh, halo)

    return {
      ...definition,
      collected: false,
      halo,
      mesh,
    }
  })

  return { group, parts, pickupAnimations: [] }
}

function createBikePart(kind) {
  if (kind === 'wheel') {
    return createWheelPart()
  }

  if (kind === 'handlebar') {
    return createHandlebarPart()
  }

  if (kind === 'frame') {
    return createFramePart()
  }

  return createSaddlePart()
}

function createWheelPart() {
  const group = new THREE.Group()
  const tire = new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.035, 10, 28), material(0x26302f))
  const hub = new THREE.Mesh(new THREE.SphereGeometry(0.045, 10, 8), material(0xd8bd6d))

  tire.rotation.y = Math.PI * 0.5
  addOutlined(group, tire, 0.006)
  addOutlined(group, hub, 0.006)
  for (let i = 0; i < 6; i += 1) {
    const spoke = new THREE.Mesh(new THREE.BoxGeometry(0.015, 0.015, 0.62), material(0xf8f0e2))

    spoke.rotation.y = Math.PI * 0.5
    spoke.rotation.z = (Math.PI / 6) * i
    addOutlined(group, spoke, 0.003)
  }

  return group
}

function createHandlebarPart() {
  const group = new THREE.Group()
  const bar = new THREE.Mesh(new THREE.BoxGeometry(0.82, 0.055, 0.055), material(0x53605e))
  const stem = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.42, 0.055), material(0x53605e))
  const leftGrip = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.07, 0.07), material(0xd79a6f))
  const rightGrip = leftGrip.clone()

  stem.position.y = -0.22
  leftGrip.position.x = -0.5
  rightGrip.position.x = 0.5
  addOutlined(group, bar, 0.006)
  addOutlined(group, stem, 0.006)
  addOutlined(group, leftGrip, 0.005)
  addOutlined(group, rightGrip, 0.005)
  group.rotation.z = -0.08

  return group
}

function createFramePart() {
  const group = new THREE.Group()
  const frameMaterial = material(0x6f8faa)
  const points = [
    [new THREE.Vector3(-0.42, -0.22, 0), new THREE.Vector3(-0.05, 0.35, 0)],
    [new THREE.Vector3(-0.05, 0.35, 0), new THREE.Vector3(0.45, -0.22, 0)],
    [new THREE.Vector3(0.45, -0.22, 0), new THREE.Vector3(-0.42, -0.22, 0)],
    [new THREE.Vector3(-0.05, 0.35, 0), new THREE.Vector3(0.02, -0.22, 0)],
  ]

  for (const [start, end] of points) {
    const tube = createTubeBetween(start, end, 0.035, frameMaterial)

    addOutlined(group, tube, 0.006)
  }

  return group
}

function createSaddlePart() {
  const group = new THREE.Group()
  const seat = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.12, 0.24), material(0x5a3f35))
  const nose = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.09, 0.18), material(0x5a3f35))
  const post = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.34, 0.055), material(0x53605e))

  nose.position.x = 0.3
  post.position.y = -0.22
  addOutlined(group, seat, 0.006)
  addOutlined(group, nose, 0.006)
  addOutlined(group, post, 0.006)

  return group
}

function createPartHalo() {
  const halo = new THREE.Mesh(
    new THREE.TorusGeometry(0.55, 0.025, 8, 32),
    new THREE.MeshBasicMaterial({ color: 0xffedb7 })
  )

  halo.rotation.x = Math.PI * 0.5

  return halo
}

function createStreetSign(label) {
  const group = new THREE.Group()
  const post = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.82, 0.055), material(0x53605e))
  const board = new THREE.Mesh(new THREE.BoxGeometry(1.05, 0.34, 0.07), material(0xfff7eb))
  const text = createStreetSignText(label)

  post.position.y = 0.38
  board.position.y = 0.83
  text.position.set(0, 0.83, 0.041)
  addOutlined(group, post, 0.006)
  addOutlined(group, board, 0.006)
  group.add(text)

  return group
}

function createStreetSignText(label) {
  const canvas = document.createElement('canvas')
  const context = canvas.getContext('2d')

  canvas.width = 256
  canvas.height = 96
  if (!context) {
    return new THREE.Sprite(new THREE.SpriteMaterial({ color: 0x24312f }))
  }

  context.clearRect(0, 0, canvas.width, canvas.height)
  context.fillStyle = '#24312f'
  context.font = '800 30px system-ui, -apple-system, BlinkMacSystemFont, sans-serif'
  context.textAlign = 'center'
  context.textBaseline = 'middle'
  context.fillText(label, 128, 48)

  const texture = new THREE.CanvasTexture(canvas)
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
  }))

  sprite.scale.set(0.92, 0.34, 1)

  return sprite
}

function createPaintedText(label, color, width, height) {
  const canvas = document.createElement('canvas')
  const context = canvas.getContext('2d')

  canvas.width = 256
  canvas.height = 96
  if (!context) {
    return new THREE.Sprite(new THREE.SpriteMaterial({ color }))
  }

  context.clearRect(0, 0, canvas.width, canvas.height)
  context.fillStyle = `#${new THREE.Color(color).getHexString()}`
  context.font = '800 34px Georgia, Times New Roman, serif'
  context.textAlign = 'center'
  context.textBaseline = 'middle'
  context.fillText(label, 128, 48)

  const texture = new THREE.CanvasTexture(canvas)
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
  }))

  sprite.scale.set(width, height, 1)

  return sprite
}

function createStreetFacingFacade({ depth, height, index, shopKind, side, width }) {
  const group = new THREE.Group()
  const isNearBuilding = !PERFORMANCE_MODE || index < 8 || Boolean(shopKind)
  const faceX = -side * (width / 2 + 0.028)
  const signX = -side * (width / 2 + 0.064)
  const zColumns = PERFORMANCE_MODE ? 2 : Math.max(2, Math.min(4, Math.round(depth / 0.72)))
  const rows = PERFORMANCE_MODE ? Math.max(2, Math.floor(height / 1.25)) : Math.max(4, Math.floor(height / 0.7))
  const shopBand = new THREE.Mesh(
    new THREE.BoxGeometry(0.055, 0.68, depth * 0.86),
    material(shopKind === 'cafe' ? 0x4a342b : shopKind === 'flowers' ? 0x42633d : 0xf1dfc5),
  )
  const shopSign = shopKind
    ? new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.23, depth * 0.72), material(shopKind === 'cafe' ? 0x5a3f31 : 0x315d38))
    : null
  const shopText = shopKind
    ? createPaintedText(shopKind === 'cafe' ? 'COFFEE' : 'BLOMSTER', 0xfff1d6, depth * 0.54, 0.18)
    : null

  shopBand.position.set(faceX, -height / 2 + 0.4, 0)
  addOutlined(group, shopBand, 0.004)

  if (shopSign && shopText) {
    shopSign.position.set(signX, -height / 2 + 0.93, 0)
    shopText.position.set(signX - side * 0.035, -height / 2 + 0.93, 0)
    shopText.rotation.y = side * Math.PI * 0.5
    addOutlined(group, shopSign, 0.004)
    group.add(shopText)
  }

  if (shopKind) {
    const awning = new THREE.Mesh(
      new THREE.BoxGeometry(0.34, 0.12, depth * 0.78),
      material(shopKind === 'cafe' ? 0xe7c879 : 0xaebf82),
    )

    awning.position.set(faceX - side * 0.11, -height / 2 + 0.78, 0)
    addOutlined(group, awning, 0.004)
  }

  for (let row = 0; row < rows; row += 1) {
    const y = -height / 2 + 1.35 + row * 0.58

    if (y > height / 2 - 0.18) {
      continue
    }

    for (let col = 0; col < zColumns; col += 1) {
      const z = -depth * 0.35 + col * ((depth * 0.7) / Math.max(1, zColumns - 1))
      const darkInterior = (row + col + index) % 5 === 0
      const recess = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.48, 0.27), material(0xd8c8b8))
      const pane = new THREE.Mesh(
        new THREE.BoxGeometry(0.045, 0.38, 0.19),
        material(darkInterior ? 0x454a48 : 0xf8f1e5),
      )
      const mullionV = PERFORMANCE_MODE ? null : new THREE.Mesh(new THREE.BoxGeometry(0.052, 0.38, 0.018), material(0xffffff))
      const mullionH = PERFORMANCE_MODE ? null : new THREE.Mesh(new THREE.BoxGeometry(0.052, 0.018, 0.19), material(0xffffff))

      recess.position.set(faceX, y, z)
      pane.position.set(faceX - side * 0.022, y, z)
      mullionV?.position.set(faceX - side * 0.05, y, z)
      mullionH?.position.set(faceX - side * 0.052, y, z)
      addOutlined(group, recess, 0.003)
      addOutlined(group, pane, 0.003)
      if (!PERFORMANCE_MODE && !darkInterior) {
        group.add(mullionV, mullionH)
      }

      if (!PERFORMANCE_MODE && (row + col + index) % 6 === 2) {
        const box = createFlowerBox()

        box.position.set(faceX - side * 0.06, y - 0.29, z)
        box.rotation.y = side * Math.PI * 0.5
        group.add(box)
      }
    }
  }

  if ((isNearBuilding && index % 3 === 0) || shopKind) {
    const dormerCount = PERFORMANCE_MODE ? 1 : Math.min(2, zColumns)

    for (let col = 0; col < dormerCount; col += 1) {
      const dormer = createDormerWindow()
      const z = -depth * 0.24 + col * depth * 0.38

      dormer.position.set(faceX - side * 0.12, height / 2 + 0.38, z)
      dormer.rotation.y = side * Math.PI * 0.5
      group.add(dormer)
    }
  }

  return group
}

function createTubeBetween(start, end, radius, tubeMaterial) {
  const direction = end.clone().sub(start)
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, direction.length(), 10), tubeMaterial)

  mesh.position.copy(start.clone().add(end).multiplyScalar(0.5))
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize())

  return mesh
}

function createAvatarLimb(radius, limbMaterial) {
  return new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, 1, 10), limbMaterial)
}

function addAvatarOutlined(parent, mesh, thickness) {
  const outline = mesh.clone()

  outline.material = new THREE.MeshBasicMaterial({
    color: INK,
    side: THREE.BackSide,
  })
  outline.scale.multiplyScalar(1 + thickness)
  outline.castShadow = false
  outline.receiveShadow = false
  mesh.castShadow = true
  mesh.add(outline)
  parent.add(mesh)
}

function updateAvatar(avatar, motionState, tracking, elapsed, keys) {
  const pose = tracking?.pose
  const motion = tracking?.motion ?? { lateral: 0, speed: 0, walking: false }
  const bodyVisible = Boolean(tracking?.bodyCenter?.visible && pose?.leftShoulder && pose?.rightShoulder)
  const targetSpeed = bodyVisible && motion.walking ? (motion.speed ?? 0.05) * MEDIAPIPE_MOVE_SPEED_MULTIPLIER : 0
  const keyboardX = Number(keys.right) - Number(keys.left)
  const keyboardZ = -Number(keys.forward)
  const keyboardActive = keyboardX !== 0 || keyboardZ !== 0
  const poseVx = (motion.directionX ?? 0) * targetSpeed
  const poseVz = (motion.directionZ ?? -1) * targetSpeed
  const keyboardTargetVx = keyboardX * KEYBOARD_SIDE_SPEED
  const keyboardTargetVz = keyboardZ * KEYBOARD_FORWARD_SPEED

  motionState.poseVx += (poseVx - motionState.poseVx) * MEDIAPIPE_MOVEMENT_SMOOTHING
  motionState.poseVz += (poseVz - motionState.poseVz) * MEDIAPIPE_MOVEMENT_SMOOTHING
  motionState.keyboardVx += (keyboardTargetVx - motionState.keyboardVx) * KEYBOARD_MOVEMENT_SMOOTHING
  motionState.keyboardVz += (keyboardTargetVz - motionState.keyboardVz) * KEYBOARD_MOVEMENT_SMOOTHING
  motionState.vx = keyboardActive
    ? THREE.MathUtils.clamp(motionState.poseVx + motionState.keyboardVx, -KEYBOARD_SIDE_SPEED, KEYBOARD_SIDE_SPEED)
    : motionState.poseVx
  motionState.vz = keyboardActive
    ? THREE.MathUtils.clamp(motionState.poseVz + motionState.keyboardVz, -KEYBOARD_FORWARD_SPEED, KEYBOARD_FORWARD_SPEED)
    : motionState.poseVz
  motionState.keyboardActive = keyboardActive || keys.bend
  motionState.keyboardForward = Number(keys.forward)
  motionState.keyboardSide = keyboardX
  motionState.keyboardMovementValue = Math.hypot(motionState.keyboardVx, motionState.keyboardVz)
  motionState.smoothedSpeed += (Math.hypot(motionState.vx, motionState.vz) - motionState.smoothedSpeed) * 0.1
  if (motionState.smoothedSpeed > 0.003) {
    motionState.walkPhase += THREE.MathUtils.clamp(motionState.smoothedSpeed * 42, 0.012, 0.08)
  }
  const forwardStep = Math.max(-motionState.vz, 0) * 0.82
  const forward = forwardVectorFromHeading(motionState.targetHeading)

  motionState.playerWorldX += forward.x * forwardStep
  motionState.playerWorldZ += forward.z * forwardStep
  motionState.worldTravel = -motionState.playerWorldZ
  motionState.scrolling = forwardStep > 0.002
  motionState.lateralOffset = THREE.MathUtils.clamp(motionState.lateralOffset + motionState.vx * 0.82, -2.45, 2.45)
  motionState.x = motionState.lateralOffset
  motionState.z += (3.15 + Math.max(motionState.vz, 0) * 1.25 - motionState.z) * 0.08
  motionState.z = THREE.MathUtils.clamp(motionState.z, 2.85, 3.25)
  motionState.currentHeading += angleDelta(motionState.currentHeading, motionState.targetHeading) * 0.08
  const right = rightVectorFromHeading(motionState.currentHeading)

  avatar.position.set(
    right.x * motionState.lateralOffset,
    0.08,
    motionState.z + right.z * motionState.lateralOffset
  )
  if (motionState.smoothedSpeed > 0.004) {
    const sideYaw = THREE.MathUtils.clamp(motionState.vx * AVATAR_YAW_INFLUENCE, -0.035, 0.035)
    const targetYaw = avatarYawFromHeading(motionState.currentHeading) + sideYaw

    motionState.facingAngle += angleDelta(motionState.facingAngle, targetYaw) * 0.05
  } else {
    motionState.facingAngle += angleDelta(motionState.facingAngle, avatarYawFromHeading(motionState.currentHeading)) * 0.06
  }
  avatar.rotation.y = motionState.facingAngle
  avatar.visible = true

  if (!bodyVisible) {
    setDefaultAvatarPose(avatar, elapsed, keys.bend)
    return
  }

  const points = getAvatarPosePoints(pose)
  const bendPoseSmoothing = keys.bend ? 0.78 : null
  const bodyPoseSmoothing = bendPoseSmoothing ?? 0.35
  const armPoseSmoothing = bendPoseSmoothing ?? 0.38
  const legPoseSmoothing = bendPoseSmoothing ?? 0.34
  motionState.leftWristAvatarX = points.leftWrist.x
  motionState.rightWristAvatarX = points.rightWrist.x
  motionState.screenLeftKneeSource = points.sources.screenLeftKnee
  motionState.screenLeftWristSource = points.sources.screenLeftWrist
  motionState.screenRightKneeSource = points.sources.screenRightKnee
  motionState.screenRightWristSource = points.sources.screenRightWrist
  applyWalkCycle(points, motionState)
  if (keys.bend) {
    applyKeyboardBendPose(points)
  }
  const parts = avatar.userData.parts

  parts.head.position.lerp(points.head, bodyPoseSmoothing)
  setLimb(parts.torso, points.torsoTop, points.hips, bodyPoseSmoothing)
  parts.backpack.position.lerp(points.torsoTop.clone().add(points.hips).multiplyScalar(0.5).add(new THREE.Vector3(0, 0, -0.12)), bodyPoseSmoothing)
  parts.head.rotation.y += (points.poseTurn * 0.7 - parts.head.rotation.y) * 0.18
  parts.torso.rotation.y += (points.poseTurn - parts.torso.rotation.y) * 0.16
  parts.backpack.rotation.y += (points.poseTurn - parts.backpack.rotation.y) * 0.16
  setLimb(parts.leftUpperArm, points.leftShoulder, points.leftElbow, armPoseSmoothing)
  setLimb(parts.leftLowerArm, points.leftElbow, points.leftWrist, armPoseSmoothing)
  setLimb(parts.rightUpperArm, points.rightShoulder, points.rightElbow, armPoseSmoothing)
  setLimb(parts.rightLowerArm, points.rightElbow, points.rightWrist, armPoseSmoothing)
  setLimb(parts.leftUpperLeg, points.leftHip, points.leftKnee, legPoseSmoothing)
  setLimb(parts.leftLowerLeg, points.leftKnee, points.leftAnkle, legPoseSmoothing)
  setLimb(parts.rightUpperLeg, points.rightHip, points.rightKnee, legPoseSmoothing)
  setLimb(parts.rightLowerLeg, points.rightKnee, points.rightAnkle, legPoseSmoothing)
  parts.leftHand.position.lerp(points.leftWrist, armPoseSmoothing)
  parts.rightHand.position.lerp(points.rightWrist, armPoseSmoothing)
  parts.leftFoot.position.lerp(points.leftFoot, legPoseSmoothing)
  parts.rightFoot.position.lerp(points.rightFoot, legPoseSmoothing)
}

function updateWorldScroll(world, motionState) {
  world.position.x = -motionState.playerWorldX
  world.position.z = (-motionState.playerWorldZ) % STREET_REPEAT
}

function updateCameraFollow(camera, avatar, motionState) {
  const forward = forwardVectorFromHeading(motionState.currentHeading)
  const target = avatar.position.clone().add(new THREE.Vector3(0, 1.1, 0)).add(forward.clone().multiplyScalar(4.8))
  const desiredPosition = avatar.position.clone()
    .add(forward.clone().multiplyScalar(-8.8))
    .add(new THREE.Vector3(0, 1.48, 0))

  camera.position.lerp(desiredPosition, 0.08)
  camera.lookAt(target)
}

function avatarYawFromHeading(heading) {
  return AVATAR_BASE_YAW - heading
}

function forwardVectorFromHeading(heading) {
  return new THREE.Vector3(Math.sin(heading), 0, -Math.cos(heading))
}

function rightVectorFromHeading(heading) {
  return new THREE.Vector3(Math.cos(heading), 0, Math.sin(heading))
}

function updateHeadingAndArea(motionState, bikeParts, pickupState, keys, tracking, elapsed) {
  const canTransition = elapsed - motionState.lastTransitionAt > 1
  const atJunction = isNearLeftStreetJunction(motionState)
  const armTurn = updateArmTurnGestureState(motionState, tracking?.pose, elapsed)
  const gestureTurnRequested = armTurn.left || armTurn.right
  let gestureTurnApplied = false

  motionState.turnHint = motionState.currentAreaId === 'leftStreet'
    ? 'Press E to turn back to Main Street'
    : atJunction && motionState.targetHeading === MAIN_STREET_HEADING
      ? 'Press Q to look left'
      : ''

  if (motionState.currentAreaId === 'leftStreet' && keys.returnMain) {
    motionState.currentAreaId = 'mainStreet'
    motionState.currentHeading = MAIN_STREET_HEADING
    motionState.targetHeading = MAIN_STREET_HEADING
    motionState.playerWorldX = 0
    motionState.playerWorldZ = LEFT_STREET_ENTRANCE_Z
    motionState.worldTravel = -motionState.playerWorldZ
    motionState.lateralOffset = 0
    motionState.x = 0
    motionState.lastTransitionAt = elapsed
    motionState.transitionLabel = 'Returned to Main Street'
    motionState.transitionLabelUntil = elapsed + 2
    motionState.turnHint = ''
    pickupState.nearbyPartId = null
    pickupState.gestureState = 'waiting'
    keys.returnMain = false
  }

  if (motionState.currentAreaId === 'leftStreet' && (keys.turnLeft || armTurn.left)) {
    motionState.targetHeading = LEFT_STREET_HEADING
    gestureTurnApplied = gestureTurnApplied || armTurn.left
  } else if (atJunction && (keys.turnLeft || armTurn.left)) {
    motionState.targetHeading = LEFT_STREET_HEADING
    gestureTurnApplied = gestureTurnApplied || armTurn.left
  }

  if (motionState.currentAreaId === 'leftStreet' && (keys.turnRight || armTurn.right)) {
    motionState.targetHeading = RETURN_FROM_LEFT_HEADING
    gestureTurnApplied = gestureTurnApplied || armTurn.right
  } else if (atJunction && (keys.turnRight || armTurn.right)) {
    motionState.targetHeading = MAIN_STREET_HEADING
    gestureTurnApplied = gestureTurnApplied || armTurn.right
  }

  if (gestureTurnRequested) {
    motionState.armTurnTriggerAccepted = gestureTurnApplied
    motionState.armTurnBlockedReason = gestureTurnApplied ? 'accepted' : 'not at turn point'
  }

  if (motionState.currentAreaId === 'mainStreet') {
    if (canTransition && motionState.targetHeading === LEFT_STREET_HEADING && motionState.playerWorldX < -5.2) {
      motionState.currentAreaId = 'leftStreet'
      motionState.lastTransitionAt = elapsed
      motionState.transitionLabel = 'Left Street'
      motionState.transitionLabelUntil = elapsed + 2
      pickupState.nearbyPartId = null
      pickupState.gestureState = 'waiting'
    }
  } else if (motionState.currentAreaId === 'leftStreet') {
    if (canTransition && motionState.targetHeading === RETURN_FROM_LEFT_HEADING && motionState.playerWorldX > -5.2) {
      motionState.currentAreaId = 'mainStreet'
      motionState.targetHeading = MAIN_STREET_HEADING
      motionState.currentHeading = MAIN_STREET_HEADING
      motionState.playerWorldX = 0
      motionState.playerWorldZ = LEFT_STREET_ENTRANCE_Z
      motionState.worldTravel = -motionState.playerWorldZ
      motionState.lateralOffset = 0
      motionState.x = 0
      motionState.lastTransitionAt = elapsed
      motionState.transitionLabel = 'Main Street'
      motionState.transitionLabelUntil = elapsed + 2
      pickupState.nearbyPartId = null
      pickupState.gestureState = 'waiting'
    }
  }

  bikeParts.group.visible = true
}

function updateArmTurnGestureState(motionState, pose, elapsed) {
  const leftWristUsable = isUsableWrist(pose?.leftWrist)
  const rightWristUsable = isUsableWrist(pose?.rightWrist)
  const rawLeftWristX = Number.isFinite(pose?.leftWrist?.x) ? pose.leftWrist.x : 0.5
  const rawRightWristX = Number.isFinite(pose?.rightWrist?.x) ? pose.rightWrist.x : 0.5
  const leftHistory = updateWristHistory(
    motionState.leftWristHistory,
    rawLeftWristX,
    elapsed,
    leftWristUsable,
  )
  const rightHistory = updateWristHistory(
    motionState.rightWristHistory,
    rawRightWristX,
    elapsed,
    rightWristUsable,
  )
  const leftSwipe = leftWristUsable
    ? getSwipeDelta(leftHistory, rawLeftWristX, elapsed)
    : createEmptySwipeDelta()
  const rightSwipe = rightWristUsable
    ? getSwipeDelta(rightHistory, rawRightWristX, elapsed)
    : createEmptySwipeDelta()
  const dominantSwipe = getDominantSwipe(leftSwipe, rightSwipe)
  const swipeLeftDetected = dominantSwipe.direction === 'left'
  const swipeRightDetected = dominantSwipe.direction === 'right'
  const triggerAttempted = swipeLeftDetected || swipeRightDetected
  const motionSettled =
    Math.abs(leftSwipe.deltaX) < ARM_TURN_SETTLE_THRESHOLD &&
    Math.abs(rightSwipe.deltaX) < ARM_TURN_SETTLE_THRESHOLD
  const cooldownRemaining = Math.max(0, motionState.armTurnCooldownUntil - elapsed)
  const result = { left: false, right: false }

  motionState.rawLeftWristX = rawLeftWristX
  motionState.rawRightWristX = rawRightWristX
  motionState.leftWristHistory = leftHistory
  motionState.rightWristHistory = rightHistory
  motionState.leftWristDeltaX = leftSwipe.deltaX
  motionState.rightWristDeltaX = rightSwipe.deltaX
  motionState.leftArmOut = swipeLeftDetected
  motionState.rightArmOut = swipeRightDetected
  motionState.swipeLeftDetected = swipeLeftDetected
  motionState.swipeRightDetected = swipeRightDetected
  motionState.armTurnCooldownMs = cooldownRemaining * 1000
  motionState.armTurnReleased = motionSettled
  motionState.armTurnTriggerAttempted = triggerAttempted
  motionState.armTurnTriggerAccepted = motionState.armTurnTriggeredUntil > elapsed
  motionState.armTurnBlockedReason = getArmTurnBlockedReason({
    cooldownRemaining,
    isArmed: motionState.armTurnArmed,
    leftWristUsable,
    rightWristUsable,
    motionSettled,
    triggerAttempted,
  })
  if (motionState.armTurnTriggeredUntil <= elapsed) {
    motionState.armTurnTriggered = ''
  }

  if (motionSettled) {
    if (!motionState.armTurnSettledSince) {
      motionState.armTurnSettledSince = elapsed
    }
    if (elapsed - motionState.armTurnSettledSince >= ARM_TURN_SETTLE_SECONDS) {
      motionState.armTurnArmed = true
    }
  } else {
    motionState.armTurnSettledSince = null
  }

  if (!motionState.armTurnArmed || !triggerAttempted || cooldownRemaining > 0) {
    return result
  }

  if (swipeLeftDetected) {
    fireArmTurnGesture(motionState, elapsed, 'Q')
    result.left = true
  } else if (swipeRightDetected) {
    fireArmTurnGesture(motionState, elapsed, 'E')
    result.right = true
  }

  return result
}

function getDominantSwipe(leftSwipe, rightSwipe) {
  const strongestSwipe = Math.abs(leftSwipe.deltaX) >= Math.abs(rightSwipe.deltaX)
    ? leftSwipe
    : rightSwipe

  if (strongestSwipe.deltaX <= -ARM_TURN_SWIPE_THRESHOLD) {
    return { direction: 'left', deltaX: strongestSwipe.deltaX }
  }

  if (strongestSwipe.deltaX >= ARM_TURN_SWIPE_THRESHOLD) {
    return { direction: 'right', deltaX: strongestSwipe.deltaX }
  }

  return { direction: 'none', deltaX: strongestSwipe.deltaX }
}

function getArmTurnBlockedReason({
  cooldownRemaining,
  isArmed,
  leftWristUsable,
  rightWristUsable,
  motionSettled,
  triggerAttempted,
}) {
  if (!leftWristUsable && !rightWristUsable) {
    return 'no usable wrist data'
  }

  if (!triggerAttempted) {
    return motionSettled ? 'released/ready' : 'below swipe threshold'
  }

  if (cooldownRemaining > 0) {
    return 'cooldown'
  }

  if (!isArmed) {
    return 'waiting for release'
  }

  return 'accepted'
}

function isUsableWrist(wrist) {
  if (!Number.isFinite(wrist?.x)) {
    return false
  }

  const visibility = Number.isFinite(wrist.visibility) ? wrist.visibility : 1
  const presence = Number.isFinite(wrist.presence) ? wrist.presence : 1
  return visibility >= 0.2 && presence >= 0.2
}

function updateWristHistory(history = [], x, elapsed, isUsable) {
  const nextHistory = history.filter(
    (sample) => elapsed - sample.elapsed <= ARM_TURN_MAX_WINDOW_SECONDS,
  )

  if (isUsable) {
    nextHistory.push({ x, elapsed })
  }

  return nextHistory
}

function getSwipeDelta(history, currentX, elapsed) {
  let strongestDelta = 0

  for (const sample of history) {
    const sampleAge = elapsed - sample.elapsed
    if (
      sampleAge < ARM_TURN_MIN_SAMPLE_SECONDS ||
      sampleAge > ARM_TURN_MAX_WINDOW_SECONDS
    ) {
      continue
    }

    const deltaX = currentX - sample.x
    if (Math.abs(deltaX) > Math.abs(strongestDelta)) {
      strongestDelta = deltaX
    }
  }

  return {
    deltaX: strongestDelta,
    leftDetected: strongestDelta <= -ARM_TURN_SWIPE_THRESHOLD,
    rightDetected: strongestDelta >= ARM_TURN_SWIPE_THRESHOLD,
  }
}

function createEmptySwipeDelta() {
  return {
    deltaX: 0,
    leftDetected: false,
    rightDetected: false,
  }
}

function fireArmTurnGesture(motionState, elapsed, triggerKey) {
  motionState.armTurnArmed = false
  motionState.armTurnBlockedReason = 'accepted'
  motionState.armTurnCooldownUntil = elapsed + ARM_TURN_COOLDOWN_SECONDS
  motionState.armTurnCooldownMs = ARM_TURN_COOLDOWN_SECONDS * 1000
  motionState.armTurnTriggerAccepted = true
  motionState.armTurnTriggered = triggerKey
  motionState.armTurnTriggeredUntil = elapsed + 0.75
  motionState.armTurnSettledSince = null
  motionState.leftWristHistory = []
  motionState.rightWristHistory = []
}

function isNearLeftStreetJunction(motionState) {
  return Math.abs(motionState.playerWorldZ - LEFT_STREET_ENTRANCE_Z) < 5 && motionState.playerWorldX > -5.8
}

function publishWorldDebug(motionState, onWorldDebug, elapsed, scene, renderer, perfState, tracking) {
  if (!onWorldDebug || elapsed - motionState.lastDebugAt < 0.12) {
    return
  }

  motionState.lastDebugAt = elapsed
  const currentSceneStats = countSceneObjects(scene)

  perfState.meshCount = currentSceneStats.meshCount
  perfState.totalObjects = currentSceneStats.totalObjects
  perfState.visibleObjects = currentSceneStats.visibleObjects
  onWorldDebug({
    avatarBaseYaw: AVATAR_BASE_YAW,
    currentAreaId: motionState.currentAreaId,
    effectiveAvatarYaw: motionState.facingAngle,
    facingAngle: motionState.facingAngle,
    heading: motionState.currentHeading,
    armTurnCooldownMs: motionState.armTurnCooldownMs ?? 0,
    armTurnReleased: motionState.armTurnReleased ?? true,
    armTurnBlockedReason: motionState.armTurnBlockedReason ?? 'ready',
    armTurnTriggerAccepted: motionState.armTurnTriggerAccepted ?? false,
    armTurnTriggerAttempted: motionState.armTurnTriggerAttempted ?? false,
    armTurnTriggered: motionState.armTurnTriggered ?? '',
    keyboardActive: motionState.keyboardActive,
    keyboardForward: motionState.keyboardForward,
    keyboardMovementValue: motionState.keyboardMovementValue,
    keyboardSide: motionState.keyboardSide,
    keyboardSpeedMultiplier: KEYBOARD_SPEED_MULTIPLIER,
    keyboardSmoothing: KEYBOARD_MOVEMENT_SMOOTHING,
    leftWristAvatarX: motionState.leftWristAvatarX ?? 0,
    leftArmOut: motionState.leftArmOut ?? false,
    leftWristDeltaX: motionState.leftWristDeltaX ?? 0,
    rawLeftWristX: motionState.rawLeftWristX ?? 0.5,
    movementSmoothing: MEDIAPIPE_MOVEMENT_SMOOTHING,
    poseDebugMode: POSE_DEBUG_MODE,
    poseMode: POSE_MODE,
    poseMirrorX: POSE_MIRROR_X,
    screenLeftKneeSource: motionState.screenLeftKneeSource ?? 'none',
    screenLeftWristSource: motionState.screenLeftWristSource ?? 'none',
    screenRightKneeSource: motionState.screenRightKneeSource ?? 'none',
    rightWristAvatarX: motionState.rightWristAvatarX ?? 0,
    rightArmOut: motionState.rightArmOut ?? false,
    rightWristDeltaX: motionState.rightWristDeltaX ?? 0,
    rawRightWristX: motionState.rawRightWristX ?? 0.5,
    screenRightWristSource: motionState.screenRightWristSource ?? 'none',
    swipeLeftDetected: motionState.swipeLeftDetected ?? false,
    swipeRightDetected: motionState.swipeRightDetected ?? false,
    yawInfluence: AVATAR_YAW_INFLUENCE,
    scrolling: motionState.scrolling,
    smoothedSpeed: motionState.smoothedSpeed,
    worldZ: motionState.worldTravel,
    perf: {
      avgAmbientMs: perfState.avgAmbientMs,
      avgAvatarMs: perfState.avgAvatarMs,
      avgFrameMs: perfState.avgFrameMs,
      avgHeadingMs: perfState.avgHeadingMs,
      avgMapDebugMs: perfState.avgMapDebugMs,
      avgPickupMs: perfState.avgPickupMs,
      avgRenderMs: perfState.avgRenderMs,
      avgWorldMs: perfState.avgWorldMs,
      drawCalls: perfState.drawCalls || renderer.info.render.calls,
      fps: perfState.fps,
      mediaPipeActive: Boolean(tracking?.performance?.mediaPipeActive),
      mediaPipeFrameMs: tracking?.performance?.avgFrameMs ?? 0,
      mediaPipeHandMs: tracking?.performance?.avgHandMs ?? 0,
      mediaPipePoseMs: tracking?.performance?.avgPoseMs ?? 0,
      mediaPipePostMs: tracking?.performance?.avgPostMs ?? 0,
      meshCount: perfState.meshCount,
      totalObjects: perfState.totalObjects,
      visibleObjects: perfState.visibleObjects,
    },
  })
}

function smoothMetric(current, next, smoothing = 0.12) {
  if (!Number.isFinite(current) || current === 0) {
    return next
  }

  return current + (next - current) * smoothing
}

function countSceneObjects(scene) {
  const stats = {
    meshCount: 0,
    totalObjects: 0,
    visibleObjects: 0,
  }

  scene.traverse((child) => {
    stats.totalObjects += 1

    if (child.visible) {
      stats.visibleObjects += 1
    }

    if (child.isMesh) {
      stats.meshCount += 1
    }
  })

  return stats
}

function publishMapData(motionState, parts, onMapData, elapsed) {
  if (!onMapData || elapsed - motionState.lastMapAt < 0.08) {
    return
  }

  motionState.lastMapAt = elapsed
  onMapData({
    areaId: motionState.currentAreaId,
    player: getMapPlayerPosition(motionState),
    parts: parts.map((part) => ({
      collected: part.collected,
      areaId: part.areaId ?? 'mainStreet',
      id: part.id,
      label: part.label,
      ...getPartMapPosition(part.id),
    })),
    transitionLabel: motionState.transitionLabelUntil > elapsed ? motionState.transitionLabel : '',
    turnHint: motionState.turnHint,
  })
}

function getMapPlayerPosition(motionState) {
  if (motionState.currentAreaId === 'leftStreet') {
    const leftProgress = THREE.MathUtils.clamp((Math.abs(motionState.playerWorldX) - 5.2) / 38, 0, 1)

    return {
      progress: THREE.MathUtils.clamp(
        MAP_LEFT_STREET.centerY + motionState.x / 42,
        MAP_LEFT_STREET.centerY - MAP_LEFT_STREET.halfWidth * 0.72,
        MAP_LEFT_STREET.centerY + MAP_LEFT_STREET.halfWidth * 0.72,
      ),
      side: getStreetSideLabel(motionState.x),
      sidePosition: THREE.MathUtils.clamp(
        MAP_LEFT_STREET.endX - leftProgress * (MAP_LEFT_STREET.endX - MAP_LEFT_STREET.startX),
        MAP_LEFT_STREET.startX,
        MAP_LEFT_STREET.endX,
      ),
    }
  }

  return {
    progress: normalizeStreetProgress(motionState.worldTravel),
    side: getStreetSideLabel(motionState.x),
    sidePosition: projectMainStreetPlayerSide(motionState.x),
  }
}

function normalizeStreetProgress(worldTravel) {
  const progress = (worldTravel % STREET_REPEAT) / STREET_REPEAT

  return THREE.MathUtils.clamp(progress, 0, 1)
}

function projectMainStreetPlayerSide(x) {
  return THREE.MathUtils.clamp(
    MAP_MAIN_STREET.centerX + x / 42,
    MAP_MAIN_STREET.centerX - MAP_MAIN_STREET.halfWidth * 0.72,
    MAP_MAIN_STREET.centerX + MAP_MAIN_STREET.halfWidth * 0.72,
  )
}

function getStreetSideLabel(x) {
  if (x < -0.65) {
    return 'left'
  }

  if (x > 0.65) {
    return 'right'
  }

  return 'center'
}

function angleDelta(current, target) {
  return Math.atan2(Math.sin(target - current), Math.cos(target - current))
}

function applyWalkCycle(points, motionState) {
  const speedFactor = THREE.MathUtils.clamp(motionState.smoothedSpeed / 0.05, 0, 1)

  if (speedFactor <= 0.02) {
    return
  }

  const stride = Math.sin(motionState.walkPhase) * 0.13 * speedFactor
  const counterStride = -stride
  const bob = Math.abs(Math.sin(motionState.walkPhase)) * 0.035 * speedFactor
  const armSwing = Math.sin(motionState.walkPhase + Math.PI) * 0.075 * speedFactor

  points.head.y += bob * 0.4
  points.torsoTop.y += bob * 0.5
  points.hips.y += bob * 0.35
  points.leftKnee.z += stride
  points.leftAnkle.z += stride * 1.2
  points.leftFoot.z += stride * 1.35
  points.rightKnee.z += counterStride
  points.rightAnkle.z += counterStride * 1.2
  points.rightFoot.z += counterStride * 1.35
  points.leftElbow.z += armSwing
  points.leftWrist.z += armSwing * 1.2
  points.rightElbow.z -= armSwing
  points.rightWrist.z -= armSwing * 1.2
}

function applyKeyboardBendPose(points) {
  points.head.y -= 0.34
  points.head.z += 0.1
  points.torsoTop.y -= 0.28
  points.torsoTop.z += 0.08
  points.hips.y -= 0.1
  points.leftShoulder.y -= 0.28
  points.rightShoulder.y -= 0.28
  points.leftElbow.set(-0.34, 0.5, 0.1)
  points.rightElbow.set(0.34, 0.5, 0.1)
  points.leftWrist.set(-0.26, 0.16, 0.18)
  points.rightWrist.set(0.26, 0.16, 0.18)
  points.leftKnee.y -= 0.12
  points.rightKnee.y -= 0.12
}

function updateBikeParts(bikeParts, avatarMotion, avatar, tracking, keys, pickupState, onPickupDebug, elapsed) {
  const poseHandsLow = getHandsLow(tracking?.pose)
  const keyboardBend = Boolean(keys.bend)
  const handsLow = poseHandsLow || keyboardBend
  const nearbyPart = findNearbyPart(bikeParts.parts, avatarMotion)

  updatePickupAnimations(bikeParts, avatar, elapsed)

  for (const part of bikeParts.parts) {
    const partAreaId = part.areaId ?? 'mainStreet'

    if (partAreaId !== avatarMotion.currentAreaId && !part.collecting) {
      part.mesh.visible = false
      part.halo.visible = false
      continue
    }

    if (!part.collected) {
      part.mesh.visible = true
    }

    if (part.collecting) {
      continue
    }

    const isNearby = nearbyPart?.id === part.id
    const shouldHighlight = isNearby && handsLow && !part.collected

    part.halo.visible = shouldHighlight
    part.mesh.rotation.y += part.collected ? 0 : 0.01
    part.mesh.scale.lerp(new THREE.Vector3(shouldHighlight ? 1.18 : 1, shouldHighlight ? 1.18 : 1, shouldHighlight ? 1.18 : 1), 0.18)
  }

  if (!nearbyPart) {
    pickupState.nearbyPartId = null
    pickupState.gestureState = pickupState.feedbackUntil > elapsed ? 'collected' : 'waiting'
    publishPickupDebug(pickupState, onPickupDebug, handsLow, null, bikeParts.parts, elapsed)
    return
  }

  if (pickupState.nearbyPartId !== nearbyPart.id) {
    pickupState.nearbyPartId = nearbyPart.id
    pickupState.gestureState = 'waiting'
  }

  if (pickupState.gestureState === 'waiting' && handsLow) {
    pickupState.gestureState = 'hands down'
  }

  if (keyboardBend && (pickupState.gestureState === 'waiting' || pickupState.gestureState === 'hands down')) {
    collectNearbyPart(nearbyPart, bikeParts, avatar, pickupState, elapsed)
    publishPickupDebug(pickupState, onPickupDebug, handsLow, nearbyPart, bikeParts.parts, elapsed)
    return
  }

  if (pickupState.gestureState === 'hands down' && !handsLow) {
    collectNearbyPart(nearbyPart, bikeParts, avatar, pickupState, elapsed)
  }

  publishPickupDebug(pickupState, onPickupDebug, handsLow, nearbyPart, bikeParts.parts, elapsed)
}

function collectNearbyPart(nearbyPart, bikeParts, avatar, pickupState, elapsed) {
  nearbyPart.collected = true
  nearbyPart.collecting = true
  nearbyPart.halo.visible = false
  startPickupAnimation(nearbyPart, bikeParts, avatar, elapsed)
  pickupState.feedback = `Collected: ${nearbyPart.label}`
  pickupState.feedbackUntil = elapsed + 2.2
  pickupState.gestureState = 'collected'
}

function startPickupAnimation(part, bikeParts, avatar, elapsed) {
  const backpack = avatar.userData.parts.backpack
  const text = createPickupTextSprite('+1 part')
  const partWorldPosition = part.mesh.getWorldPosition(new THREE.Vector3())
  const partAvatarPosition = avatar.worldToLocal(partWorldPosition.clone())
  const handSide = partAvatarPosition.x < 0 ? -1 : 1

  backpack.userData.glowUntil = 0
  text.position.copy(part.mesh.position).add(new THREE.Vector3(0, 0.9, 0))
  bikeParts.group.add(text)
  bikeParts.pickupAnimations.push({
    duration: PICKUP_ANIMATION_DURATION,
    handSide,
    part,
    partAvatarPosition,
    startAt: elapsed,
    startPosition: part.mesh.position.clone(),
    startRotationY: part.mesh.rotation.y,
    startScale: part.mesh.scale.clone(),
    text,
  })
}

function updatePickupAnimations(bikeParts, avatar, elapsed) {
  for (let index = bikeParts.pickupAnimations.length - 1; index >= 0; index -= 1) {
    const animation = bikeParts.pickupAnimations[index]
    const progress = THREE.MathUtils.clamp((elapsed - animation.startAt) / animation.duration, 0, 1)
    const carryPose = applyPickupCarryPose(avatar, animation, progress)

    if (progress < 0.22) {
      animation.part.mesh.position.copy(animation.startPosition)
      animation.part.mesh.scale.copy(animation.startScale)
    } else {
      const handPosition = avatar.localToWorld(carryPose.hand.clone())

      bikeParts.group.worldToLocal(handPosition)
      animation.part.mesh.position.copy(handPosition)
      animation.part.mesh.rotation.y = animation.startRotationY + Math.PI * 0.7 * easeOutCubic(progress)
      animation.part.mesh.scale.copy(animation.startScale).multiplyScalar(getPickupCarryScale(progress))
    }

    animation.text.position.copy(animation.part.mesh.position).add(new THREE.Vector3(0, 0.7, 0))
    animation.text.material.opacity = progress < 0.2 ? 0 : THREE.MathUtils.clamp((progress - 0.2) / 0.18, 0, 1) * (1 - progress * 0.72)

    if (progress >= 1) {
      animation.part.mesh.visible = false
      animation.part.collecting = false
      avatar.userData.parts.backpack.userData.glowUntil = elapsed + 0.7
      animation.text.parent?.remove(animation.text)
      animation.text.material.map?.dispose()
      animation.text.material.dispose()
      bikeParts.pickupAnimations.splice(index, 1)
    }
  }
}

function applyPickupCarryPose(avatar, animation, progress) {
  const parts = avatar.userData.parts
  const side = animation.handSide
  const oppositeSide = side * -1
  const reachEnd = 0.22
  const liftEnd = 0.46
  const carryEnd = 0.8
  const reachPoint = animation.partAvatarPosition.clone()

  reachPoint.x = THREE.MathUtils.clamp(reachPoint.x, -0.42, 0.42)
  reachPoint.y = 0.18
  reachPoint.z = 0.2

  const liftPoint = new THREE.Vector3(side * 0.34, 0.78, 0.12)
  const backpackPoint = new THREE.Vector3(side * 0.08, 1.02, -0.2)
  const shoulder = new THREE.Vector3(side * 0.24, 1.02, 0.03)
  const oppositeShoulder = new THREE.Vector3(oppositeSide * 0.24, 1.12, 0)
  const hand = new THREE.Vector3()
  const elbow = new THREE.Vector3()

  if (progress < reachEnd) {
    const t = easeInOutCubic(progress / reachEnd)

    hand.lerpVectors(new THREE.Vector3(side * 0.32, 0.62, 0), reachPoint, t)
    elbow.lerpVectors(new THREE.Vector3(side * 0.34, 0.72, 0.04), new THREE.Vector3(side * 0.38, 0.42, 0.14), t)
  } else if (progress < liftEnd) {
    const t = easeInOutCubic((progress - reachEnd) / (liftEnd - reachEnd))

    hand.lerpVectors(reachPoint, liftPoint, t)
    elbow.lerpVectors(new THREE.Vector3(side * 0.38, 0.42, 0.14), new THREE.Vector3(side * 0.46, 0.72, 0.08), t)
  } else if (progress < carryEnd) {
    const t = easeInOutCubic((progress - liftEnd) / (carryEnd - liftEnd))

    hand.lerpVectors(liftPoint, backpackPoint, t)
    elbow.lerpVectors(new THREE.Vector3(side * 0.46, 0.72, 0.08), new THREE.Vector3(side * 0.34, 0.96, -0.12), t)
  } else {
    const t = easeInOutCubic((progress - carryEnd) / (1 - carryEnd))

    hand.lerpVectors(backpackPoint, new THREE.Vector3(side * 0.04, 1, -0.24), t)
    elbow.lerpVectors(new THREE.Vector3(side * 0.34, 0.96, -0.12), new THREE.Vector3(side * 0.24, 0.98, -0.14), t)
  }

  const bend = 1 - THREE.MathUtils.clamp(progress / 0.55, 0, 1)
  const torsoTop = new THREE.Vector3(0, 1.28 - bend * 0.22, bend * 0.08)
  const hips = new THREE.Vector3(0, 0.82 - bend * 0.08, 0)

  parts.head.position.lerp(new THREE.Vector3(0, 1.52 - bend * 0.28, bend * 0.1), 0.7)
  setLimb(parts.torso, torsoTop, hips, 0.72)
  setLimb(
    side < 0 ? parts.leftUpperArm : parts.rightUpperArm,
    shoulder,
    elbow,
    0.78
  )
  setLimb(
    side < 0 ? parts.leftLowerArm : parts.rightLowerArm,
    elbow,
    hand,
    0.78
  )
  setLimb(
    oppositeSide < 0 ? parts.leftUpperArm : parts.rightUpperArm,
    oppositeShoulder,
    new THREE.Vector3(oppositeSide * 0.36, 0.7, 0.06),
    0.42
  )
  setLimb(
    oppositeSide < 0 ? parts.leftLowerArm : parts.rightLowerArm,
    new THREE.Vector3(oppositeSide * 0.36, 0.7, 0.06),
    new THREE.Vector3(oppositeSide * 0.26, 0.46, 0.04),
    0.42
  )
  parts[side < 0 ? 'leftHand' : 'rightHand'].position.lerp(hand, 0.8)
  parts[oppositeSide < 0 ? 'leftHand' : 'rightHand'].position.lerp(new THREE.Vector3(oppositeSide * 0.26, 0.46, 0.04), 0.42)
  parts.backpack.rotation.y += (side * 0.18 - parts.backpack.rotation.y) * 0.18

  return { hand }
}

function getPickupCarryScale(progress) {
  if (progress < 0.46) {
    return THREE.MathUtils.lerp(0.82, 0.68, easeOutCubic((progress - 0.22) / 0.24))
  }

  if (progress < 0.8) {
    return 0.68
  }

  return THREE.MathUtils.lerp(0.68, 0.04, easeOutCubic((progress - 0.8) / 0.2))
}

function createPickupTextSprite(label) {
  const canvas = document.createElement('canvas')
  const context = canvas.getContext('2d')

  canvas.width = 256
  canvas.height = 96
  if (!context) {
    const fallback = new THREE.Sprite(new THREE.SpriteMaterial({
      color: 0xffedb7,
      opacity: 0.9,
      transparent: true,
    }))

    fallback.scale.set(0.34, 0.14, 1)

    return fallback
  }

  context.font = '700 34px system-ui, -apple-system, BlinkMacSystemFont, sans-serif'
  context.textAlign = 'center'
  context.textBaseline = 'middle'
  context.fillStyle = 'rgba(255, 250, 239, 0.92)'
  roundRect(context, 34, 18, 188, 58, 18)
  context.fill()
  context.strokeStyle = 'rgba(36, 49, 47, 0.22)'
  context.lineWidth = 4
  roundRect(context, 34, 18, 188, 58, 18)
  context.stroke()
  context.fillStyle = '#24312f'
  context.fillText(label, 128, 48)

  const texture = new THREE.CanvasTexture(canvas)
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
    map: texture,
    opacity: 1,
    transparent: true,
  }))

  sprite.scale.set(1.35, 0.5, 1)

  return sprite
}

function roundRect(context, x, y, width, height, radius) {
  context.beginPath()
  context.moveTo(x + radius, y)
  context.lineTo(x + width - radius, y)
  context.quadraticCurveTo(x + width, y, x + width, y + radius)
  context.lineTo(x + width, y + height - radius)
  context.quadraticCurveTo(x + width, y + height, x + width - radius, y + height)
  context.lineTo(x + radius, y + height)
  context.quadraticCurveTo(x, y + height, x, y + height - radius)
  context.lineTo(x, y + radius)
  context.quadraticCurveTo(x, y, x + radius, y)
  context.closePath()
}

function updateBackpackGlow(avatar, elapsed) {
  const backpack = avatar.userData.parts.backpack
  const glowUntil = backpack.userData.glowUntil ?? 0
  const baseColor = backpack.userData.baseColor
  const glowColor = backpack.userData.glowColor

  if (!baseColor || !glowColor) {
    return
  }

  if (glowUntil <= elapsed) {
    backpack.material.color.copy(baseColor)
    backpack.scale.setScalar(1)
    return
  }

  const remaining = THREE.MathUtils.clamp((glowUntil - elapsed) / PICKUP_ANIMATION_DURATION, 0, 1)
  const pulse = Math.sin((1 - remaining) * Math.PI * 3) * remaining

  backpack.material.color.copy(baseColor).lerp(glowColor, Math.max(0, pulse) * 0.85)
  backpack.scale.setScalar(1 + Math.max(0, pulse) * 0.18)
}

function easeOutCubic(value) {
  return 1 - (1 - value) ** 3
}

function easeInOutCubic(value) {
  const clamped = THREE.MathUtils.clamp(value, 0, 1)

  return clamped < 0.5
    ? 4 * clamped ** 3
    : 1 - ((-2 * clamped + 2) ** 3) / 2
}

function findNearbyPart(parts, avatarMotion) {
  let nearest = null
  let nearestDistance = Infinity
  const worldOffsetX = -avatarMotion.playerWorldX
  const worldOffsetZ = (-avatarMotion.playerWorldZ) % STREET_REPEAT

  for (const part of parts) {
    if (part.collected || (part.areaId ?? 'mainStreet') !== avatarMotion.currentAreaId) {
      continue
    }

    const visibleZ = part.z + worldOffsetZ
    const visibleX = part.x + worldOffsetX
    const dx = visibleX - avatarMotion.x
    const dz = visibleZ - avatarMotion.z
    const distance = Math.hypot(dx * 0.9, dz)

    if (Math.abs(dx) < 1.45 && Math.abs(dz) < 2.2 && distance < nearestDistance) {
      nearest = part
      nearestDistance = distance
    }
  }

  return nearest
}

function getHandsLow(pose) {
  const leftWrist = pose?.leftWrist
  const rightWrist = pose?.rightWrist
  const leftHip = pose?.leftHip
  const rightHip = pose?.rightHip
  const leftKnee = pose?.leftKnee
  const rightKnee = pose?.rightKnee

  if (!leftWrist || !rightWrist || !leftHip || !rightHip) {
    return false
  }

  const hipY = (leftHip.y + rightHip.y) / 2
  const kneeY = leftKnee && rightKnee ? (leftKnee.y + rightKnee.y) / 2 : hipY + 0.16
  const lowThreshold = Math.min(hipY + 0.08, hipY + (kneeY - hipY) * 0.52)

  return leftWrist.y > lowThreshold && rightWrist.y > lowThreshold
}

function publishPickupDebug(pickupState, onPickupDebug, handsLow, nearbyPart, parts, elapsed) {
  if (!onPickupDebug || elapsed - pickupState.lastDebugAt < 0.1) {
    return
  }

  pickupState.lastDebugAt = elapsed
  if (pickupState.feedbackUntil <= elapsed) {
    pickupState.feedback = ''
    if (pickupState.gestureState === 'collected') {
      pickupState.gestureState = 'waiting'
    }
  }

  onPickupDebug({
    feedback: pickupState.feedback,
    gestureState: pickupState.gestureState,
    handsLow,
    nearbyPart: nearbyPart && !nearbyPart.collected ? nearbyPart.label : 'none',
    parts: parts.map((part) => ({
      collected: part.collected,
      id: part.id,
      label: part.label,
    })),
  })
}

function setDefaultAvatarPose(avatar, elapsed, bending = false) {
  const parts = avatar.userData.parts
  const sway = Math.sin(elapsed * 2.2) * 0.04
  const bendOffset = bending ? 0.32 : 0
  const poseSmoothing = bending ? 0.7 : 0.14
  const reachY = bending ? 0.16 : 0.63
  const reachZ = bending ? 0.18 : 0
  const head = new THREE.Vector3(0, 1.55 + sway - bendOffset, bending ? 0.1 : 0)
  const torsoTop = new THREE.Vector3(0, 1.28 - bendOffset * 0.86, bending ? 0.08 : 0)
  const hips = new THREE.Vector3(0, 0.82 - bendOffset * 0.28, 0)
  const leftShoulder = new THREE.Vector3(-0.24, 1.23 - bendOffset * 0.86, bending ? 0.08 : 0)
  const rightShoulder = new THREE.Vector3(0.24, 1.23 - bendOffset * 0.86, bending ? 0.08 : 0)
  const leftHip = new THREE.Vector3(-0.13, 0.82, 0)
  const rightHip = new THREE.Vector3(0.13, 0.82, 0)

  parts.head.position.lerp(head, bending ? 0.7 : 0.12)
  setLimb(parts.torso, torsoTop, hips, poseSmoothing)
  parts.backpack.position.lerp(new THREE.Vector3(0, 1.05, -0.12), poseSmoothing)
  setLimb(parts.leftUpperArm, leftShoulder, new THREE.Vector3(-0.36, bending ? 0.5 : 0.92, bending ? 0.1 : 0), poseSmoothing)
  setLimb(parts.leftLowerArm, new THREE.Vector3(-0.36, bending ? 0.5 : 0.92, bending ? 0.1 : 0), new THREE.Vector3(-0.32, reachY, reachZ), poseSmoothing)
  setLimb(parts.rightUpperArm, rightShoulder, new THREE.Vector3(0.36, bending ? 0.5 : 0.92, bending ? 0.1 : 0), poseSmoothing)
  setLimb(parts.rightLowerArm, new THREE.Vector3(0.36, bending ? 0.5 : 0.92, bending ? 0.1 : 0), new THREE.Vector3(0.32, reachY, reachZ), poseSmoothing)
  setLimb(parts.leftUpperLeg, leftHip, new THREE.Vector3(-0.16, bending ? 0.31 : 0.43, 0), poseSmoothing)
  setLimb(parts.leftLowerLeg, new THREE.Vector3(-0.16, bending ? 0.31 : 0.43, 0), new THREE.Vector3(-0.18, 0.08, 0.04), poseSmoothing)
  setLimb(parts.rightUpperLeg, rightHip, new THREE.Vector3(0.16, bending ? 0.31 : 0.43, 0), poseSmoothing)
  setLimb(parts.rightLowerLeg, new THREE.Vector3(0.16, bending ? 0.31 : 0.43, 0), new THREE.Vector3(0.18, 0.08, 0.04), poseSmoothing)
  parts.leftHand.position.lerp(new THREE.Vector3(-0.32, reachY, reachZ), poseSmoothing)
  parts.rightHand.position.lerp(new THREE.Vector3(0.32, reachY, reachZ), poseSmoothing)
  parts.leftFoot.position.lerp(new THREE.Vector3(-0.18, 0.04, 0.12), poseSmoothing)
  parts.rightFoot.position.lerp(new THREE.Vector3(0.18, 0.04, 0.12), poseSmoothing)
}

function getAvatarPosePoints(pose) {
  const poseSides = getAvatarPoseSideLandmarks(pose)
  const leftShoulder = mediaPipeToAvatarLocal(poseSides.left.shoulder, SCREEN_LEFT_LOCAL_X, 1.25)
  const rightShoulder = mediaPipeToAvatarLocal(poseSides.right.shoulder, SCREEN_RIGHT_LOCAL_X, 1.25)
  const leftHip = mediaPipeToAvatarLocal(poseSides.left.hip, 0.13, 0.82)
  const rightHip = mediaPipeToAvatarLocal(poseSides.right.hip, -0.13, 0.82)
  const leftElbow = mediaPipeToAvatarLocal(poseSides.left.elbow, 0.37, 0.95)
  const rightElbow = mediaPipeToAvatarLocal(poseSides.right.elbow, -0.37, 0.95)
  const leftWrist = mediaPipeToAvatarLocal(poseSides.left.wrist, 0.42, 0.68)
  const rightWrist = mediaPipeToAvatarLocal(poseSides.right.wrist, -0.42, 0.68)
  const leftKnee = mediaPipeToAvatarLocal(poseSides.left.knee, 0.15, 0.44)
  const rightKnee = mediaPipeToAvatarLocal(poseSides.right.knee, -0.15, 0.44)
  const leftAnkle = mediaPipeToAvatarLocal(poseSides.left.ankle, 0.18, 0.1)
  const rightAnkle = mediaPipeToAvatarLocal(poseSides.right.ankle, -0.18, 0.1)
  const shoulderCenter = leftShoulder.clone().add(rightShoulder).multiplyScalar(0.5)
  const hipCenter = leftHip.clone().add(rightHip).multiplyScalar(0.5)
  const poseTurn = THREE.MathUtils.clamp((shoulderCenter.x - hipCenter.x) * 0.65, -0.18, 0.18)

  return {
    head: mediaPipeToAvatarLocal(pose.nose, 0, 1.55),
    torsoTop: shoulderCenter,
    hips: hipCenter,
    leftShoulder,
    rightShoulder,
    leftElbow,
    rightElbow,
    leftWrist,
    rightWrist,
    leftHip,
    rightHip,
    leftKnee,
    rightKnee,
    leftAnkle,
    rightAnkle,
    leftFoot: leftAnkle.clone().add(new THREE.Vector3(0, -0.04, 0.1)),
    poseTurn,
    rightFoot: rightAnkle.clone().add(new THREE.Vector3(0, -0.04, 0.1)),
    sources: poseSides.sources,
  }
}

function getAvatarPoseSideLandmarks(pose) {
  const realLeft = {
    ankle: pose.leftAnkle,
    elbow: pose.leftElbow,
    hip: pose.leftHip,
    knee: pose.leftKnee,
    shoulder: pose.leftShoulder,
    wrist: pose.leftWrist,
  }
  const realRight = {
    ankle: pose.rightAnkle,
    elbow: pose.rightElbow,
    hip: pose.rightHip,
    knee: pose.rightKnee,
    shoulder: pose.rightShoulder,
    wrist: pose.rightWrist,
  }

  if (POSE_MODE !== 'screen-mirror') {
    return createOriginalPoseSideLandmarks(realLeft, realRight)
  }

  if (!isValidLandmark(realLeft.shoulder) || !isValidLandmark(realRight.shoulder)) {
    return createOriginalPoseSideLandmarks(realLeft, realRight)
  }

  const wristSides = getScreenSidePair(realLeft.wrist, realRight.wrist, 'real left wrist', 'real right wrist')
  const kneeSides = getScreenSidePair(realLeft.knee, realRight.knee, 'real left knee', 'real right knee')
  const ankleSides = getScreenSidePair(realLeft.ankle, realRight.ankle, 'real left ankle', 'real right ankle')
  const elbowSides = getScreenSidePair(realLeft.elbow, realRight.elbow, 'real left elbow', 'real right elbow')
  const hipSides = getScreenSidePair(realLeft.hip, realRight.hip, 'real left hip', 'real right hip')
  const shoulderSides = getScreenSidePair(realLeft.shoulder, realRight.shoulder, 'real left shoulder', 'real right shoulder')

  return {
    left: {
      ankle: ankleSides.left.point,
      elbow: elbowSides.left.point,
      hip: hipSides.left.point,
      knee: kneeSides.left.point,
      shoulder: shoulderSides.left.point,
      wrist: wristSides.left.point,
    },
    right: {
      ankle: ankleSides.right.point,
      elbow: elbowSides.right.point,
      hip: hipSides.right.point,
      knee: kneeSides.right.point,
      shoulder: shoulderSides.right.point,
      wrist: wristSides.right.point,
    },
    sources: {
      screenLeftKnee: kneeSides.left.label,
      screenLeftWrist: wristSides.left.label,
      screenRightKnee: kneeSides.right.label,
      screenRightWrist: wristSides.right.label,
    },
  }
}

function getScreenSidePair(leftPoint, rightPoint, leftLabel, rightLabel) {
  const hasLeft = isValidLandmark(leftPoint)
  const hasRight = isValidLandmark(rightPoint)

  if (!hasLeft && !hasRight) {
    return {
      left: { label: 'none', point: null },
      right: { label: 'none', point: null },
    }
  }

  if (!hasLeft) {
    return {
      left: { label: rightLabel, point: rightPoint },
      right: { label: rightLabel, point: rightPoint },
    }
  }

  if (!hasRight) {
    return {
      left: { label: leftLabel, point: leftPoint },
      right: { label: leftLabel, point: leftPoint },
    }
  }

  return leftPoint.x <= rightPoint.x
    ? {
        left: { label: leftLabel, point: leftPoint },
        right: { label: rightLabel, point: rightPoint },
      }
    : {
        left: { label: rightLabel, point: rightPoint },
        right: { label: leftLabel, point: leftPoint },
      }
}

function createOriginalPoseSideLandmarks(realLeft, realRight) {
  return {
    left: realLeft,
    right: realRight,
    sources: {
      screenLeftKnee: 'real left knee',
      screenLeftWrist: 'real left wrist',
      screenRightKnee: 'real right knee',
      screenRightWrist: 'real right wrist',
    },
  }
}

function isValidLandmark(point) {
  return Number.isFinite(point?.x) && Number.isFinite(point?.y)
}

function mediaPipeToAvatarLocal(point, fallbackX, fallbackY) {
  if (!point) {
    return new THREE.Vector3(fallbackX, fallbackY, 0)
  }

  return new THREE.Vector3(
    THREE.MathUtils.clamp((0.5 - point.x) * 1.75 * POSE_MIRROR_X, -0.85, 0.85),
    THREE.MathUtils.clamp((1.68 - point.y * 1.9) * POSE_MIRROR_Y, 0.05, 1.7),
    THREE.MathUtils.clamp((point.z ?? 0) * POSE_DEPTH_SCALE, -0.28, 0.28)
  )
}

function setLimb(mesh, start, end, smoothing) {
  const midpoint = start.clone().add(end).multiplyScalar(0.5)
  const direction = end.clone().sub(start)
  const length = Math.max(direction.length(), 0.001)
  const targetQuaternion = new THREE.Quaternion().setFromUnitVectors(
    new THREE.Vector3(0, 1, 0),
    direction.clone().normalize()
  )

  mesh.position.lerp(midpoint, smoothing)
  mesh.quaternion.slerp(targetQuaternion, smoothing)
  mesh.scale.set(1, length, 1)
}

function setKeyState(code, keys, value) {
  if (code === 'ArrowUp' || code === 'KeyW') {
    keys.forward = value
    return true
  }

  if (code === 'ArrowDown' || code === 'KeyS') {
    keys.bend = value
    return true
  }

  if (code === 'ArrowLeft' || code === 'KeyA') {
    keys.left = value
    return true
  }

  if (code === 'ArrowRight' || code === 'KeyD') {
    keys.right = value
    return true
  }

  if (code === 'KeyQ') {
    keys.turnLeft = value
    return true
  }

  if (code === 'KeyE') {
    keys.turnRight = value
    return true
  }

  if (code === 'KeyR') {
    keys.returnMain = value
    return true
  }

  return false
}

function createGableRoof(width, depth, height, color) {
  const group = new THREE.Group()
  const vertices = new Float32Array([
    -width / 2, 0, depth / 2,
    width / 2, 0, depth / 2,
    0, height, depth / 2,
    -width / 2, 0, -depth / 2,
    width / 2, 0, -depth / 2,
    0, height, -depth / 2,
  ])
  const indices = [
    0, 1, 2,
    3, 5, 4,
    0, 3, 4,
    0, 4, 1,
    1, 4, 5,
    1, 5, 2,
    2, 5, 3,
    2, 3, 0,
  ]
  const geometry = new THREE.BufferGeometry()

  geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3))
  geometry.setIndex(indices)
  geometry.computeVertexNormals()

  const roof = new THREE.Mesh(geometry, material(color))

  addOutlined(group, roof, 0.014)
  if (!PERFORMANCE_MODE) {
    addRoofStrokes(group, width, depth, height, color)
  }

  const ridge = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, depth * 1.08), material(0x38403f))

  ridge.position.y = height + 0.02
  addOutlined(group, ridge, 0.004)

  const chimneyPositions = PERFORMANCE_MODE ? [1] : [-1, 1]

  for (const i of chimneyPositions) {
    const chimney = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.42, 0.18), material(0xe9dfcf))

    chimney.position.set(i * width * 0.26, height + 0.14, -depth * 0.18)
    addOutlined(group, chimney, 0.005)
  }

  return group
}

function createDormerWindow() {
  const group = new THREE.Group()
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.36, 0.28), material(0x3f4647))
  const pane = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.23, 0.035), material(0xf8f1e5))
  const mullion = new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.23, 0.04), material(0xffffff))
  const roof = createGableRoof(0.34, 0.36, 0.18, 0x30383d)

  body.position.y = 0.12
  pane.position.set(0, 0.12, 0.16)
  mullion.position.set(0, 0.12, 0.18)
  roof.position.y = 0.3
  addOutlined(group, body, 0.004)
  addOutlined(group, pane, 0.003)
  group.add(mullion, roof)

  return group
}

function addRoofStrokes(group, width, depth, height, color) {
  const strokeMaterial = material(tintColor(color, 0xffffff, 0.18))

  for (let i = 0; i < 6; i += 1) {
    const leftStroke = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.018, depth * 0.92), strokeMaterial)
    const rightStroke = leftStroke.clone()
    const x = -width * 0.36 + i * width * 0.14

    leftStroke.position.set(x, height * 0.45 + Math.abs(x) * 0.18, 0)
    leftStroke.rotation.z = -0.58
    rightStroke.position.set(-x, height * 0.45 + Math.abs(x) * 0.18, 0)
    rightStroke.rotation.z = 0.58
    group.add(leftStroke, rightStroke)
  }
}

function addBrickLines(group, width, height, depth) {
  const brickMaterial = material(0x8d5a4d)

  for (let row = 0; row < Math.floor(height / 0.34); row += 1) {
    const line = new THREE.Mesh(new THREE.BoxGeometry(width * 0.86, 0.018, 0.025), brickMaterial)

    line.position.set(0, -height / 2 + 0.42 + row * 0.34, depth / 2 + 0.035)
    group.add(line)
  }

  for (let col = -2; col <= 2; col += 1) {
    const line = new THREE.Mesh(new THREE.BoxGeometry(0.018, height * 0.7, 0.025), brickMaterial)

    line.position.set((col * width) / 5, -0.05, depth / 2 + 0.038)
    group.add(line)
  }
}

function addFacadeTexture(group, width, height, depth, bodyColor, index) {
  const light = material(tintColor(bodyColor, 0xffffff, 0.24))
  const shadow = material(tintColor(bodyColor, 0x6f5d52, 0.16))

  for (let i = 0; i < 12; i += 1) {
    const stroke = new THREE.Mesh(
      new THREE.BoxGeometry(width * (0.16 + (i % 4) * 0.06), 0.018, 0.022),
      i % 3 === 0 ? shadow : light,
    )
    const x = -width * 0.34 + ((i * 37 + index * 11) % 68) / 100 * width
    const y = -height / 2 + 0.55 + ((i * 53 + index * 17) % 78) / 100 * (height - 0.9)

    stroke.position.set(x, y, depth / 2 + 0.036)
    stroke.rotation.z = ((i % 5) - 2) * 0.018
    group.add(stroke)
  }
}

function addPavingPattern(scene, width, length, x, z, y) {
  const stoneA = material(0xf4e8d6)
  const stoneB = material(0xd8c9b7)
  const seamMaterial = material(0xd5c2aa)
  const rows = PERFORMANCE_MODE ? 4 : 9
  const seamCount = PERFORMANCE_MODE ? 14 : 46
  const stoneCount = PERFORMANCE_MODE ? 8 : 34

  for (let row = 1; row < rows; row += 1) {
    const seam = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.014, length * 0.96), seamMaterial)

    seam.position.set(x - width / 2 + row * (width / rows), y + 0.002, z)
    scene.add(seam)
  }

  for (let i = 0; i < seamCount; i += 1) {
    const cross = new THREE.Mesh(new THREE.BoxGeometry(width * 0.9, 0.013, 0.028), seamMaterial)

    cross.position.set(x, y + 0.003, z + length / 2 - 1.6 - i * (PERFORMANCE_MODE ? 8.6 : 2.55))
    scene.add(cross)
  }

  for (let row = 0; row < rows; row += 1) {
    for (let i = 0; i < stoneCount; i += 1) {
      const stone = new THREE.Mesh(
        new THREE.BoxGeometry(0.58 + (i % 3) * 0.08, 0.012, 0.045),
        (i + row) % 4 === 0 ? stoneB : stoneA,
      )

      stone.position.set(
        x - width / 2 + 0.42 + row * (width / rows),
        y,
        z + length / 2 - 2.4 - i * (PERFORMANCE_MODE ? 16 : 4.3) - (row % 2) * 1.15,
      )
      scene.add(stone)
    }
  }
}

function createTree() {
  const group = new THREE.Group()
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.11, 1.25, 8), material(0x8f7058))
  const crownA = new THREE.Mesh(new THREE.SphereGeometry(0.48, 10, 8), material(0x8aa47a))
  const crownB = new THREE.Mesh(new THREE.SphereGeometry(0.34, 10, 8), material(0xa2b986))

  trunk.position.y = 0.62
  crownA.position.set(0, 1.38, 0)
  crownB.position.set(0.22, 1.2, 0.02)
  addOutlined(group, trunk, 0.009)
  addOutlined(group, crownA, 0.014)
  addOutlined(group, crownB, 0.014)
  group.userData.isTree = true

  return group
}

function createLamp() {
  const group = new THREE.Group()
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.045, 2.1, 8), material(0x3f4a49))
  const arm = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.045, 0.045), material(0x3f4a49))
  const cap = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.16, 10), material(0x4f8f83))
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.13, 12, 8), material(0xffedbd))

  pole.position.y = 1.05
  arm.position.set(0.23, 2.05, 0)
  cap.position.set(0.54, 1.98, 0)
  cap.rotation.x = Math.PI
  bulb.position.set(0.54, 1.88, 0)
  addOutlined(group, pole, 0.006)
  addOutlined(group, arm, 0.006)
  addOutlined(group, cap, 0.006)
  addOutlined(group, bulb, 0.006)

  return group
}

function createBench() {
  const group = new THREE.Group()
  const wood = material(0xb98062)
  const metal = material(0x58625f)
  const seat = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.12, 0.32), wood)
  const back = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.12, 0.08), wood)
  const legA = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.36, 0.08), metal)
  const legB = legA.clone()

  seat.position.y = 0.34
  back.position.set(0, 0.62, -0.18)
  legA.position.set(-0.34, 0.17, 0.08)
  legB.position.set(0.34, 0.17, 0.08)
  addOutlined(group, seat, 0.007)
  addOutlined(group, back, 0.007)
  addOutlined(group, legA, 0.005)
  addOutlined(group, legB, 0.005)

  return group
}

function createPlanter() {
  const group = new THREE.Group()
  const pot = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.26, 0.36), material(0xc58d70))
  const flowerCount = PERFORMANCE_MODE ? 2 : 5

  pot.position.y = 0.13
  addOutlined(group, pot, 0.006)
  for (let i = 0; i < flowerCount; i += 1) {
    const flower = new THREE.Mesh(
      new THREE.SphereGeometry(0.055, 8, 6),
      material(i % 2 === 0 ? 0xd996a5 : 0xe4ca73)
    )

    flower.position.set(-0.18 + i * 0.09, 0.31 + (i % 2) * 0.03, 0.02)
    addOutlined(group, flower, 0.003)
  }

  return group
}

function createParkedBike(index) {
  const group = new THREE.Group()
  const tire = material(0x26302f)
  const frameColor = [0xc65f52, 0x638f9c, 0xd7b962, 0x607d87][index % 4]
  const frame = material(frameColor)
  const metal = material(0x53605e)
  const wheelA = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.018, 8, 22), tire)
  const wheelB = wheelA.clone()
  const tubeA = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.035, 0.035), frame)
  const tubeB = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.035, 0.035), frame)
  const handle = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.035, 0.035), metal)
  const seat = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.045, 0.08), material(0x5a3f35))

  wheelA.position.set(-0.28, 0.22, 0)
  wheelB.position.set(0.28, 0.22, 0)
  tubeA.position.set(0, 0.35, 0)
  tubeA.rotation.z = -0.28
  tubeB.position.set(-0.02, 0.48, 0)
  tubeB.rotation.z = 0.36
  handle.position.set(0.42, 0.56, 0)
  handle.rotation.z = 0.35
  seat.position.set(-0.15, 0.58, 0)

  for (const mesh of [wheelA, wheelB, tubeA, tubeB, handle, seat]) {
    addOutlined(group, mesh, 0.005)
  }

  group.scale.setScalar(0.92)

  return group
}

function createBikeRack() {
  const group = new THREE.Group()
  const metal = material(0x566260)

  for (let i = 0; i < 3; i += 1) {
    const hoop = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.018, 8, 18, Math.PI), metal)

    hoop.position.set(-0.36 + i * 0.36, 0.28, 0)
    hoop.rotation.z = Math.PI
    addOutlined(group, hoop, 0.005)
  }

  return group
}

function createCafeSet(index) {
  const group = new THREE.Group()
  const table = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.045, 14), material(0xf8f0e2))
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.32, 8), material(0x53605e))
  const chairA = createCafeChair()
  const chairB = PERFORMANCE_MODE ? null : createCafeChair()
  const candle = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.08, 8), material(0xffedb7))

  table.position.y = 0.45
  stem.position.y = 0.25
  chairA.position.set(-0.35, 0.12, 0)
  if (chairB) {
    chairB.position.set(0.35, 0.12, 0)
    chairB.rotation.y = Math.PI
  }
  candle.position.set(0, 0.52, 0)
  addOutlined(group, table, 0.006)
  addOutlined(group, stem, 0.004)
  addOutlined(group, candle, 0.003)
  group.add(chairA)
  if (chairB) {
    group.add(chairB)
  }

  if (!PERFORMANCE_MODE && index % 2 === 0) {
    const umbrella = createCafeUmbrella()

    umbrella.position.set(0, 0.46, 0)
    group.add(umbrella)
  }

  return group
}

function createCafeBuildingFrontage(width, height, depth) {
  const group = new THREE.Group()
  const shopfront = new THREE.Mesh(new THREE.BoxGeometry(width * 0.92, 0.72, 0.075), material(0x3f3834))
  const warmWindow = new THREE.Mesh(new THREE.BoxGeometry(width * 0.34, 0.42, 0.09), material(0xf2d3a1))
  const door = new THREE.Mesh(new THREE.BoxGeometry(width * 0.24, 0.58, 0.1), material(0x4b5658))
  const sign = new THREE.Mesh(new THREE.BoxGeometry(width * 0.7, 0.22, 0.09), material(0x594238))
  const text = createPaintedText('KAFFE', 0xf8ead4, width * 0.62, 0.2)

  shopfront.position.set(0, -height / 2 + 0.42, depth / 2 + 0.085)
  warmWindow.position.set(-width * 0.18, -height / 2 + 0.42, depth / 2 + 0.14)
  door.position.set(width * 0.25, -height / 2 + 0.35, depth / 2 + 0.15)
  sign.position.set(0, -height / 2 + 0.96, depth / 2 + 0.14)
  text.position.set(0, -height / 2 + 0.96, depth / 2 + 0.2)
  addOutlined(group, shopfront, 0.005)
  addOutlined(group, warmWindow, 0.004)
  addOutlined(group, door, 0.004)
  addOutlined(group, sign, 0.004)
  group.add(text)

  return group
}

function createFlowerBuildingFrontage(width, height, depth) {
  const group = new THREE.Group()
  const shopfront = new THREE.Mesh(new THREE.BoxGeometry(width * 0.92, 0.66, 0.075), material(0xf6e8d2))
  const awning = new THREE.Mesh(new THREE.BoxGeometry(width * 0.96, 0.13, 0.34), material(0xc98c9e))
  const sign = new THREE.Mesh(new THREE.BoxGeometry(width * 0.78, 0.22, 0.09), material(0x7b8f74))
  const text = createPaintedText('BLOMSTER', 0xfff4df, width * 0.74, 0.18)

  shopfront.position.set(0, -height / 2 + 0.4, depth / 2 + 0.085)
  awning.position.set(0, -height / 2 + 0.78, depth / 2 + 0.17)
  sign.position.set(0, -height / 2 + 1.02, depth / 2 + 0.14)
  text.position.set(0, -height / 2 + 1.02, depth / 2 + 0.2)
  addOutlined(group, shopfront, 0.005)
  addOutlined(group, awning, 0.006)
  addOutlined(group, sign, 0.004)
  group.add(text)

  return group
}

function createCafeStreetMoment() {
  const group = new THREE.Group()
  const chalkboard = createChalkboard('kaffe')
  const umbrella = createCafeUmbrella()
  const planterA = createPlanter()
  const planterB = createPlanter()

  for (let i = 0; i < 3; i += 1) {
    const table = createCafeSet(i + 2)

    table.position.set(-0.45 + i * 0.45, 0, -0.35 - i * 0.32)
    table.scale.setScalar(0.86)
    group.add(table)
  }

  chalkboard.position.set(0.78, 0.02, -1.15)
  chalkboard.rotation.y = -0.28
  umbrella.position.set(-0.18, 0.22, -0.66)
  umbrella.scale.set(1.25, 1.15, 1.25)
  planterA.position.set(-0.95, 0.08, 0.22)
  planterB.position.set(0.95, 0.08, 0.12)
  group.add(chalkboard, umbrella, planterA, planterB)

  return group
}

function createFlowerShopStreetMoment() {
  const group = new THREE.Group()
  const display = new THREE.Mesh(new THREE.BoxGeometry(0.82, 0.13, 0.42), material(0xa8755d))
  const back = new THREE.Mesh(new THREE.BoxGeometry(0.82, 0.5, 0.08), material(0xb98062))
  const sign = createChalkboard('flowers')

  display.position.set(0, 0.25, -0.28)
  back.position.set(0, 0.48, -0.49)
  back.rotation.x = -0.12
  addOutlined(group, display, 0.005)
  addOutlined(group, back, 0.005)

  for (let i = 0; i < 7; i += 1) {
    const bucket = createFlowerBucket(i)

    bucket.position.set(-0.45 + i * 0.15, 0.09, -0.06 - (i % 2) * 0.22)
    group.add(bucket)
  }

  sign.position.set(0.72, 0.02, -0.78)
  sign.rotation.y = -0.26
  group.add(sign)

  return group
}

function createFlowerBucket(index) {
  const group = new THREE.Group()
  const bucket = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.065, 0.22, 10), material(0x7f8a86))
  const colors = [0xd996a5, 0xe4ca73, 0xf8f0e2, 0xb6a5c9]
  const bloomCount = PERFORMANCE_MODE ? 2 : 5

  bucket.position.y = 0.12
  addOutlined(group, bucket, 0.004)
  for (let i = 0; i < bloomCount; i += 1) {
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.22, 5), material(0x789675))
    const bloom = new THREE.Mesh(new THREE.SphereGeometry(0.04, 8, 6), material(colors[(index + i) % colors.length]))

    stem.position.set(-0.05 + i * 0.025, 0.27, -0.02 + (i % 2) * 0.035)
    stem.rotation.z = (-2 + i) * 0.12
    bloom.position.set(stem.position.x, 0.41 + (i % 2) * 0.03, stem.position.z)
    addOutlined(group, stem, 0.002)
    addOutlined(group, bloom, 0.002)
  }

  return group
}

function createChalkboard(kind) {
  const group = new THREE.Group()
  const board = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.54, 0.045), material(0x4c4f49))
  const legA = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.48, 0.035), material(0x8b6753))
  const legB = legA.clone()
  const text = createPaintedText(kind === 'flowers' ? 'fresh' : 'dagens', 0xf8ead4, 0.38, 0.18)

  board.position.y = 0.46
  legA.position.set(-0.16, 0.2, -0.02)
  legA.rotation.z = -0.12
  legB.position.set(0.16, 0.2, -0.02)
  legB.rotation.z = 0.12
  text.position.set(0, 0.5, 0.032)
  addOutlined(group, board, 0.004)
  addOutlined(group, legA, 0.003)
  addOutlined(group, legB, 0.003)
  group.add(text)

  return group
}

function createPostbox() {
  const group = new THREE.Group()
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.72, 0.28), material(0xb94f47))
  const slot = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.035, 0.035), material(0xf3dbc0))
  const cap = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.08, 0.32), material(0xa6433f))

  body.position.y = 0.4
  slot.position.set(0, 0.58, 0.16)
  cap.position.y = 0.78
  addOutlined(group, body, 0.006)
  addOutlined(group, slot, 0.003)
  addOutlined(group, cap, 0.004)

  return group
}

function createCafeChair() {
  const group = new THREE.Group()
  const wood = material(0xb98062)
  const seat = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.045, 0.18), wood)
  const back = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.18, 0.045), wood)

  seat.position.y = 0.2
  back.position.set(0, 0.32, -0.09)
  addOutlined(group, seat, 0.004)
  addOutlined(group, back, 0.004)

  return group
}

function createCafeUmbrella() {
  const group = new THREE.Group()
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.78, 8), material(0x53605e))
  const shade = new THREE.Mesh(new THREE.ConeGeometry(0.45, 0.22, 16), material(0xd28a7c))

  pole.position.y = 0.38
  shade.position.y = 0.8
  addOutlined(group, pole, 0.004)
  addOutlined(group, shade, 0.006)

  return group
}

function createCanalHint() {
  const group = new THREE.Group()
  const water = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.035, 118), material(0x91bdc9))
  const edge = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.16, 118), material(0xd6cbb9))

  water.position.set(0, 0, 0)
  edge.position.set(1.16, 0.08, 0)
  addOutlined(group, water, 0.006)
  addOutlined(group, edge, 0.006)

  for (let i = 0; i < 24; i += 1) {
    const railPost = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.5, 8), material(0x43504e))

    railPost.position.set(1.05, 0.38, 9 - i * 4.8)
    addOutlined(group, railPost, 0.004)
  }

  for (let i = 0; i < 2; i += 1) {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.04, 118), material(0x43504e))

    rail.position.set(1.05, 0.5 + i * 0.16, 0)
    addOutlined(group, rail, 0.004)
  }

  return group
}

function createFlowerBox() {
  const group = new THREE.Group()
  const box = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.11, 0.12), material(0xa8755d))
  const flowerCount = PERFORMANCE_MODE ? 2 : 4

  addOutlined(group, box, 0.005)
  for (let i = 0; i < flowerCount; i += 1) {
    const flower = new THREE.Mesh(new THREE.SphereGeometry(0.04, 8, 6), material(i % 2 === 0 ? 0xd996a5 : 0xe4ca73))

    flower.position.set(-0.15 + i * 0.1, 0.08, 0.02)
    addOutlined(group, flower, 0.003)
  }

  return group
}

function createCrosswalk() {
  const group = new THREE.Group()

  for (let i = -3; i <= 3; i += 1) {
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.03, 5.8), material(0xf7f5ed))

    stripe.position.set(i * 1.05, 0.055, 0)
    addOutlined(group, stripe, 0.004)
  }

  return group
}

function createDistantDome() {
  const group = new THREE.Group()
  const base = new THREE.Mesh(new THREE.BoxGeometry(2.6, 1.15, 0.5), material(0xeadfcf))
  const dome = new THREE.Mesh(new THREE.SphereGeometry(1.05, 28, 14, 0, Math.PI * 2, 0, Math.PI * 0.52), material(0x609f9b))
  const ribs = material(0xd9b466)
  const spire = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.82, 14), material(0xd9b466))

  base.position.y = 0.58
  dome.position.y = 1.16
  spire.position.y = 2.45
  addOutlined(group, base, 0.006)
  addOutlined(group, dome, 0.008)
  addOutlined(group, spire, 0.004)

  for (let i = -3; i <= 3; i += 1) {
    const rib = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.82, 0.035), ribs)

    rib.position.set(i * 0.25, 1.62 - Math.abs(i) * 0.07, 0.26)
    rib.rotation.z = i * -0.12
    group.add(rib)
  }

  group.scale.set(1.35, 1.35, 1.35)

  return group
}

function addAmbientDetails(scene) {
  const clouds = []
  const trees = []
  const cloudCount = PERFORMANCE_MODE ? 3 : 8

  for (let i = 0; i < cloudCount; i += 1) {
    const cloud = new THREE.Group()
    const puffCount = PERFORMANCE_MODE ? 2 : 4

    for (let puff = 0; puff < puffCount; puff += 1) {
      const mesh = new THREE.Mesh(new THREE.SphereGeometry(0.32 + puff * 0.025, 12, 8), material(0xfff4ea))

      mesh.position.set(puff * 0.32, Math.sin(puff) * 0.05, 0)
      addOutlined(cloud, mesh, 0.008)
    }

    cloud.position.set(-9 + i * 3, 5.7 + (i % 2) * 0.35, -18 - i * 9)
    cloud.scale.setScalar(1.05 + (i % 3) * 0.12)
    scene.add(cloud)
    clouds.push(cloud)
  }

  scene.traverse((child) => {
    if (child.userData.isTree) {
      trees.push(child)
    }
  })

  return { clouds, trees }
}

const textureCache = new Map()

function material(color) {
  return new THREE.MeshLambertMaterial({
    color,
    map: getPaintTexture(color),
  })
}

function addOutlined(parent, mesh, thickness) {
  const skipOutline = PERFORMANCE_MODE && thickness < 0.008

  mesh.castShadow = !PERFORMANCE_MODE || thickness >= 0.012
  mesh.receiveShadow = !PERFORMANCE_MODE || thickness >= 0.01
  parent.add(mesh)

  if (skipOutline) {
    return
  }

  const outline = mesh.clone()

  outline.material = new THREE.MeshBasicMaterial({
    color: 0x6b625a,
    opacity: 0.26,
    side: THREE.BackSide,
    transparent: true,
  })
  outline.scale.multiplyScalar(1 + thickness)
  outline.castShadow = false
  outline.receiveShadow = false
  parent.add(outline)
}

function getPaintTexture(color) {
  if (textureCache.has(color)) {
    return textureCache.get(color)
  }

  const canvas = document.createElement('canvas')
  const context = canvas.getContext('2d')

  canvas.width = 64
  canvas.height = 64
  if (!context) {
    return null
  }

  const base = new THREE.Color(color)

  context.fillStyle = `#${base.getHexString()}`
  context.fillRect(0, 0, canvas.width, canvas.height)
  for (let i = 0; i < 42; i += 1) {
    const mix = base.clone().lerp(new THREE.Color(i % 2 === 0 ? 0xffffff : 0x5f5148), i % 2 === 0 ? 0.12 : 0.08)
    const alpha = i % 2 === 0 ? 0.28 : 0.18

    context.strokeStyle = `rgba(${Math.round(mix.r * 255)}, ${Math.round(mix.g * 255)}, ${Math.round(mix.b * 255)}, ${alpha})`
    context.lineWidth = 1 + (i % 3)
    context.beginPath()
    context.moveTo((i * 19) % 64, -8 + ((i * 11) % 24))
    context.lineTo(-8 + ((i * 7) % 32), 72 - ((i * 13) % 20))
    context.stroke()
  }

  const texture = new THREE.CanvasTexture(canvas)

  texture.wrapS = THREE.RepeatWrapping
  texture.wrapT = THREE.RepeatWrapping
  texture.repeat.set(2, 2)
  texture.colorSpace = THREE.SRGBColorSpace
  textureCache.set(color, texture)

  return texture
}

function tintColor(color, target, amount) {
  return new THREE.Color(color).lerp(new THREE.Color(target), amount).getHex()
}
