// Main Three.js scene controller: owns street rendering, avatar updates, movement, pickup, and map data.
import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { BIKE_PARTS } from '../game/bikeParts'
import { partToMapMarker, playerToMapMarker } from '../game/mapMarkers'
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

const TURN_AROUND_COOLDOWN_SECONDS = 1.2
const ARM_TURN_DISTANCE_THRESHOLD = 0.12
const ARM_TURN_HOLD_SECONDS = 0.35
const ARM_TURN_COOLDOWN_SECONDS = 0.9
const BUILDING_OCCLUSION_MODE = 'hide'
const BUILDING_OCCLUSION_OPACITY = 0.08
const PERFORMANCE_MODE = true
const PERFORMANCE_STREET_DETAIL_Z = -STREET_REPEAT + 4
const VISUAL_ROAD_WIDTH = 5.6
const VISUAL_SIDEWALK_WIDTH = 1.55
const VISUAL_CURB_X = VISUAL_ROAD_WIDTH / 2 + 0.08
const VISUAL_SIDEWALK_X = VISUAL_ROAD_WIDTH / 2 + VISUAL_SIDEWALK_WIDTH / 2
const VISUAL_BUILDING_FACE_X = VISUAL_ROAD_WIDTH / 2 + VISUAL_SIDEWALK_WIDTH + 0.22
const VISUAL_PROP_X = VISUAL_ROAD_WIDTH / 2 + 0.72
const STREET_BOUNDARY_EPSILON = 0.001
const MAIN_STREET_BOUNDS = {
  maxLateral: 3.65,
  minLateral: -3.65,
}
const LEFT_STREET_BOUNDS = {
  maxLateral: 3.55,
  minLateral: -3.55,
}
const INTERSECTION_BOUNDS = {
  maxMainLateral: MAIN_STREET_BOUNDS.maxLateral,
  minMainLateral: -6.05,
  maxWorldZ: LEFT_STREET_ENTRANCE_Z + 3.65,
  minWorldZ: LEFT_STREET_ENTRANCE_Z - 3.65,
}
const POSTCARD_PALETTE = [
  0x819fca,
  0xedc36a,
  0xc9654f,
  0x87a77e,
  0xf0dfc6,
  0xe2ad84,
  0xb3c0cf,
  0xe6b9be,
  0xf2d28b,
]
const ROOF_PALETTE = [0x263445, 0x553d36, 0x744032, 0x314748]
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
export function ThreeStreetScene({
  completionPhase = 'idle',
  guideStep = 'hidden',
  isMapOpen = false,
  onMapData,
  onPickupDebug,
  onRecalibrateBodyLean,
  onWorldDebug,
  resetRunKey = 0,
  tracking,
}) {
  const completionPhaseRef = useRef(completionPhase)
  const guideStepRef = useRef(guideStep)
  const isMapOpenRef = useRef(isMapOpen)
  const mountRef = useRef(null)
  const resetRunKeyRef = useRef(resetRunKey)
  const trackingRef = useRef(tracking)
  const onMapDataRef = useRef(onMapData)
  const onPickupDebugRef = useRef(onPickupDebug)
  const onRecalibrateBodyLeanRef = useRef(onRecalibrateBodyLean)
  const onWorldDebugRef = useRef(onWorldDebug)

  useEffect(() => {
    completionPhaseRef.current = completionPhase
  }, [completionPhase])

  useEffect(() => {
    isMapOpenRef.current = isMapOpen
  }, [isMapOpen])

  useEffect(() => {
    guideStepRef.current = guideStep
  }, [guideStep])

  useEffect(() => {
    resetRunKeyRef.current = resetRunKey
  }, [resetRunKey])

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
    onRecalibrateBodyLeanRef.current = onRecalibrateBodyLean
  }, [onRecalibrateBodyLean])

  useEffect(() => {
    onWorldDebugRef.current = onWorldDebug
  }, [onWorldDebug])

  useEffect(() => {
    const mount = mountRef.current

    if (!mount) {
      return undefined
    }

    const scene = new THREE.Scene()
    scene.background = createPaperSkyTexture()
    scene.fog = new THREE.Fog(0xf5dcca, 38, 112)

    const camera = new THREE.PerspectiveCamera(54, 16 / 9, 0.1, 160)
    camera.position.set(0, 1.55, 8.8)
    camera.lookAt(0, 1.18, -22)

    const renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.outputColorSpace = THREE.SRGBColorSpace
    renderer.shadowMap.enabled = !PERFORMANCE_MODE
    renderer.shadowMap.type = THREE.PCFSoftShadowMap
    mount.appendChild(renderer.domElement)

    const ambient = new THREE.HemisphereLight(0xfff4e8, 0xd8c4ac, 3.05)
    scene.add(ambient)

    const sun = new THREE.DirectionalLight(0xffddb2, 1.7)
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
    const ghostGuide = createGhostGuide()
    const avatarInstruction = createAvatarInstructionDisplay()
    const completionDisplay = createCompletionDisplay()
    scene.add(avatarInstruction.group)
    scene.add(completionDisplay.group)
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
      leftArmExtendedSince: null,
      leftArmDistance: 0,
      leftArmExtendedRaw: false,
      leftHoldMs: 0,
      leftArmOut: false,
      leftShoulderX: 0.5,
      leftWristMinusShoulder: 0,
      leftWristDeltaX: 0,
      leftWristHistory: [],
      lastTurnGesture: 'none',
      lastTurnGestureUntil: 0,
      rawLeftWristX: 0.5,
      playerWorldX: 0,
      playerWorldZ: 0,
      rightArmExtendedSince: null,
      rightArmDistance: 0,
      rightArmExtendedRaw: false,
      rightHoldMs: 0,
      rightArmOut: false,
      rightShoulderX: 0.5,
      rightWristMinusShoulder: 0,
      rightWristDeltaX: 0,
      rightWristHistory: [],
      rawRightWristX: 0.5,
      swipeLeftDetected: false,
      swipeRightDetected: false,
      targetHeading: MAIN_STREET_HEADING,
      transitionLabel: '',
      transitionLabelUntil: 0,
      turnHint: '',
      turnSource: 'none',
      armsCrossed: false,
      armsCrossedDisabled: true,
      lastTurnAroundTrigger: 'none',
      lastTurnAroundTriggerUntil: 0,
      turnAroundCooldownMs: 0,
      turnAroundCooldownUntil: 0,
      keyboardActive: false,
      keyboardForward: 0,
      keyboardMovementValue: 0,
      keyboardSide: 0,
      keyboardVx: 0,
      keyboardVz: 0,
      headingAfter: MAIN_STREET_HEADING,
      headingBefore: MAIN_STREET_HEADING,
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
    const completionState = {
      activeKey: '',
      animationStartAt: 0,
      lastResetKey: resetRunKeyRef.current,
    }
    const occlusionState = {
      active: new Set(),
      debug: {
        cameraInsideBuilding: false,
        fadedCount: 0,
        fadedIds: [],
        mode: BUILDING_OCCLUSION_MODE,
      },
      raycaster: new THREE.Raycaster(),
      targets: [],
    }
    scene.add(avatar)
    scene.add(ghostGuide)
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
      turnAround: false,
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
      if (completionState.lastResetKey !== resetRunKeyRef.current) {
        resetRunScene(bikeParts, completionDisplay, avatarMotion, pickupState, keys)
        completionState.lastResetKey = resetRunKeyRef.current
      }
      const completionPhase = completionPhaseRef.current
      const completionLocksGameplay = isCompletionLockingGameplay(completionPhase)

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
      if (completionLocksGameplay) {
        stopAvatarMotion(avatarMotion, keys)
      }
      updateAvatar(avatar, avatarMotion, completionLocksGameplay ? null : trackingRef.current, elapsed, keys)
      updateCompletionAvatarPose(avatar, completionPhase, completionState, elapsed)
      perfState.avgAvatarMs = smoothMetric(perfState.avgAvatarMs, performance.now() - avatarStartedAt)
      const headingStartedAt = performance.now()
      if (!completionLocksGameplay) {
        updateHeadingAndArea(
          avatarMotion,
          bikeParts,
          pickupState,
          keys,
          trackingRef.current,
          elapsed,
          onRecalibrateBodyLeanRef.current
        )
      }
      perfState.avgHeadingMs = smoothMetric(perfState.avgHeadingMs, performance.now() - headingStartedAt)
      const worldStartedAt = performance.now()
      updateWorldScroll(world, avatarMotion)
      if (completionLocksGameplay) {
        updateCompletionCamera(camera, avatar, avatarMotion)
      } else {
        updateCameraFollow(camera, avatar, avatarMotion)
      }
      updateCameraOcclusionFading(scene, camera, avatar, occlusionState)
      updateGuideScene(
        ghostGuide,
        avatarMotion,
        guideStepRef.current,
        elapsed,
      )
      updateCompletionDisplay(completionDisplay, avatar, avatarMotion, completionPhase, completionState, elapsed)
      perfState.avgWorldMs = smoothMetric(perfState.avgWorldMs, performance.now() - worldStartedAt)
      const pickupStartedAt = performance.now()
      if (!completionLocksGameplay) {
        updateBikeParts(bikeParts, avatarMotion, avatar, trackingRef.current, keys, pickupState, onPickupDebugRef.current, elapsed)
      } else {
        pickupState.nearbyPartId = null
        pickupState.feedback = ''
        publishPickupDebug(pickupState, onPickupDebugRef.current, false, null, bikeParts.parts, elapsed, true)
      }
      updateAvatarInstructionDisplay(
        avatarInstruction,
        avatar,
        ghostGuide,
        avatarMotion,
        pickupState,
        trackingRef.current,
        isMapOpenRef.current,
        guideStepRef.current,
        completionPhase,
      )
      updateBackpackGlow(avatar, elapsed)
      perfState.avgPickupMs = smoothMetric(perfState.avgPickupMs, performance.now() - pickupStartedAt)
      const mapDebugStartedAt = performance.now()
      publishMapData(avatarMotion, bikeParts.parts, onMapDataRef.current, elapsed)
      publishWorldDebug(avatarMotion, onWorldDebugRef.current, elapsed, scene, renderer, perfState, trackingRef.current, occlusionState)
      perfState.avgMapDebugMs = smoothMetric(perfState.avgMapDebugMs, performance.now() - mapDebugStartedAt)
      const renderStartedAt = performance.now()
      renderer.render(scene, camera)
      perfState.avgRenderMs = smoothMetric(perfState.avgRenderMs, performance.now() - renderStartedAt)
      perfState.drawCalls = renderer.info.render.calls
      frameId = requestAnimationFrame(animate)
    }

    function handleKeyDown(event) {
      if (event.code === 'KeyC' && !event.repeat) {
        onRecalibrateBodyLeanRef.current?.()
        event.preventDefault()
        return
      }

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
    paperMaterial(0xead8bd, { repeatX: 3, repeatY: 24 })
  )
  road.position.set(0, -0.04, STREET_CENTER_Z)
  road.receiveShadow = true
  addOutlined(scene, road, 0.012)
  addPavingPattern(scene, VISUAL_ROAD_WIDTH * 0.94, STREET_LENGTH, 0, STREET_CENTER_Z, 0.018)

  for (const side of [-1, 1]) {
    const bikeLane = new THREE.Mesh(
      new THREE.BoxGeometry(0.46, 0.025, STREET_LENGTH),
      paperMaterial(0xd8c1a7, { repeatX: 1, repeatY: 22 })
    )
    const innerTrack = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.03, STREET_LENGTH), material(0xc8b08f))
    const outerTrack = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.032, STREET_LENGTH), material(0xf5e5c9))

    bikeLane.position.set(side * (VISUAL_ROAD_WIDTH / 2 - 0.42), 0.025, STREET_CENTER_Z)
    innerTrack.position.set(side * (VISUAL_ROAD_WIDTH / 2 - 0.92), 0.034, STREET_CENTER_Z)
    outerTrack.position.set(side * (VISUAL_ROAD_WIDTH / 2 - 0.12), 0.036, STREET_CENTER_Z)
    addOutlined(scene, bikeLane, 0.006)
    addOutlined(scene, innerTrack, 0.003)
    addOutlined(scene, outerTrack, 0.003)
  }

  const laneMaterial = material(0xf2e5cf)
  for (let i = 0; i < 18; i += 1) {
    const line = new THREE.Mesh(new THREE.BoxGeometry(0.052, 0.025, 0.52), laneMaterial)

    line.position.set(0, 0.025, 6.8 - i * 7.2)
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
    paperMaterial(0xe9d7bd, { repeatX: 2.7, repeatY: 24 })
  )

  road.position.set(0, -0.04, sideStreetCenterZ)
  road.receiveShadow = true
  addOutlined(scene, road, 0.012)
  addPavingPattern(scene, sideRoadWidth * 0.9, STREET_LENGTH, 0, sideStreetCenterZ, 0.018)

  for (const side of [-1, 1]) {
    const sidewalk = new THREE.Mesh(new THREE.BoxGeometry(2.15, 0.14, STREET_LENGTH), paperMaterial(0xf0e5d2, { repeatX: 1.2, repeatY: 20 }))
    const curb = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.18, STREET_LENGTH), paperMaterial(0xd6c8b5, { repeatX: 0.5, repeatY: 20 }))

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
    paperMaterial(0xf0e5d2, { repeatX: 1.2, repeatY: 22 })
  )
  sidewalk.position.set(side * VISUAL_SIDEWALK_X, 0.02, STREET_CENTER_Z)
  sidewalk.receiveShadow = true
  addOutlined(scene, sidewalk, 0.01)

  const curb = new THREE.Mesh(
    new THREE.BoxGeometry(0.18, 0.18, STREET_LENGTH),
    paperMaterial(0xd5c7b4, { repeatX: 0.5, repeatY: 22 })
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
  const isNearBuilding = !PERFORMANCE_MODE || index < 10 || Boolean(shopKind)
  const bodyColor = shopKind === 'cafe'
    ? 0x89a6ca
    : shopKind === 'flowers'
      ? 0xf0c56d
      : POSTCARD_PALETTE[index % POSTCARD_PALETTE.length]
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(width, height, depth),
    paperMaterial(bodyColor, { repeatX: 1.2, repeatY: Math.max(1.4, height / 1.8) })
  )

  body.castShadow = !PERFORMANCE_MODE || index < 8
  body.receiveShadow = true
  addOutlined(group, body, 0.018)

  const roofColor = shopKind === 'cafe' ? 0x523b32 : ROOF_PALETTE[index % ROOF_PALETTE.length]
  const hasGable = shopKind || index % 4 === 0
  const roof = hasGable
    ? createGableRoof(width * 1.18, depth * 1.08, 0.68 + (index % 4) * 0.08, roofColor)
    : createMansardRoof(width * 1.16, depth * 1.08, 0.58 + (index % 3) * 0.06, roofColor)

  roof.position.y = height / 2 + 0.02
  roof.castShadow = !PERFORMANCE_MODE || index < 8
  group.add(roof)

  const endFacade = createPaintedBuildingFacade({
    bodyColor,
    height,
    index,
    isEndFacade: true,
    shopKind,
    width,
  })

  endFacade.position.z = depth / 2 + 0.036
  endFacade.scale.x = 0.92
  group.add(endFacade)

  // Main Street and Left Street buildings receive their visible painted-paper
  // facade card here; the box remains only the lightweight cardboard volume.
  group.add(createStreetFacingFacade({ bodyColor, depth, height, index, shopKind, side, width }))

  if (isNearBuilding && shopKind) {
    const box = createFlowerBox()

    box.position.set(0, -height / 2 + 1.28, depth / 2 + 0.085)
    group.add(box)
  }

  markCameraOccluder(group, `building-${shopKind || 'row'}-${index}-${side}`)

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

function createGhostGuide() {
  const group = new THREE.Group()
  const ghostMaterial = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    opacity: 0.68,
    transparent: true,
  })
  const accentMaterial = new THREE.MeshBasicMaterial({
    color: 0xd8fff7,
    opacity: 0.78,
    transparent: true,
  })

  group.userData.parts = {
    head: new THREE.Mesh(new THREE.SphereGeometry(0.15, 18, 12), ghostMaterial),
    torso: createAvatarLimb(0.08, ghostMaterial),
    leftUpperArm: createAvatarLimb(0.032, accentMaterial),
    leftLowerArm: createAvatarLimb(0.028, accentMaterial),
    rightUpperArm: createAvatarLimb(0.032, accentMaterial),
    rightLowerArm: createAvatarLimb(0.028, accentMaterial),
    leftHand: new THREE.Mesh(new THREE.SphereGeometry(0.042, 12, 8), accentMaterial),
    rightHand: new THREE.Mesh(new THREE.SphereGeometry(0.042, 12, 8), accentMaterial),
    leftLeg: createAvatarLimb(0.035, ghostMaterial),
    rightLeg: createAvatarLimb(0.035, ghostMaterial),
  }

  for (const part of Object.values(group.userData.parts)) {
    group.add(part)
  }

  group.scale.setScalar(1.2)
  group.visible = false

  return group
}

function createAvatarInstructionDisplay() {
  const group = new THREE.Group()
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
    depthTest: false,
    opacity: 0,
    transparent: true,
  }))

  sprite.renderOrder = 20
  sprite.scale.set(7.6, 2.08, 1)
  group.add(sprite)
  group.visible = false

  return {
    group,
    lastText: '',
    sprite,
  }
}

function updateAvatarInstructionDisplay(
  display,
  avatar,
  ghostGuide,
  motionState,
  pickupState,
  tracking,
  isMapOpen,
  guideStep,
  completionPhase,
) {
  if (!display?.sprite || completionPhase === 'postcard') {
    if (display?.group) {
      display.group.visible = false
    }
    return
  }

  const feedback = getAvatarInstructionFeedback({
    guideStep,
    isMapOpen,
    motionState,
    pickupState,
    tracking,
  })
  if (!feedback) {
    display.group.visible = false
    display.sprite.material.opacity += (0 - display.sprite.material.opacity) * 0.22
    return
  }

  const textKey = `${feedback.action}|${feedback.instruction}`
  const target = guideStep && guideStep !== 'hidden' && ghostGuide?.visible ? ghostGuide : avatar

  display.group.visible = true
  display.group.position.copy(target.position).add(new THREE.Vector3(0, 2.72, 0))
  display.sprite.material.opacity += (0.96 - display.sprite.material.opacity) * 0.18
  if (display.lastText === textKey) {
    return
  }

  display.lastText = textKey
  display.sprite.material.map?.dispose()
  display.sprite.material.map = createInstructionBubbleTexture(feedback.instruction)
  display.sprite.material.needsUpdate = true
}

function getAvatarInstructionFeedback({ guideStep }) {
  return getGuideInstructionFeedback(guideStep)
}

function getGuideInstructionFeedback(guideStep) {
  if (guideStep === 'walk') {
    return {
      action: 'Guide',
      instruction: 'MOVE ARMS + LEGS TO WALK',
    }
  }

  if (guideStep === 'left') {
    return {
      action: 'Guide',
      instruction: 'MOVE BODY LEFT',
    }
  }

  if (guideStep === 'right') {
    return {
      action: 'Guide',
      instruction: 'MOVE BODY RIGHT',
    }
  }

  if (guideStep === 'pickup') {
    return {
      action: 'Guide',
      instruction: 'BEND DOWN TO PICK UP',
    }
  }

  if (guideStep === 'map') {
    return {
      action: 'Guide',
      instruction: 'RAISE BOTH HANDS FOR MAP',
    }
  }

  if (guideStep === 'turn') {
    return {
      action: 'Guide',
      instruction: 'STRETCH ARM TO TURN\nLEFT ARM = LEFT, RIGHT ARM = RIGHT',
    }
  }

  return null
}

function createInstructionBubbleTexture(instruction) {
  const canvas = document.createElement('canvas')
  const context = canvas.getContext('2d')

  canvas.width = 1800
  canvas.height = 560
  if (!context) {
    return null
  }

  context.clearRect(0, 0, canvas.width, canvas.height)
  context.textAlign = 'center'
  context.textBaseline = 'middle'

  const lines = instruction.split('\n')
  const maxTextWidth = canvas.width - 320
  const primarySize = lines.length > 1 ? 124 : 148
  const secondarySize = 84
  const startY = lines.length > 1 ? 214 : 280
  const lineGap = lines.length > 1 ? 136 : 0

  context.shadowColor = 'rgba(43, 35, 27, 0.5)'
  context.shadowBlur = 18
  context.shadowOffsetY = 6

  lines.forEach((line, index) => {
    const baseFontSize = index === 0 ? primarySize : secondarySize
    const fontSize = getFittedInstructionFontSize(context, line, baseFontSize, maxTextWidth)
    const y = startY + index * lineGap

    context.font = getInstructionFont(fontSize)
    context.fillStyle = index === 0 ? '#fff6dc' : '#fffaf0'
    context.fillText(line, canvas.width / 2, y)
  })

  const texture = new THREE.CanvasTexture(canvas)

  texture.colorSpace = THREE.SRGBColorSpace
  return texture
}

function getFittedInstructionFontSize(context, text, fontSize, maxWidth) {
  let nextSize = fontSize

  while (nextSize > 52) {
    context.font = getInstructionFont(nextSize)
    if (context.measureText(text).width <= maxWidth) {
      return nextSize
    }
    nextSize -= 4
  }

  return nextSize
}

function getInstructionFont(fontSize) {
  return `400 ${fontSize}px "Patrick Hand", ui-sans-serif, system-ui, sans-serif`
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
      originalAreaId: definition.areaId ?? 'mainStreet',
      originalX: definition.x,
      originalZ: definition.z,
    }
  })

  return { group, parts, pickupAnimations: [] }
}

function createCompletionDisplay() {
  const group = new THREE.Group()
  const sparkleGroup = new THREE.Group()
  const assemblyParts = [
    createAssemblyPart('frame', createFramePart(), new THREE.Vector3(0, 0.78, 0)),
    createAssemblyPart('rearWheel', createWheelPart(), new THREE.Vector3(-0.64, 0.36, 0)),
    createAssemblyPart('frontWheel', createWheelPart(), new THREE.Vector3(0.68, 0.36, 0)),
    createAssemblyPart('handlebar', createHandlebarPart(), new THREE.Vector3(0.9, 0.92, 0)),
    createAssemblyPart('saddle', createSaddlePart(), new THREE.Vector3(-0.16, 0.98, 0)),
  ]

  for (const part of assemblyParts) {
    part.mesh.visible = false
    group.add(part.mesh)
  }

  for (let index = 0; index < 10; index += 1) {
    const sparkle = new THREE.Mesh(
      new THREE.SphereGeometry(0.025 + (index % 3) * 0.008, 8, 6),
      new THREE.MeshBasicMaterial({ color: index % 2 === 0 ? 0xffedb7 : 0xffffff }),
    )

    sparkle.userData.angle = index * 0.72
    sparkle.userData.radius = 0.52 + (index % 4) * 0.12
    sparkleGroup.add(sparkle)
  }

  group.add(sparkleGroup)
  group.visible = false
  group.scale.setScalar(1.28)

  return {
    assemblyParts,
    group,
    sparkleGroup,
  }
}

function createAssemblyPart(id, mesh, target) {
  return {
    id,
    mesh,
    target,
  }
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

function createIllustratedBikePart(kind, width, height) {
  const group = new THREE.Group()
  const canvas = document.createElement('canvas')
  const context = canvas.getContext('2d')

  canvas.width = 384
  canvas.height = 384
  if (!context) {
    const fallback = new THREE.Mesh(new THREE.PlaneGeometry(width, height), paperMaterial(0xfff3dc))

    group.add(fallback)
    return group
  }

  drawBikePartCutout(context, canvas, kind)

  const texture = new THREE.CanvasTexture(canvas)

  texture.colorSpace = THREE.SRGBColorSpace
  texture.anisotropy = 2

  const card = new THREE.Mesh(
    new THREE.PlaneGeometry(width, height),
    new THREE.MeshLambertMaterial({
      map: texture,
      side: THREE.DoubleSide,
      transparent: true,
    })
  )

  card.renderOrder = 4
  group.add(card)

  return group
}

function drawBikePartCutout(context, canvas, kind) {
  const w = canvas.width
  const h = canvas.height

  context.clearRect(0, 0, w, h)
  drawPartPaperBacking(context, w, h, kind)
  drawPartPaperGrain(context, w, h)

  if (kind === 'wheel') {
    drawWheelIllustration(context, w, h)
  } else if (kind === 'handlebar') {
    drawHandlebarIllustration(context)
  } else if (kind === 'frame') {
    drawFrameIllustration(context)
  } else {
    drawSaddleIllustration(context)
  }
}

function drawPartPaperBacking(context, width, height, kind) {
  context.save()
  context.fillStyle = 'rgba(255, 242, 214, 0.96)'
  context.strokeStyle = 'rgba(41, 37, 32, 0.34)'
  context.lineWidth = 7

  if (kind === 'wheel') {
    context.beginPath()
    context.ellipse(width / 2, height / 2, 150, 150, 0, 0, Math.PI * 2)
    context.fill()
    context.stroke()
  } else {
    drawRoundedCanvasRect(context, 42, 74, width - 84, height - 148, 34)
    context.fill()
    context.stroke()
  }

  context.restore()
}

function drawPartPaperGrain(context, width, height) {
  for (let i = 0; i < 90; i += 1) {
    context.strokeStyle = i % 2 === 0
      ? 'rgba(255, 255, 255, 0.18)'
      : 'rgba(101, 79, 65, 0.11)'
    context.lineWidth = 1 + (i % 4)
    context.beginPath()
    context.moveTo((i * 47) % width, (i * 31) % height)
    context.lineTo(((i * 47) % width) + 36 + (i % 5) * 14, ((i * 31) % height) + ((i % 7) - 3) * 5)
    context.stroke()
  }
}

function drawWheelIllustration(context, width, height) {
  const cx = width / 2
  const cy = height / 2

  context.save()
  context.lineCap = 'round'
  context.lineJoin = 'round'
  context.strokeStyle = '#26302f'
  context.lineWidth = 22
  context.beginPath()
  context.ellipse(cx, cy, 108, 108, 0, 0, Math.PI * 2)
  context.stroke()
  context.strokeStyle = 'rgba(255, 248, 229, 0.84)'
  context.lineWidth = 8
  context.beginPath()
  context.ellipse(cx, cy, 79, 79, 0, 0, Math.PI * 2)
  context.stroke()

  for (let i = 0; i < 12; i += 1) {
    const angle = (Math.PI * 2 * i) / 12

    context.strokeStyle = i % 2 === 0 ? 'rgba(77, 91, 89, 0.68)' : 'rgba(248, 240, 226, 0.86)'
    context.lineWidth = 4
    context.beginPath()
    context.moveTo(cx, cy)
    context.lineTo(cx + Math.cos(angle) * 94, cy + Math.sin(angle) * 94)
    context.stroke()
  }

  context.fillStyle = '#d8bd6d'
  context.strokeStyle = '#26302f'
  context.lineWidth = 5
  context.beginPath()
  context.ellipse(cx, cy, 18, 18, 0, 0, Math.PI * 2)
  context.fill()
  context.stroke()
  context.restore()
}

function drawHandlebarIllustration(context) {
  context.save()
  context.lineCap = 'round'
  context.lineJoin = 'round'
  context.strokeStyle = '#26302f'
  context.lineWidth = 11
  context.beginPath()
  context.moveTo(86, 172)
  context.bezierCurveTo(126, 126, 258, 126, 298, 172)
  context.stroke()
  context.strokeStyle = '#53605e'
  context.lineWidth = 8
  context.beginPath()
  context.moveTo(88, 170)
  context.bezierCurveTo(128, 132, 256, 132, 296, 170)
  context.stroke()
  context.beginPath()
  context.moveTo(192, 168)
  context.lineTo(192, 258)
  context.stroke()
  context.strokeStyle = '#d79a6f'
  context.lineWidth = 18
  context.beginPath()
  context.moveTo(70, 178)
  context.lineTo(112, 156)
  context.moveTo(314, 178)
  context.lineTo(272, 156)
  context.stroke()
  context.restore()
}

function drawFrameIllustration(context) {
  context.save()
  context.lineCap = 'round'
  context.lineJoin = 'round'

  const points = [
    [78, 246, 184, 116],
    [184, 116, 306, 246],
    [306, 246, 78, 246],
    [184, 116, 188, 246],
    [188, 246, 260, 168],
    [184, 116, 148, 86],
  ]

  for (const [x1, y1, x2, y2] of points) {
    context.strokeStyle = '#26302f'
    context.lineWidth = 18
    context.beginPath()
    context.moveTo(x1, y1)
    context.lineTo(x2, y2)
    context.stroke()
    context.strokeStyle = '#6f8faa'
    context.lineWidth = 11
    context.beginPath()
    context.moveTo(x1, y1)
    context.lineTo(x2, y2)
    context.stroke()
  }

  context.fillStyle = '#d8bd6d'
  context.strokeStyle = '#26302f'
  context.lineWidth = 5
  for (const [x, y] of [[78, 246], [184, 116], [306, 246], [188, 246]]) {
    context.beginPath()
    context.ellipse(x, y, 10, 10, 0, 0, Math.PI * 2)
    context.fill()
    context.stroke()
  }
  context.restore()
}

function drawSaddleIllustration(context) {
  context.save()
  context.lineCap = 'round'
  context.lineJoin = 'round'
  context.strokeStyle = '#26302f'
  context.lineWidth = 9
  context.fillStyle = '#5a3f35'
  context.beginPath()
  context.moveTo(96, 168)
  context.bezierCurveTo(132, 116, 248, 116, 292, 160)
  context.bezierCurveTo(260, 194, 152, 204, 96, 168)
  context.closePath()
  context.fill()
  context.stroke()
  context.strokeStyle = '#53605e'
  context.lineWidth = 12
  context.beginPath()
  context.moveTo(190, 188)
  context.lineTo(190, 270)
  context.stroke()
  context.strokeStyle = 'rgba(255, 238, 210, 0.32)'
  context.lineWidth = 5
  context.beginPath()
  context.moveTo(132, 158)
  context.bezierCurveTo(164, 140, 226, 138, 260, 154)
  context.stroke()
  context.restore()
}

function drawRoundedCanvasRect(context, x, y, width, height, radius) {
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

function createWheelPart() {
  return createIllustratedBikePart('wheel', 0.96, 0.96)
}

function createHandlebarPart() {
  const group = createIllustratedBikePart('handlebar', 1.08, 0.72)

  group.rotation.z = -0.08

  return group
}

function createFramePart() {
  return createIllustratedBikePart('frame', 1.16, 0.92)
}

function createSaddlePart() {
  return createIllustratedBikePart('saddle', 0.86, 0.62)
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

function createPaintedBuildingFacade({ bodyColor, height, index, isEndFacade = false, shopKind, width }) {
  const canvas = document.createElement('canvas')
  const context = canvas.getContext('2d')

  canvas.width = 512
  canvas.height = 768
  if (!context) {
    return new THREE.Mesh(new THREE.PlaneGeometry(width, height), material(bodyColor))
  }

  paintFacadeCanvas(context, canvas, {
    bodyColor,
    facadeWidth: width,
    floors: Math.max(3, Math.floor(height / 0.72)),
    index,
    isEndFacade,
    shopKind,
  })

  const texture = new THREE.CanvasTexture(canvas)

  texture.colorSpace = THREE.SRGBColorSpace
  texture.anisotropy = 2

  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(width * 0.98, height * 0.98),
    new THREE.MeshLambertMaterial({
      map: texture,
      side: THREE.DoubleSide,
      transparent: true,
    })
  )

  mesh.position.y = 0
  mesh.renderOrder = 2

  return mesh
}

function paintFacadeCanvas(context, canvas, { bodyColor, facadeWidth, floors, index, isEndFacade, shopKind }) {
  const base = new THREE.Color(bodyColor)
  const w = canvas.width
  const h = canvas.height
  const shopHeight = shopKind ? 176 : 146
  const marginX = isEndFacade ? 62 : 44
  const topMargin = 76
  const windowColumns = getFacadeColumnCount(facadeWidth, isEndFacade, index)
  const rows = getFacadeRowCount(floors, isEndFacade, shopKind)

  context.clearRect(0, 0, w, h)
  context.fillStyle = `#${base.getHexString()}`
  context.fillRect(0, 0, w, h)
  paintPaperNoise(context, w, h, base, 150)
  paintGouacheWashes(context, w, h, base, index)
  paintRoofShadow(context, w, index)
  paintFacadeRoofDetails(context, w, index, isEndFacade)

  context.strokeStyle = 'rgba(42, 38, 35, 0.44)'
  context.lineWidth = 4
  sketchRect(context, 10, 12, w - 20, h - 24, 2, index)

  for (let i = 0; i < 30; i += 1) {
    const y = 36 + ((i * 79 + index * 31) % (h - 140))
    const x = 24 + ((i * 53 + index * 17) % (w - 100))
    const length = 34 + (i % 4) * 22

    context.strokeStyle = i % 2 === 0
      ? 'rgba(255, 247, 231, 0.26)'
      : 'rgba(80, 61, 53, 0.14)'
    context.lineWidth = 3 + (i % 3)
    context.beginPath()
    context.moveTo(x, y)
    context.lineTo(x + length, y + ((i % 5) - 2) * 2)
    context.stroke()
  }

  const drawableHeight = h - shopHeight - topMargin - 30
  const rowGap = drawableHeight / rows
  const colGap = (w - marginX * 2) / windowColumns
  const windowWidth = Math.min(58, Math.max(40, colGap * 0.44))
  const windowHeight = Math.min(84, Math.max(64, rowGap * 0.5))

  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < windowColumns; col += 1) {
      const cx = marginX + colGap * (col + 0.5)
      const cy = topMargin + rowGap * (row + 0.5)
      const dark = (row + col + index) % 5 === 0

      paintWindow(context, cx, cy, windowWidth, windowHeight, dark, index + row * 7 + col)
    }
  }

  paintShopfront(context, w, h, shopHeight, shopKind, index, isEndFacade, windowColumns)
}

function getFacadeColumnCount(facadeWidth, isEndFacade, index) {
  if (isEndFacade) {
    return facadeWidth > 1.25 || index % 3 === 0 ? 2 : 2
  }

  if (facadeWidth < 1.75) {
    return 2
  }

  if (facadeWidth < 2.55) {
    return index % 4 === 0 ? 4 : 3
  }

  return 4
}

function getFacadeRowCount(floors, isEndFacade, shopKind) {
  const adjustedFloors = floors - (shopKind ? 1 : 0) - (isEndFacade ? 1 : 0)

  return Math.max(3, Math.min(6, adjustedFloors))
}

function paintPaperNoise(context, width, height, baseColor, count) {
  for (let i = 0; i < count; i += 1) {
    const mix = baseColor.clone().lerp(new THREE.Color(i % 2 === 0 ? 0xffffff : 0x5c4d45), i % 2 === 0 ? 0.16 : 0.1)
    const alpha = i % 2 === 0 ? 0.18 : 0.1

    context.strokeStyle = `rgba(${Math.round(mix.r * 255)}, ${Math.round(mix.g * 255)}, ${Math.round(mix.b * 255)}, ${alpha})`
    context.lineWidth = 1 + (i % 5)
    context.beginPath()
    context.moveTo((i * 41) % width, (i * 67) % height)
    context.lineTo(((i * 41) % width) + 40 + (i % 6) * 18, ((i * 67) % height) + ((i % 7) - 3) * 8)
    context.stroke()
  }
}

function paintGouacheWashes(context, width, height, baseColor, index) {
  for (let i = 0; i < 18; i += 1) {
    const mix = baseColor.clone().lerp(new THREE.Color(i % 3 === 0 ? 0xffffff : 0x6a554d), i % 3 === 0 ? 0.2 : 0.12)
    const x = ((i * 97 + index * 43) % width) - 48
    const y = ((i * 59 + index * 71) % height) - 24
    const gradient = context.createRadialGradient(x + 60, y + 35, 6, x + 60, y + 35, 78 + (i % 4) * 18)

    gradient.addColorStop(0, `rgba(${Math.round(mix.r * 255)}, ${Math.round(mix.g * 255)}, ${Math.round(mix.b * 255)}, 0.18)`)
    gradient.addColorStop(1, `rgba(${Math.round(mix.r * 255)}, ${Math.round(mix.g * 255)}, ${Math.round(mix.b * 255)}, 0)`)
    context.fillStyle = gradient
    context.fillRect(x, y, 160, 120)
  }
}

function paintRoofShadow(context, width, index) {
  context.fillStyle = index % 2 === 0 ? 'rgba(38, 48, 58, 0.18)' : 'rgba(73, 49, 42, 0.16)'
  context.beginPath()
  context.moveTo(8, 14)
  context.lineTo(width - 10, 8 + (index % 4) * 3)
  context.lineTo(width - 20, 52 + (index % 3) * 5)
  context.lineTo(18, 62)
  context.closePath()
  context.fill()
  context.strokeStyle = 'rgba(35, 33, 31, 0.34)'
  context.lineWidth = 4
  sketchLine(context, 16, 62, width - 18, 50 + (index % 3) * 5, 2, index)
}

function paintFacadeRoofDetails(context, width, index, isEndFacade) {
  const count = isEndFacade ? 1 : index % 3 === 0 ? 4 : 3
  const gap = width / (count + 1)

  for (let i = 0; i < count; i += 1) {
    const cx = gap * (i + 1)
    const y = 26 + (i % 2) * 3
    const w = isEndFacade ? 36 : 28
    const h = 42

    context.fillStyle = 'rgba(43, 52, 58, 0.76)'
    context.beginPath()
    context.moveTo(cx - w / 2 - 5, y + 10)
    context.lineTo(cx, y - 4)
    context.lineTo(cx + w / 2 + 5, y + 10)
    context.lineTo(cx + w / 2, y + h)
    context.lineTo(cx - w / 2, y + h)
    context.closePath()
    context.fill()
    context.strokeStyle = 'rgba(33, 31, 30, 0.52)'
    context.lineWidth = 2.5
    sketchRect(context, cx - w / 2, y + 11, w, h - 10, 1.2, index + i * 13)
    context.fillStyle = 'rgba(252, 247, 235, 0.88)'
    context.fillRect(cx - w * 0.22, y + 22, w * 0.44, h * 0.38)
    context.strokeStyle = 'rgba(255, 255, 255, 0.86)'
    context.lineWidth = 2
    sketchLine(context, cx, y + 23, cx, y + 37, 0.8, index + i)
  }
}

function paintWindow(context, cx, cy, width, height, dark, seed) {
  const frameX = cx - width / 2 - 7
  const frameY = cy - height / 2 - 7

  context.fillStyle = 'rgba(255, 250, 238, 0.92)'
  context.fillRect(frameX, frameY, width + 14, height + 14)
  context.strokeStyle = 'rgba(45, 42, 38, 0.5)'
  context.lineWidth = 3.2
  sketchRect(context, frameX, frameY, width + 14, height + 14, 1.6, seed)
  context.fillStyle = dark ? '#454949' : '#f7efe2'
  context.fillRect(cx - width / 2, cy - height / 2, width, height)
  context.strokeStyle = 'rgba(255, 255, 255, 0.94)'
  context.lineWidth = 4.4
  sketchLine(context, cx, cy - height / 2 + 3, cx + ((seed % 3) - 1), cy + height / 2 - 3, 1.2, seed + 1)
  sketchLine(context, cx - width / 2 + 3, cy, cx + width / 2 - 3, cy + ((seed % 4) - 1), 1.2, seed + 2)
  context.strokeStyle = 'rgba(255, 255, 255, 0.55)'
  context.lineWidth = 2
  sketchLine(context, cx - width * 0.25, cy - height / 2 + 6, cx - width * 0.25, cy + height / 2 - 5, 1, seed + 3)
  context.fillStyle = 'rgba(255, 247, 230, 0.78)'
  context.fillRect(cx - width / 2 - 10, cy + height / 2 + 8, width + 20, 8)
}

function sketchRect(context, x, y, width, height, wobble, seed) {
  sketchLine(context, x, y, x + width, y + pseudoJitter(seed, 1) * wobble, wobble, seed)
  sketchLine(context, x + width, y, x + width + pseudoJitter(seed, 2) * wobble, y + height, wobble, seed + 3)
  sketchLine(context, x + width, y + height, x, y + height + pseudoJitter(seed, 4) * wobble, wobble, seed + 6)
  sketchLine(context, x, y + height, x + pseudoJitter(seed, 5) * wobble, y, wobble, seed + 9)
}

function sketchLine(context, x1, y1, x2, y2, wobble, seed) {
  context.beginPath()
  context.moveTo(x1, y1)
  context.lineTo(
    (x1 + x2) / 2 + pseudoJitter(seed, 7) * wobble,
    (y1 + y2) / 2 + pseudoJitter(seed, 11) * wobble,
  )
  context.lineTo(x2, y2)
  context.stroke()
}

function pseudoJitter(seed, salt) {
  return Math.sin(seed * 12.9898 + salt * 78.233) * 0.5
}

function paintShopfront(context, width, height, shopHeight, shopKind, index, isEndFacade, windowColumns) {
  const shopTop = height - shopHeight
  const darkFront = shopKind === 'cafe' ? '#413934' : shopKind === 'flowers' ? '#fff1d8' : 'rgba(255, 241, 216, 0.72)'
  const signColor = shopKind === 'flowers' ? '#667f5a' : shopKind === 'cafe' ? '#5a4638' : '#c98b63'
  const label = isEndFacade
    ? ''
    : shopKind === 'cafe'
      ? 'KAFFE'
      : shopKind === 'flowers'
        ? 'BLOMSTER'
        : index % 2 === 0
          ? 'NYHAVN'
          : ''
  const inset = isEndFacade ? 74 : 28
  const doorWidth = isEndFacade ? 76 : 70
  const doorHeight = 108
  const doorX = isEndFacade
    ? width / 2 - doorWidth / 2
    : index % 2 === 0
      ? width - inset - doorWidth - 12
      : inset + 12
  const doorY = shopTop + shopHeight - doorHeight - 18

  context.fillStyle = darkFront
  context.fillRect(inset, shopTop + 24, width - inset * 2, shopHeight - 42)
  context.strokeStyle = 'rgba(41, 38, 34, 0.42)'
  context.lineWidth = 5
  sketchRect(context, inset, shopTop + 24, width - inset * 2, shopHeight - 42, 2, index + 31)

  if (label) {
    context.fillStyle = signColor
    context.fillRect(76, shopTop - 10, width - 152, 46)
    context.strokeStyle = 'rgba(44, 39, 34, 0.36)'
    sketchRect(context, 76, shopTop - 10, width - 152, 46, 1.6, index + 42)
  }

  if (label) {
    context.fillStyle = '#fff3dd'
    context.font = '800 30px Georgia, Times New Roman, serif'
    context.textAlign = 'center'
    context.textBaseline = 'middle'
    context.fillText(label, width / 2, shopTop + 13)
  }

  paintDoor(context, doorX, doorY, doorWidth, doorHeight, index)

  const availableWidth = width - inset * 2 - doorWidth - 46
  const smallWindowCount = Math.max(1, Math.min(3, windowColumns - (isEndFacade ? 1 : 0)))
  const startX = doorX < width / 2 ? doorX + doorWidth + 34 : inset + 24
  const smallGap = availableWidth / smallWindowCount

  for (let i = 0; i < smallWindowCount; i += 1) {
    const cx = startX + smallGap * (i + 0.5)
    const cy = shopTop + 86

    if (cx > inset + 34 && cx < width - inset - 34) {
      paintWindow(context, cx, cy, 46, 58, shopKind === 'cafe' && i % 2 === 0, index + 80 + i)
    }
  }

  if (shopKind === 'flowers') {
    for (let i = 0; i < 7; i += 1) {
      context.fillStyle = ['#d68aa0', '#e2c760', '#f4eee1', '#93a978'][i % 4]
      context.beginPath()
      context.arc(80 + i * 28, shopTop + 112 - (i % 2) * 12, 11, 0, Math.PI * 2)
      context.fill()
    }
  }
}

function paintDoor(context, x, y, width, height, seed) {
  context.fillStyle = '#344247'
  context.fillRect(x - 8, y - 8, width + 16, height + 16)
  context.fillStyle = seed % 3 === 0 ? '#2f3d40' : seed % 3 === 1 ? '#5d4439' : '#42504d'
  context.fillRect(x, y, width, height)
  context.strokeStyle = 'rgba(255, 247, 230, 0.74)'
  context.lineWidth = 3
  sketchRect(context, x + 8, y + 10, width - 16, height - 22, 1.4, seed + 94)
  sketchLine(context, x + width / 2, y + 14, x + width / 2, y + height - 14, 1, seed + 95)
  context.fillStyle = 'rgba(244, 219, 154, 0.92)'
  context.beginPath()
  context.arc(x + width - 16, y + height * 0.56, 4, 0, Math.PI * 2)
  context.fill()
  context.strokeStyle = 'rgba(39, 35, 32, 0.52)'
  context.lineWidth = 3
  sketchRect(context, x - 8, y - 8, width + 16, height + 16, 1.8, seed + 96)
}

function createStreetFacingFacade({ bodyColor, depth, height, index, shopKind, side, width }) {
  const group = new THREE.Group()
  const faceX = -side * (width / 2 + 0.028)
  // This is the facade texture generator used by every street-facing
  // townhouse card. Windows, doors, shopfronts, signs, and linework are
  // painted into the canvas texture instead of built as separate meshes.
  const facade = createPaintedBuildingFacade({
    bodyColor,
    height,
    index,
    shopKind,
    width: depth,
  })

  facade.position.set(faceX - side * 0.034, 0, 0)
  facade.rotation.y = -side * Math.PI * 0.5
  group.add(facade)

  return group
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

function markCameraOccluder(object, id) {
  object.userData.isBuildingOccluder = true
  object.userData.fadeWhenBlockingCamera = true
  object.userData.cameraOccluderRoot = object
  object.userData.cameraOccluderId = id
  object.traverse?.((child) => {
    if (child.isMesh) {
      child.userData.fadeWhenBlockingCamera = true
      child.userData.cameraOccluderRoot = object
      child.userData.cameraOccluderId = id
      storeOriginalMaterialSettings(child)
    }
  })
}

function storeOriginalMaterialSettings(mesh) {
  if (mesh.userData.cameraOcclusionOriginalVisible === undefined) {
    mesh.userData.cameraOcclusionOriginalVisible = mesh.visible
  }

  for (const meshMaterial of getMeshMaterials(mesh)) {
    if (!meshMaterial.userData.cameraOcclusionOriginal) {
      meshMaterial.userData.cameraOcclusionOriginal = {
        depthWrite: meshMaterial.depthWrite,
        opacity: meshMaterial.opacity,
        transparent: meshMaterial.transparent,
      }
    }
  }
}

function updateCameraOcclusionFading(scene, camera, avatar, occlusionState) {
  const cameraPosition = camera.getWorldPosition(new THREE.Vector3())
  const avatarTarget = avatar.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(0, 0.95, 0))
  const viewVector = avatarTarget.clone().sub(cameraPosition)
  const viewDistance = viewVector.length()
  const roots = new Set()

  scene.traverse((child) => {
    if (child.userData.isBuildingOccluder) {
      roots.add(child)
    }
  })

  const blockingRoots = new Set()
  let cameraInsideBuilding = false

  for (const root of roots) {
    const blockState = getBuildingOcclusionState(root, cameraPosition, viewVector, viewDistance)

    if (blockState.blocksView) {
      blockingRoots.add(root)
    }
    cameraInsideBuilding = cameraInsideBuilding || blockState.cameraInside
  }

  for (const root of blockingRoots) {
    applyBuildingOcclusion(root, true)
  }
  occlusionState.active = restoreInactiveOccluders(occlusionState, blockingRoots)
  updateOcclusionDebug(occlusionState, cameraInsideBuilding)
}

function getBuildingOcclusionState(root, cameraPosition, viewVector, viewDistance) {
  const box = new THREE.Box3().setFromObject(root).expandByScalar(0.12)

  if (box.isEmpty() || viewDistance <= 0.01) {
    return {
      blocksView: false,
      cameraInside: false,
    }
  }

  const cameraInside = box.containsPoint(cameraPosition)
  if (cameraInside) {
    return {
      blocksView: true,
      cameraInside: true,
    }
  }

  const direction = viewVector.clone().normalize()
  const ray = new THREE.Ray(cameraPosition, direction)
  const hit = ray.intersectBox(box, new THREE.Vector3())

  if (!hit) {
    return {
      blocksView: false,
      cameraInside: false,
    }
  }

  return {
    blocksView: hit.distanceTo(cameraPosition) <= viewDistance,
    cameraInside: false,
  }
}

function restoreInactiveOccluders(occlusionState, blockingRoots) {
  const nextActive = new Set(blockingRoots)

  for (const root of occlusionState.active) {
    if (!blockingRoots.has(root)) {
      applyBuildingOcclusion(root, false)
    }
  }

  return nextActive
}

function applyBuildingOcclusion(root, shouldOcclude) {
  root.traverse((child) => {
    if (!child.isMesh || !child.userData.fadeWhenBlockingCamera) {
      return
    }

    child.visible = shouldOcclude && BUILDING_OCCLUSION_MODE === 'hide'
      ? false
      : child.userData.cameraOcclusionOriginalVisible

    for (const meshMaterial of getMeshMaterials(child)) {
      const original = meshMaterial.userData.cameraOcclusionOriginal

      if (!original) {
        continue
      }

      if (shouldOcclude) {
        meshMaterial.transparent = true
        meshMaterial.opacity = BUILDING_OCCLUSION_OPACITY
        meshMaterial.depthWrite = false
      } else {
        meshMaterial.opacity = original.opacity
        meshMaterial.transparent = original.transparent
        meshMaterial.depthWrite = original.depthWrite
      }
    }
  })
}

function updateOcclusionDebug(occlusionState, cameraInsideBuilding) {
  const fadedRoots = [...occlusionState.active]

  occlusionState.debug = {
    cameraInsideBuilding,
    fadedCount: fadedRoots.length,
    fadedIds: fadedRoots.map((root) => root.userData.cameraOccluderId ?? root.uuid).slice(0, 8),
    mode: BUILDING_OCCLUSION_MODE,
  }
}

function getMeshMaterials(mesh) {
  return Array.isArray(mesh.material) ? mesh.material : [mesh.material]
}

function updateAvatar(avatar, motionState, tracking, elapsed, keys) {
  const pose = tracking?.pose
  const motion = tracking?.motion ?? { lateral: 0, speed: 0, walking: false }
  const bodyVisible = Boolean(tracking?.bodyCenter?.visible && pose?.leftShoulder && pose?.rightShoulder)
  const targetSpeed = bodyVisible && motion.walking ? (motion.speed ?? 0.05) * MEDIAPIPE_MOVE_SPEED_MULTIPLIER : 0
  const targetSideSpeed = bodyVisible ? (motion.sideMovement ?? motion.lateral ?? 0) * MEDIAPIPE_MOVE_SPEED_MULTIPLIER : 0
  const keyboardX = Number(keys.right) - Number(keys.left)
  const keyboardZ = -Number(keys.forward)
  const keyboardActive = keyboardX !== 0 || keyboardZ !== 0
  const poseVx = targetSideSpeed
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
  const lateralStep = motionState.vx * 0.82
  const forward = forwardVectorFromHeading(motionState.targetHeading)

  motionState.playerWorldX += forward.x * forwardStep
  motionState.playerWorldZ += forward.z * forwardStep
  motionState.lateralOffset += lateralStep
  applyStreetBoundaryCollision(motionState)
  motionState.worldTravel = -motionState.playerWorldZ
  motionState.scrolling = forwardStep > 0.002
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

function isCompletionLockingGameplay(completionPhase) {
  return completionPhase === 'postcard'
}

function stopAvatarMotion(motionState, keys) {
  keys.forward = false
  keys.left = false
  keys.right = false
  keys.bend = false
  keys.turnLeft = false
  keys.turnRight = false
  keys.turnAround = false
  motionState.poseVx = 0
  motionState.poseVz = 0
  motionState.keyboardVx = 0
  motionState.keyboardVz = 0
  motionState.vx = 0
  motionState.vz = 0
  motionState.smoothedSpeed *= 0.82
  motionState.scrolling = false
}

function updateCompletionCamera(camera, avatar, motionState) {
  const forward = forwardVectorFromHeading(motionState.currentHeading)
  const right = rightVectorFromHeading(motionState.currentHeading)
  const target = avatar.position.clone()
    .add(new THREE.Vector3(0, 1.05, 0))
    .add(forward.clone().multiplyScalar(1.8))
    .add(right.clone().multiplyScalar(0.75))
  const desiredPosition = avatar.position.clone()
    .add(forward.clone().multiplyScalar(-5.9))
    .add(right.clone().multiplyScalar(1.35))
    .add(new THREE.Vector3(0, 1.72, 0))

  camera.position.lerp(desiredPosition, 0.035)
  camera.lookAt(target)
}

function updateCompletionDisplay(display, avatar, motionState, completionPhase, completionState, elapsed) {
  void avatar
  void motionState
  void elapsed
  display.group.visible = false
  completionState.activeKey = completionPhase === 'idle' ? '' : completionPhase
}

function resetCompletionAssembly(display) {
  for (const part of display.assemblyParts) {
    part.mesh.visible = false
    part.mesh.scale.setScalar(0.25)
  }
}

function updateCompletionAvatarPose(avatar, completionPhase, completionState, elapsed) {
  if (completionPhase !== 'celebrating' && completionPhase !== 'postcard') {
    avatar.position.y += (0 - avatar.position.y) * 0.18
    return
  }

  if (completionState.activeKey !== completionPhase) {
    completionState.activeKey = completionPhase
    completionState.animationStartAt = elapsed
  }

  const parts = avatar.userData.parts
  const localElapsed = Math.max(0, elapsed - completionState.animationStartAt)
  const bounce = completionPhase === 'celebrating'
    ? Math.max(0, Math.sin(localElapsed * Math.PI * 2.2)) * 0.18
    : 0
  const wave = Math.sin(localElapsed * 8.5) * 0.08
  const lift = completionPhase === 'celebrating'
    ? Math.max(0, Math.sin(localElapsed * Math.PI * 3)) * 0.05
    : 0
  const leftShoulder = new THREE.Vector3(-0.24, 1.22 + lift, 0)
  const rightShoulder = new THREE.Vector3(0.24, 1.22 + lift, 0)
  const leftElbow = new THREE.Vector3(-0.42, 1.48 + lift, wave)
  const rightElbow = new THREE.Vector3(0.42, 1.48 + lift, -wave)
  const leftHand = new THREE.Vector3(-0.34, 1.76 + lift, wave)
  const rightHand = new THREE.Vector3(0.34, 1.76 + lift, -wave)
  const head = new THREE.Vector3(0, 1.56 + lift * 0.5, 0)
  const torsoTop = new THREE.Vector3(0, 1.3 + lift * 0.32, 0)
  const hips = new THREE.Vector3(0, 0.82 + lift * 0.16, 0)

  avatar.position.y += (bounce - avatar.position.y) * 0.28
  parts.head.position.lerp(head, 0.22)
  setLimb(parts.torso, torsoTop, hips, 0.24)
  setLimb(parts.leftUpperArm, leftShoulder, leftElbow, 0.42)
  setLimb(parts.leftLowerArm, leftElbow, leftHand, 0.42)
  setLimb(parts.rightUpperArm, rightShoulder, rightElbow, 0.42)
  setLimb(parts.rightLowerArm, rightElbow, rightHand, 0.42)
  parts.leftHand.position.lerp(leftHand, 0.42)
  parts.rightHand.position.lerp(rightHand, 0.42)
}

function resetRunScene(bikeParts, completionDisplay, motionState, pickupState, keys) {
  for (const part of bikeParts.parts) {
    part.collected = false
    part.collecting = false
    part.areaId = part.originalAreaId
    part.x = part.originalX
    part.z = part.originalZ
    part.mesh.position.set(part.originalX, 0.24, part.originalZ)
    part.mesh.scale.setScalar(1)
    part.mesh.visible = true
    part.halo.position.set(part.originalX, 0.08, part.originalZ)
    part.halo.visible = false
  }

  bikeParts.pickupAnimations.length = 0
  completionDisplay.group.visible = false
  resetCompletionAssembly(completionDisplay)
  motionState.currentAreaId = 'mainStreet'
  motionState.currentHeading = MAIN_STREET_HEADING
  motionState.targetHeading = MAIN_STREET_HEADING
  motionState.facingAngle = AVATAR_BASE_YAW
  motionState.playerWorldX = 0
  motionState.playerWorldZ = 0
  motionState.worldTravel = 0
  motionState.lateralOffset = 0
  motionState.x = 0
  motionState.z = 3.15
  stopAvatarMotion(motionState, keys)
  pickupState.feedback = ''
  pickupState.feedbackUntil = 0
  pickupState.gestureState = 'waiting'
  pickupState.nearbyPartId = null
}

function updateGuideScene(ghostGuide, motionState, guideStep, elapsed) {
  updateGhostGuide(ghostGuide, motionState, guideStep, elapsed)
}

function updateGhostGuide(ghostGuide, motionState, guideStep, elapsed) {
  if (!ghostGuide) {
    return
  }

  const guideActive = guideStep && guideStep !== 'hidden'

  ghostGuide.visible = guideActive
  if (!guideActive) {
    return
  }

  const right = rightVectorFromHeading(motionState.currentHeading)
  const forward = forwardVectorFromHeading(motionState.currentHeading)
  const avatarPosition = new THREE.Vector3(
    right.x * motionState.lateralOffset,
    0.12,
    motionState.z + right.z * motionState.lateralOffset,
  )
  const guideOffset = right.clone().multiplyScalar(-1.12).add(forward.clone().multiplyScalar(0.35))
  const sidePulse = getGuideSidePulse(elapsed)
  const sideDemo =
    guideStep === 'left'
      ? -sidePulse * 1.05
      : guideStep === 'right'
        ? sidePulse * 1.05
        : 0
  const sideTurn = guideStep === 'left' ? -0.72 * sidePulse : guideStep === 'right' ? 0.72 * sidePulse : 0

  ghostGuide.position.copy(avatarPosition).add(guideOffset).add(right.clone().multiplyScalar(sideDemo))
  ghostGuide.rotation.y = avatarYawFromHeading(motionState.currentHeading) + 0.12 + sideTurn
  ghostGuide.position.y += Math.sin(elapsed * 2.5) * 0.035
  setGhostGuidePose(ghostGuide, guideStep, elapsed)
}

function setGhostGuidePose(ghostGuide, guideStep, elapsed) {
  const parts = ghostGuide.userData.parts
  const sway = Math.sin(elapsed * 3.2) * 0.035
  const sideDirection = guideStep === 'left' ? -1 : guideStep === 'right' ? 1 : 0
  const sidePulse = sideDirection ? getGuideSidePulse(elapsed) : 0
  const sideSway = sideDirection * (0.24 + sidePulse * 0.48)
  const walkPhase = Math.sin(elapsed * 9.5)
  const walk = guideStep === 'walk' ? walkPhase * 0.34 : 0
  const pickupCycle = guideStep === 'pickup' ? (Math.sin(elapsed * 3.2 - Math.PI * 0.5) + 1) * 0.5 : 0
  const bend = pickupCycle * 0.52
  const leftArm = getGhostArmPose('left', guideStep, elapsed)
  const rightArm = getGhostArmPose('right', guideStep, elapsed)
  const leftStepLift = guideStep === 'walk' ? Math.max(0, walkPhase) * 0.28 : sideDirection < 0 ? sidePulse * 0.28 : 0
  const rightStepLift = guideStep === 'walk' ? Math.max(0, -walkPhase) * 0.28 : sideDirection > 0 ? sidePulse * 0.28 : 0
  const leftFootX = -0.18 + sideSway * 0.42 + (sideDirection < 0 ? -sidePulse * 0.38 : 0)
  const rightFootX = 0.18 + sideSway * 0.42 + (sideDirection > 0 ? sidePulse * 0.38 : 0)

  parts.head.position.lerp(new THREE.Vector3(sideSway * 0.2, 1.46 - bend, 0.02 + bend * 0.25), 0.18)
  setLimb(
    parts.torso,
    new THREE.Vector3(sideSway * 0.18, 1.2 - bend * 0.88, bend * 0.2),
    new THREE.Vector3(sideSway * 0.04, 0.78 - bend * 0.34, bend * 0.1),
    0.22,
  )
  setLimb(parts.leftUpperArm, leftArm.shoulder, leftArm.elbow, 0.24)
  setLimb(parts.leftLowerArm, leftArm.elbow, leftArm.hand, 0.24)
  setLimb(parts.rightUpperArm, rightArm.shoulder, rightArm.elbow, 0.24)
  setLimb(parts.rightLowerArm, rightArm.elbow, rightArm.hand, 0.24)
  setLimb(parts.leftLeg, new THREE.Vector3(-0.12 + sideSway * 0.16, 0.78 - bend * 0.16, 0), new THREE.Vector3(leftFootX, 0.08 + leftStepLift, walk), 0.24)
  setLimb(parts.rightLeg, new THREE.Vector3(0.12 + sideSway * 0.16, 0.78 - bend * 0.16, 0), new THREE.Vector3(rightFootX, 0.08 + rightStepLift, -walk), 0.24)
  parts.leftHand.position.lerp(leftArm.hand, 0.24)
  parts.rightHand.position.lerp(rightArm.hand, 0.24)
  parts.head.position.y += sway
}

function getGhostArmPose(sideName, guideStep, elapsed) {
  const side = sideName === 'left' ? -1 : 1
  const shoulder = new THREE.Vector3(side * 0.2, 1.18, 0)

  if (guideStep === 'turn') {
    const demoLeft = Math.sin(elapsed * 1.8) < 0
    const armOut = (demoLeft && side < 0) || (!demoLeft && side > 0)

    if (armOut) {
      return {
        shoulder,
        elbow: new THREE.Vector3(side * 0.58, 1.11, 0),
        hand: new THREE.Vector3(side * (0.92 + Math.abs(Math.sin(elapsed * 5)) * 0.16), 1.08, 0),
      }
    }

    return {
      shoulder,
      elbow: new THREE.Vector3(side * 0.18, 0.86, 0.06),
      hand: new THREE.Vector3(side * 0.16, 0.62, 0.1),
    }
  }

  if (guideStep === 'map') {
    const raisePulse = 0.82 + Math.sin(elapsed * 5.6) * 0.08

    return {
      shoulder,
      elbow: new THREE.Vector3(side * 0.34, 1.36, 0.02),
      hand: new THREE.Vector3(side * 0.24, 1.62 + raisePulse * 0.08, 0.04),
    }
  }

  if (guideStep === 'pickup') {
    const pickupCycle = (Math.sin(elapsed * 3.2 - Math.PI * 0.5) + 1) * 0.5

    return {
      shoulder: new THREE.Vector3(side * 0.2, 1.1 - pickupCycle * 0.26, 0.08 + pickupCycle * 0.08),
      elbow: new THREE.Vector3(side * 0.28, 0.86 - pickupCycle * 0.46, 0.12 + pickupCycle * 0.14),
      hand: new THREE.Vector3(side * 0.22, 0.62 - pickupCycle * 0.46, 0.16 + pickupCycle * 0.24),
    }
  }

  if (guideStep === 'walk') {
    const armSwing = Math.sin(elapsed * 9.5 + (side < 0 ? Math.PI : 0)) * 0.34

    return {
      shoulder,
      elbow: new THREE.Vector3(side * 0.32, 0.86, armSwing),
      hand: new THREE.Vector3(side * 0.26, 0.54, armSwing * 1.35),
    }
  }

  if (guideStep === 'left' || guideStep === 'right') {
    const direction = guideStep === 'left' ? -1 : 1
    const sidePulse = getGuideSidePulse(elapsed)
    const leadingArm = direction === side

    return {
      shoulder: new THREE.Vector3(side * 0.2 + direction * sidePulse * 0.12, 1.18, 0),
      elbow: new THREE.Vector3(side * 0.34 + direction * sidePulse * (leadingArm ? 0.26 : 0.08), 0.94, 0.08),
      hand: new THREE.Vector3(side * 0.32 + direction * sidePulse * (leadingArm ? 0.34 : 0.12), 0.64, 0.14),
    }
  }

  return {
    shoulder,
    elbow: new THREE.Vector3(side * 0.3, 0.88, 0),
    hand: new THREE.Vector3(side * 0.26, 0.56, 0),
  }
}

function getGuideSidePulse(elapsed) {
  return (Math.sin(elapsed * 2.7 - Math.PI * 0.5) + 1) * 0.5
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

function applyStreetBoundaryCollision(motionState) {
  const before = getAvatarBoundaryWorldPosition(motionState)
  const boundary = motionState.currentAreaId === 'leftStreet'
    ? clampLeftStreetBoundary(motionState, before)
    : clampMainStreetBoundary(motionState, before)
  const after = getAvatarBoundaryWorldPosition(motionState)

  motionState.blockedByBoundary = boundary.blocked
  motionState.streetBoundaryDebug = {
    ...boundary.debug,
    avatarWorldX: after.x,
    avatarWorldZ: after.z,
  }
}

function clampMainStreetBoundary(motionState, avatarWorldPosition) {
  const inIntersectionOpening = isWorldZInIntersectionOpening(avatarWorldPosition.z)
  const enteringLeftStreet = isHeadingNear(motionState.targetHeading, LEFT_STREET_HEADING)
  const useIntersectionBounds = inIntersectionOpening &&
    (enteringLeftStreet || avatarWorldPosition.x < MAIN_STREET_BOUNDS.minLateral)
  const bounds = useIntersectionBounds
    ? {
        maxLateral: INTERSECTION_BOUNDS.maxMainLateral,
        minLateral: INTERSECTION_BOUNDS.minMainLateral,
        streetId: 'intersection',
      }
    : {
        ...MAIN_STREET_BOUNDS,
        streetId: 'mainStreet',
      }
  const clampedWorldX = THREE.MathUtils.clamp(
    avatarWorldPosition.x,
    bounds.minLateral,
    bounds.maxLateral,
  )
  const blocked = Math.abs(clampedWorldX - avatarWorldPosition.x) > STREET_BOUNDARY_EPSILON

  if (blocked) {
    moveAvatarBoundaryWorldX(motionState, clampedWorldX - avatarWorldPosition.x)
  }

  return {
    blocked,
    debug: {
      localLateral: clampedWorldX,
      maxLateral: bounds.maxLateral,
      minLateral: bounds.minLateral,
      streetId: bounds.streetId,
    },
  }
}

function clampLeftStreetBoundary(motionState, avatarWorldPosition) {
  const localLateral = avatarWorldPosition.z - LEFT_STREET_ENTRANCE_Z
  const clampedLocalLateral = THREE.MathUtils.clamp(
    localLateral,
    LEFT_STREET_BOUNDS.minLateral,
    LEFT_STREET_BOUNDS.maxLateral,
  )
  const blocked = Math.abs(clampedLocalLateral - localLateral) > STREET_BOUNDARY_EPSILON

  if (blocked) {
    moveAvatarBoundaryWorldZ(motionState, clampedLocalLateral - localLateral)
  }

  return {
    blocked,
    debug: {
      localLateral: clampedLocalLateral,
      maxLateral: LEFT_STREET_BOUNDS.maxLateral,
      minLateral: LEFT_STREET_BOUNDS.minLateral,
      streetId: 'leftStreet',
    },
  }
}

function getAvatarBoundaryWorldPosition(motionState) {
  const right = rightVectorFromHeading(motionState.currentHeading)

  return {
    x: motionState.playerWorldX + right.x * motionState.lateralOffset,
    z: motionState.playerWorldZ + motionState.z + right.z * motionState.lateralOffset,
  }
}

function moveAvatarBoundaryWorldX(motionState, deltaX) {
  const right = rightVectorFromHeading(motionState.currentHeading)

  if (Math.abs(right.x) > 0.12) {
    motionState.lateralOffset += deltaX / right.x
  } else {
    motionState.playerWorldX += deltaX
  }
}

function moveAvatarBoundaryWorldZ(motionState, deltaZ) {
  const right = rightVectorFromHeading(motionState.currentHeading)

  if (Math.abs(right.z) > 0.12) {
    motionState.lateralOffset += deltaZ / right.z
  } else {
    motionState.playerWorldZ += deltaZ
  }
}

function isWorldZInIntersectionOpening(worldZ) {
  return worldZ >= INTERSECTION_BOUNDS.minWorldZ && worldZ <= INTERSECTION_BOUNDS.maxWorldZ
}

function isHeadingNear(current, target) {
  return Math.abs(angleDelta(current, target)) < 0.35
}

function updateHeadingAndArea(motionState, bikeParts, pickupState, keys, tracking, elapsed, onRecalibrateBodyLean) {
  const canTransition = elapsed - motionState.lastTransitionAt > 1
  const atJunction = isNearLeftStreetJunction(motionState)
  const armTurn = updateArmTurnGestureState(motionState, tracking?.pose, tracking?.motion, elapsed)
  const turnAroundGesture = updateTurnAroundGestureState(motionState, tracking?.pose, tracking?.motion, elapsed)
  const gestureTurnRequested = armTurn.left || armTurn.right
  let gestureTurnApplied = false

  motionState.turnHint = motionState.currentAreaId === 'leftStreet'
    ? 'Press E to turn back to Main Street'
    : atJunction && motionState.targetHeading === MAIN_STREET_HEADING
      ? 'Press Q to look left'
      : ''

  if (keys.turnAround) {
    turnPlayerAround(motionState, elapsed, 'keyboard')
    keys.turnAround = false
  } else if (turnAroundGesture.triggered) {
    turnPlayerAround(motionState, elapsed, 'gesture')
  }

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

  if (gestureTurnRequested) {
    applyWebcamArmHeadingTurn(motionState, armTurn.left ? 'left' : 'right')
    clearTurnSideMovement(motionState, onRecalibrateBodyLean)
    gestureTurnApplied = true
  }

  if (motionState.currentAreaId === 'leftStreet' && keys.turnLeft) {
    motionState.targetHeading = LEFT_STREET_HEADING
    motionState.headingBefore = motionState.currentHeading
    motionState.headingAfter = motionState.targetHeading
    motionState.turnSource = 'keyboard'
    clearTurnSideMovement(motionState, onRecalibrateBodyLean)
  } else if (atJunction && keys.turnLeft) {
    motionState.targetHeading = LEFT_STREET_HEADING
    motionState.headingBefore = motionState.currentHeading
    motionState.headingAfter = motionState.targetHeading
    motionState.turnSource = 'keyboard'
    clearTurnSideMovement(motionState, onRecalibrateBodyLean)
  }

  if (motionState.currentAreaId === 'leftStreet' && keys.turnRight) {
    motionState.targetHeading = RETURN_FROM_LEFT_HEADING
    motionState.headingBefore = motionState.currentHeading
    motionState.headingAfter = motionState.targetHeading
    motionState.turnSource = 'keyboard'
    clearTurnSideMovement(motionState, onRecalibrateBodyLean)
  } else if (atJunction && keys.turnRight) {
    motionState.targetHeading = MAIN_STREET_HEADING
    motionState.headingBefore = motionState.currentHeading
    motionState.headingAfter = motionState.targetHeading
    motionState.turnSource = 'keyboard'
    clearTurnSideMovement(motionState, onRecalibrateBodyLean)
  }

  if (gestureTurnRequested) {
    motionState.armTurnTriggerAccepted = gestureTurnApplied
    motionState.armTurnBlockedReason = gestureTurnApplied ? 'accepted' : 'gesture turn not applied'
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

function turnPlayerAround(motionState, elapsed, trigger) {
  const nextHeading = normalizeAngle(motionState.targetHeading + Math.PI)

  motionState.targetHeading = nextHeading
  motionState.turnAroundCooldownUntil = elapsed + TURN_AROUND_COOLDOWN_SECONDS
  motionState.turnAroundCooldownMs = TURN_AROUND_COOLDOWN_SECONDS * 1000
  motionState.armTurnCooldownUntil = Math.max(
    motionState.armTurnCooldownUntil ?? 0,
    elapsed + ARM_TURN_COOLDOWN_SECONDS
  )
  motionState.armTurnCooldownMs = ARM_TURN_COOLDOWN_SECONDS * 1000
  motionState.armTurnReleased = false
  motionState.lastTurnAroundTrigger = trigger
  motionState.lastTurnAroundTriggerUntil = elapsed + 1.4
  motionState.lastTurnGesture = trigger === 'gesture' ? 'turnAround' : 'keyboardTurnAround'
  motionState.lastTurnGestureUntil = elapsed + 1.4
}

function applyWebcamArmHeadingTurn(motionState, direction) {
  const headingBefore = motionState.targetHeading
  const headingDelta = direction === 'left' ? -Math.PI / 2 : Math.PI / 2
  const targetHeading = motionState.currentAreaId === 'leftStreet' && direction === 'right'
    ? RETURN_FROM_LEFT_HEADING
    : snapHeadingToQuarter(headingBefore + headingDelta)

  motionState.targetHeading = targetHeading
  motionState.headingBefore = headingBefore
  motionState.headingAfter = targetHeading
  motionState.turnSource = 'webcam'
}

function clearTurnSideMovement(motionState, onRecalibrateBodyLean) {
  motionState.poseVx = 0
  motionState.vx = 0
  onRecalibrateBodyLean?.()
}

function updateTurnAroundGestureState(motionState, pose, motion, elapsed) {
  void pose
  void motion
  const cooldownRemaining = Math.max(
    0,
    motionState.turnAroundCooldownUntil - elapsed,
    motionState.armTurnCooldownUntil - elapsed
  )

  motionState.armsCrossed = false
  motionState.armsCrossedDisabled = true
  motionState.turnAroundCooldownMs = cooldownRemaining * 1000
  motionState.armTurnCooldownMs = Math.max(motionState.armTurnCooldownMs ?? 0, cooldownRemaining * 1000)
  if (motionState.lastTurnAroundTriggerUntil <= elapsed) {
    motionState.lastTurnAroundTrigger = 'none'
  }
  if (motionState.lastTurnGestureUntil <= elapsed) {
    motionState.lastTurnGesture = 'none'
  }

  return { triggered: false }
}

function updateArmTurnGestureState(motionState, pose, motion, elapsed) {
  void motion
  const gesture = getArmTurnGestureFlags(pose)
  const rawLeftWristX = Number.isFinite(pose?.leftWrist?.x) ? pose.leftWrist.x : 0.5
  const rawRightWristX = Number.isFinite(pose?.rightWrist?.x) ? pose.rightWrist.x : 0.5
  const cooldownRemaining = Math.max(0, motionState.armTurnCooldownUntil - elapsed)
  const directionalGestureActive = gesture.leftArmExtended || gesture.rightArmExtended
  const exclusiveLeft = gesture.leftArmExtended && !gesture.rightArmExtended
  const exclusiveRight = gesture.rightArmExtended && !gesture.leftArmExtended

  motionState.rawLeftWristX = rawLeftWristX
  motionState.rawRightWristX = rawRightWristX
  motionState.leftWristHistory = []
  motionState.rightWristHistory = []
  motionState.leftWristDeltaX = gesture.leftWristDeltaX
  motionState.rightWristDeltaX = gesture.rightWristDeltaX
  motionState.leftArmDistance = gesture.leftArmDistance
  motionState.rightArmDistance = gesture.rightArmDistance
  motionState.leftShoulderX = gesture.leftShoulderX
  motionState.rightShoulderX = gesture.rightShoulderX
  motionState.leftWristMinusShoulder = gesture.leftWristMinusShoulder
  motionState.rightWristMinusShoulder = gesture.rightWristMinusShoulder
  motionState.leftArmExtendedRaw = gesture.leftArmExtended
  motionState.rightArmExtendedRaw = gesture.rightArmExtended
  motionState.leftArmOut = gesture.leftArmExtended
  motionState.rightArmOut = gesture.rightArmExtended
  motionState.swipeLeftDetected = false
  motionState.swipeRightDetected = false
  motionState.armTurnCooldownMs = cooldownRemaining * 1000
  motionState.turnGestureActive = gesture.anyActive
  motionState.armTurnTriggerAttempted = false
  motionState.armTurnTriggerAccepted = false
  if (motionState.armTurnTriggeredUntil <= elapsed) {
    motionState.armTurnTriggered = ''
  }
  if (motionState.lastTurnGestureUntil <= elapsed) {
    motionState.lastTurnGesture = 'none'
  }

  if (!gesture.anyActive) {
    motionState.leftArmExtendedSince = null
    motionState.rightArmExtendedSince = null
    motionState.leftHoldMs = 0
    motionState.rightHoldMs = 0
    motionState.armTurnReleased = true
    motionState.armTurnSettledSince = elapsed
    motionState.armTurnArmed = true
    motionState.armTurnBlockedReason = 'ready'
    return { left: false, right: false }
  }

  if (exclusiveLeft) {
    motionState.leftArmExtendedSince ??= elapsed
  } else {
    motionState.leftArmExtendedSince = null
  }

  if (exclusiveRight) {
    motionState.rightArmExtendedSince ??= elapsed
  } else {
    motionState.rightArmExtendedSince = null
  }

  motionState.leftHoldMs = motionState.leftArmExtendedSince === null
    ? 0
    : Math.max(0, (elapsed - motionState.leftArmExtendedSince) * 1000)
  motionState.rightHoldMs = motionState.rightArmExtendedSince === null
    ? 0
    : Math.max(0, (elapsed - motionState.rightArmExtendedSince) * 1000)

  if (cooldownRemaining > 0) {
    motionState.armTurnBlockedReason = 'cooldown'
    return { left: false, right: false }
  }

  if (gesture.leftArmExtended && gesture.rightArmExtended) {
    motionState.armTurnBlockedReason = 'both arms detected'
    return { left: false, right: false }
  }

  if (!motionState.armTurnReleased || !motionState.armTurnArmed) {
    motionState.armTurnBlockedReason = 'release gesture first'
    return { left: false, right: false }
  }

  const leftHeld = exclusiveLeft && motionState.leftHoldMs >= ARM_TURN_HOLD_SECONDS * 1000
  const rightHeld = exclusiveRight && motionState.rightHoldMs >= ARM_TURN_HOLD_SECONDS * 1000

  if (!leftHeld && !rightHeld) {
    motionState.armTurnBlockedReason = directionalGestureActive ? 'hold turn gesture' : 'ready'
    return { left: false, right: false }
  }

  const turnDirection = leftHeld ? 'left' : 'right'
  motionState.armTurnReleased = false
  motionState.armTurnArmed = false
  motionState.armTurnTriggerAttempted = true
  motionState.armTurnTriggered = turnDirection
  motionState.armTurnTriggeredUntil = elapsed + 1.4
  motionState.lastTurnGesture = turnDirection
  motionState.lastTurnGestureUntil = elapsed + 1.4
  motionState.armTurnCooldownUntil = elapsed + ARM_TURN_COOLDOWN_SECONDS
  motionState.armTurnCooldownMs = ARM_TURN_COOLDOWN_SECONDS * 1000
  motionState.armTurnBlockedReason = 'attempted'

  return { left: leftHeld, right: rightHeld }
}

function getArmTurnGestureFlags(pose) {
  const leftShoulder = pose?.leftShoulder
  const rightShoulder = pose?.rightShoulder
  const leftWrist = pose?.leftWrist
  const rightWrist = pose?.rightWrist

  if (
    !isValidLandmark(leftShoulder) ||
    !isValidLandmark(rightShoulder) ||
    !isValidLandmark(leftWrist) ||
    !isValidLandmark(rightWrist)
  ) {
    return {
      anyActive: false,
      armsCrossed: false,
      leftArmDistance: 0,
      leftArmExtended: false,
      leftShoulderX: 0.5,
      leftWristDeltaX: 0,
      leftWristMinusShoulder: 0,
      rightArmDistance: 0,
      rightArmExtended: false,
      rightShoulderX: 0.5,
      rightWristDeltaX: 0,
      rightWristMinusShoulder: 0,
    }
  }

  const leftWristMinusShoulder = leftWrist.x - leftShoulder.x
  const rightWristMinusShoulder = rightWrist.x - rightShoulder.x
  const leftArmDistance = Math.abs(leftWristMinusShoulder)
  const rightArmDistance = Math.abs(rightWristMinusShoulder)
  const leftWristDeltaX = leftArmDistance
  const rightWristDeltaX = rightArmDistance
  const leftArmExtended = leftArmDistance > ARM_TURN_DISTANCE_THRESHOLD
  const rightArmExtended = rightArmDistance > ARM_TURN_DISTANCE_THRESHOLD

  return {
    anyActive: leftArmExtended || rightArmExtended,
    armsCrossed: false,
    leftArmDistance,
    leftArmExtended,
    leftShoulderX: leftShoulder.x,
    leftWristDeltaX,
    leftWristMinusShoulder,
    rightArmDistance,
    rightArmExtended,
    rightShoulderX: rightShoulder.x,
    rightWristDeltaX,
    rightWristMinusShoulder,
  }
}

function isNearLeftStreetJunction(motionState) {
  return Math.abs(motionState.playerWorldZ - LEFT_STREET_ENTRANCE_Z) < 5 && motionState.playerWorldX > -5.8
}

function publishWorldDebug(motionState, onWorldDebug, elapsed, scene, renderer, perfState, tracking, occlusionState) {
  if (!onWorldDebug || elapsed - motionState.lastDebugAt < 0.12) {
    return
  }

  motionState.lastDebugAt = elapsed
  const currentSceneStats = countSceneObjects(scene)
  const mapPlayer = getWorldMapPlayerPosition(motionState)
  const avatarWorldPosition = getAvatarWorldMapPosition(motionState)
  const mapParts = motionState.mapPartDebug ?? []

  perfState.meshCount = currentSceneStats.meshCount
  perfState.totalObjects = currentSceneStats.totalObjects
  perfState.visibleObjects = currentSceneStats.visibleObjects
  onWorldDebug({
    avatarBaseYaw: AVATAR_BASE_YAW,
    avatarWorldX: avatarWorldPosition.x,
    avatarWorldZ: avatarWorldPosition.z,
    blockedByBoundary: motionState.blockedByBoundary ?? false,
    boundaryAvatarWorldX: motionState.streetBoundaryDebug?.avatarWorldX ?? avatarWorldPosition.x,
    boundaryAvatarWorldZ: motionState.streetBoundaryDebug?.avatarWorldZ ?? avatarWorldPosition.z,
    boundaryLocalLateral: motionState.streetBoundaryDebug?.localLateral ?? mapPlayer.localLateral,
    boundaryMaxLateral: motionState.streetBoundaryDebug?.maxLateral ?? MAIN_STREET_BOUNDS.maxLateral,
    boundaryMinLateral: motionState.streetBoundaryDebug?.minLateral ?? MAIN_STREET_BOUNDS.minLateral,
    boundaryStreetId: motionState.streetBoundaryDebug?.streetId ?? motionState.currentAreaId,
    currentAreaId: motionState.currentAreaId,
    currentHeading: motionState.currentHeading,
    effectiveAvatarYaw: motionState.facingAngle,
    facingAngle: motionState.facingAngle,
    heading: motionState.currentHeading,
    headingAfter: motionState.headingAfter ?? motionState.targetHeading,
    headingBefore: motionState.headingBefore ?? motionState.currentHeading,
    idleDetected: Boolean(tracking?.motion?.idleDetected),
    armTurnCooldownMs: motionState.armTurnCooldownMs ?? 0,
    turnGestureCooldownMs: motionState.armTurnCooldownMs ?? 0,
    triggerBlockedReason: motionState.armTurnBlockedReason ?? 'ready',
    armTurnReleased: motionState.armTurnReleased ?? true,
    armTurnBlockedReason: motionState.armTurnBlockedReason ?? 'ready',
    armTurnTriggerAccepted: motionState.armTurnTriggerAccepted ?? false,
    armTurnTriggerAttempted: motionState.armTurnTriggerAttempted ?? false,
    gestureTriggerAccepted: motionState.armTurnTriggerAccepted ?? false,
    gestureTriggerAttempted: motionState.armTurnTriggerAttempted ?? false,
    armTurnTriggered: motionState.armTurnTriggered ?? '',
    armsCrossed: motionState.armsCrossed ?? false,
    armsCrossedDisabled: motionState.armsCrossedDisabled ?? true,
    lastTurnGesture: motionState.lastTurnGesture ?? 'none',
    lastTurnAroundTrigger: motionState.lastTurnAroundTrigger ?? 'none',
    turnAroundCooldownMs: motionState.turnAroundCooldownMs ?? 0,
    keyboardActive: motionState.keyboardActive,
    keyboardForward: motionState.keyboardForward,
    keyboardMovementValue: motionState.keyboardMovementValue,
    keyboardSide: motionState.keyboardSide,
    keyboardSpeedMultiplier: KEYBOARD_SPEED_MULTIPLIER,
    keyboardSmoothing: KEYBOARD_MOVEMENT_SMOOTHING,
    finalLateralMovement: motionState.vx,
    lateralOffset: motionState.lateralOffset,
    leftWristAvatarX: motionState.leftWristAvatarX ?? 0,
    leftArmDetected: motionState.leftArmExtendedRaw ?? false,
    leftArmDistance: motionState.leftArmDistance ?? 0,
    leftArmExtended: motionState.leftArmOut ?? false,
    leftArmExtendedRaw: motionState.leftArmExtendedRaw ?? false,
    leftArmOut: motionState.leftArmOut ?? false,
    leftHoldMs: motionState.leftHoldMs ?? 0,
    leftShoulderX: motionState.leftShoulderX ?? 0.5,
    leftWristDeltaX: motionState.leftWristDeltaX ?? 0,
    leftWristMinusShoulder: motionState.leftWristMinusShoulder ?? 0,
    armTurnDistanceThreshold: ARM_TURN_DISTANCE_THRESHOLD,
    armTurnTestThreshold: ARM_TURN_DISTANCE_THRESHOLD,
    rawLeftWristX: motionState.rawLeftWristX ?? 0.5,
    movementSmoothing: MEDIAPIPE_MOVEMENT_SMOOTHING,
    localForward: mapPlayer.localForward,
    localLateral: mapPlayer.localLateral,
    nearbyPartMapX: motionState.pickupDebug?.nearbyPartMapX ?? null,
    nearbyPartMapY: motionState.pickupDebug?.nearbyPartMapY ?? null,
    nearbyPartWorldX: motionState.pickupDebug?.nearbyPartWorldX ?? null,
    nearbyPartWorldZ: motionState.pickupDebug?.nearbyPartWorldZ ?? null,
    mapPlayerX: mapPlayer.x,
    mapPlayerY: mapPlayer.y,
    mapParts,
    nearestPartId: motionState.pickupDebug?.nearbyPartId ?? 'none',
    playerArrowRotation: mapPlayer.playerArrowRotation,
    playerMapX: motionState.pickupDebug?.playerMapX ?? mapPlayer.x,
    playerMapY: motionState.pickupDebug?.playerMapY ?? mapPlayer.y,
    playerPickupWorldX: motionState.pickupDebug?.playerPickupWorldX ?? mapPlayer.worldX,
    playerPickupWorldZ: motionState.pickupDebug?.playerPickupWorldZ ?? mapPlayer.worldZ,
    occlusionCameraInsideBuilding: occlusionState?.debug?.cameraInsideBuilding ?? false,
    occlusionFadedCount: occlusionState?.debug?.fadedCount ?? 0,
    occlusionFadedIds: occlusionState?.debug?.fadedIds ?? [],
    occlusionMode: occlusionState?.debug?.mode ?? BUILDING_OCCLUSION_MODE,
    poseDebugMode: POSE_DEBUG_MODE,
    poseMode: POSE_MODE,
    poseMirrorX: POSE_MIRROR_X,
    screenLeftKneeSource: motionState.screenLeftKneeSource ?? 'none',
    screenLeftWristSource: motionState.screenLeftWristSource ?? 'none',
    screenRightKneeSource: motionState.screenRightKneeSource ?? 'none',
    rightWristAvatarX: motionState.rightWristAvatarX ?? 0,
    rightArmDetected: motionState.rightArmExtendedRaw ?? false,
    rightArmDistance: motionState.rightArmDistance ?? 0,
    rightArmExtended: motionState.rightArmOut ?? false,
    rightArmExtendedRaw: motionState.rightArmExtendedRaw ?? false,
    rightArmOut: motionState.rightArmOut ?? false,
    rightHoldMs: motionState.rightHoldMs ?? 0,
    rightShoulderX: motionState.rightShoulderX ?? 0.5,
    rightWristDeltaX: motionState.rightWristDeltaX ?? 0,
    rightWristMinusShoulder: motionState.rightWristMinusShoulder ?? 0,
    rawRightWristX: motionState.rawRightWristX ?? 0.5,
    screenRightWristSource: motionState.screenRightWristSource ?? 'none',
    swipeLeftDetected: motionState.swipeLeftDetected ?? false,
    swipeRightDetected: motionState.swipeRightDetected ?? false,
    trackingStable: Boolean(tracking?.motion?.trackingStable),
    turnSource: motionState.turnSource ?? 'none',
    turnGestureActive: Boolean(motionState.turnGestureActive),
    yawInfluence: AVATAR_YAW_INFLUENCE,
    scrolling: motionState.scrolling,
    smoothedSpeed: motionState.smoothedSpeed,
    playerWorldX: motionState.playerWorldX,
    playerWorldZ: motionState.playerWorldZ,
    distanceToNearestPart: motionState.pickupDebug?.pickupDistance ?? null,
    distancePlayerToNearbyPartOnMap: motionState.pickupDebug?.distancePlayerToNearbyPartOnMap ?? null,
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
  const mapParts = parts.map((part) => getPartMapData(part))
  motionState.mapPartDebug = mapParts.map((part) => ({
    areaId: part.areaId,
    id: part.id,
    mapX: part.mapX,
    mapY: part.mapY,
    worldX: part.worldX,
    worldZ: part.worldZ,
  }))

  onMapData({
    areaId: motionState.currentAreaId,
    player: getMapPlayerPosition(motionState),
    parts: mapParts,
    transitionLabel: motionState.transitionLabelUntil > elapsed ? motionState.transitionLabel : '',
    turnHint: motionState.turnHint,
  })
}

function getPartMapData(part) {
  const partPickupWorldPosition = getPartPickupWorldPosition(part)

  return {
    collected: part.collected,
    id: part.id,
    label: part.label,
    ...partToMapMarker({
      ...part,
      x: partPickupWorldPosition.x,
      z: partPickupWorldPosition.z,
    }),
  }
}

function getMapPlayerPosition(motionState) {
  const worldPosition = getPlayerPickupWorldPosition(motionState)
  const mapPosition = playerToMapMarker({
    areaId: motionState.currentAreaId,
    currentHeading: motionState.currentHeading,
    worldX: worldPosition.x,
    worldZ: worldPosition.z,
  })

  return {
    areaId: mapPosition.areaId,
    localForward: mapPosition.localForward,
    localLateral: mapPosition.localLateral,
    mapX: mapPosition.mapX,
    mapY: mapPosition.mapY,
    playerArrowRotation: mapPosition.playerArrowRotation,
    progress: mapPosition.y,
    side: getStreetSideLabel(mapPosition.localLateral),
    sidePosition: mapPosition.x,
    worldX: worldPosition.x,
    worldZ: worldPosition.z,
    x: mapPosition.x,
    y: mapPosition.y,
  }
}

function getWorldMapPlayerPosition(motionState) {
  const worldPosition = getPlayerPickupWorldPosition(motionState)

  return playerToMapMarker({
    areaId: motionState.currentAreaId,
    currentHeading: motionState.currentHeading,
    worldX: worldPosition.x,
    worldZ: worldPosition.z,
  })
}

function getPlayerPickupWorldPosition(motionState) {
  const pickupWorldX = motionState.pickupDebug?.playerPickupWorldX
  const pickupWorldZ = motionState.pickupDebug?.playerPickupWorldZ

  if (Number.isFinite(pickupWorldX) && Number.isFinite(pickupWorldZ)) {
    return {
      x: pickupWorldX,
      z: pickupWorldZ,
    }
  }

  return getAvatarWorldMapPosition(motionState)
}

function getAvatarWorldMapPosition(motionState) {
  const avatarScenePosition = getAvatarScenePickupPosition(motionState)

  return {
    x: motionState.playerWorldX + avatarScenePosition.x,
    z: motionState.playerWorldZ + avatarScenePosition.z,
  }
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

function normalizeAngle(angle) {
  return Math.atan2(Math.sin(angle), Math.cos(angle))
}

function snapHeadingToQuarter(angle) {
  const quarterTurn = Math.PI / 2

  return normalizeAngle(Math.round(normalizeAngle(angle) / quarterTurn) * quarterTurn)
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

  pickupState.debug = avatarMotion.pickupDebug
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
    publishPickupDebug(pickupState, onPickupDebug, handsLow, nearbyPart, bikeParts.parts, elapsed, true)
    return
  }

  if (pickupState.gestureState === 'hands down' && !handsLow) {
    collectNearbyPart(nearbyPart, bikeParts, avatar, pickupState, elapsed)
    publishPickupDebug(pickupState, onPickupDebug, handsLow, nearbyPart, bikeParts.parts, elapsed, true)
    return
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
  let nearestCalibration = null
  let nearestDistance = Infinity
  const worldOffsetX = -avatarMotion.playerWorldX
  const worldOffsetZ = (-avatarMotion.playerWorldZ) % STREET_REPEAT
  const avatarScenePosition = getAvatarScenePickupPosition(avatarMotion)
  let handlebarDebug = null

  for (const part of parts) {
    const partPickupWorldPosition = getPartPickupWorldPosition(part)
    const visibleZ = partPickupWorldPosition.z + worldOffsetZ
    const visibleX = partPickupWorldPosition.x + worldOffsetX
    const dx = visibleX - avatarScenePosition.x
    const dz = visibleZ - avatarScenePosition.z
    const distance = Math.hypot(dx * 0.9, dz)
    const playerPickupWorldPosition = getPlayerPickupWorldPositionFromSceneDelta(partPickupWorldPosition, dx, dz)

    if (part.id === 'handlebar') {
      handlebarDebug = {
        distance,
        sceneX: visibleX,
        sceneZ: visibleZ,
      }
    }

    if (part.collected || (part.areaId ?? 'mainStreet') !== avatarMotion.currentAreaId) {
      continue
    }

    if (Math.abs(dx) < 1.45 && Math.abs(dz) < 2.2 && distance < nearestDistance) {
      nearest = part
      nearestCalibration = {
        areaId: part.areaId ?? 'mainStreet',
        dx,
        dz,
        partWorldX: partPickupWorldPosition.x,
        partWorldZ: partPickupWorldPosition.z,
        playerWorldX: playerPickupWorldPosition.x,
        playerWorldZ: playerPickupWorldPosition.z,
      }
      nearestDistance = distance
    }
  }

  const nearestPartMapPosition = nearestCalibration
    ? partToMapMarker({
      areaId: nearestCalibration.areaId,
      x: nearestCalibration.partWorldX,
      z: nearestCalibration.partWorldZ,
    })
    : null
  const playerMapPosition = nearestCalibration
    ? playerToMapMarker({
      areaId: avatarMotion.currentAreaId,
      currentHeading: avatarMotion.currentHeading,
      worldX: nearestCalibration.playerWorldX,
      worldZ: nearestCalibration.playerWorldZ,
    })
    : null
  const distancePlayerToNearbyPartOnMap = nearestPartMapPosition && playerMapPosition
    ? Math.hypot(playerMapPosition.mapX - nearestPartMapPosition.mapX, playerMapPosition.mapY - nearestPartMapPosition.mapY)
    : null

  avatarMotion.pickupDebug = {
    avatarSceneX: avatarScenePosition.x,
    avatarSceneZ: avatarScenePosition.z,
    currentAreaId: avatarMotion.currentAreaId,
    distancePlayerToNearbyPartOnMap,
    handlebarDistance: handlebarDebug?.distance ?? null,
    handlebarSceneX: handlebarDebug?.sceneX ?? null,
    handlebarSceneZ: handlebarDebug?.sceneZ ?? null,
    nearbyPartMapX: nearestPartMapPosition?.mapX ?? null,
    nearbyPartMapY: nearestPartMapPosition?.mapY ?? null,
    nearbyPartWorldX: nearestCalibration?.partWorldX ?? null,
    nearbyPartWorldZ: nearestCalibration?.partWorldZ ?? null,
    nearbyPartId: nearest?.id ?? 'none',
    playerMapX: playerMapPosition?.mapX ?? null,
    playerMapY: playerMapPosition?.mapY ?? null,
    playerPickupWorldX: nearestCalibration?.playerWorldX ?? null,
    playerPickupWorldZ: nearestCalibration?.playerWorldZ ?? null,
    pickupDistance: Number.isFinite(nearestDistance) ? nearestDistance : null,
  }

  return nearest
}

function getPartPickupWorldPosition(part) {
  return {
    x: part.x,
    z: part.z,
  }
}

function getPlayerPickupWorldPositionFromSceneDelta(partWorldPosition, dx, dz) {
  return {
    x: partWorldPosition.x - dx,
    z: partWorldPosition.z - dz,
  }
}

function getAvatarScenePickupPosition(avatarMotion) {
  const right = rightVectorFromHeading(avatarMotion.currentHeading)

  return {
    x: right.x * avatarMotion.lateralOffset,
    z: avatarMotion.z + right.z * avatarMotion.lateralOffset,
  }
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

function publishPickupDebug(pickupState, onPickupDebug, handsLow, nearbyPart, parts, elapsed, force = false) {
  if (!onPickupDebug || (!force && elapsed - pickupState.lastDebugAt < 0.1)) {
    return
  }

  pickupState.lastDebugAt = elapsed
  if (pickupState.feedbackUntil <= elapsed) {
    pickupState.feedback = ''
    if (pickupState.gestureState === 'collected') {
      pickupState.gestureState = 'waiting'
    }
  }

  const collectedCount = parts.filter((part) => part.collected).length
  const totalParts = parts.length

  onPickupDebug({
    collectedCount,
    debug: pickupState.debug ?? null,
    feedback: pickupState.feedback,
    gestureState: pickupState.gestureState,
    handsLow,
    isComplete: totalParts > 0 && collectedCount === totalParts,
    nearbyPart: nearbyPart && !nearbyPart.collected ? nearbyPart.label : 'none',
    parts: parts.map((part) => ({
      collected: part.collected,
      id: part.id,
      label: part.label,
    })),
    totalParts,
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
    keys.turnAround = value
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

function createMansardRoof(width, depth, height, color) {
  const group = new THREE.Group()
  const roof = new THREE.Mesh(
    new THREE.BoxGeometry(width, height, depth),
    paperMaterial(color, { repeatX: 1.4, repeatY: 0.7 })
  )
  const cap = new THREE.Mesh(
    new THREE.BoxGeometry(width * 0.92, 0.08, depth * 1.04),
    paperMaterial(tintColor(color, 0xffffff, 0.1), { repeatX: 1.2, repeatY: 0.5 })
  )

  roof.position.y = height * 0.42
  cap.position.y = height * 0.86
  addOutlined(group, roof, 0.012)
  addOutlined(group, cap, 0.005)

  for (let i = -1; i <= 1; i += 2) {
    const chimney = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.38, 0.17), paperMaterial(0xeee5d8))

    chimney.position.set(i * width * 0.28, height + 0.1, -depth * 0.18)
    addOutlined(group, chimney, 0.005)
  }

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

function addPavingPattern(scene, width, length, x, z, y) {
  const stoneA = material(0xf5e8d4)
  const stoneB = material(0xd8c9b7)
  const stoneC = material(0xe8d4be)
  const seamMaterial = material(0xcfbea9)
  const rows = PERFORMANCE_MODE ? 5 : 9
  const seamCount = PERFORMANCE_MODE ? 10 : 34
  const stoneCount = PERFORMANCE_MODE ? 11 : 34

  for (let row = 1; row < rows; row += 1) {
    const seam = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.014, length * 0.92), seamMaterial)

    seam.position.set(x - width / 2 + row * (width / rows), y + 0.002, z)
    seam.rotation.y = ((row % 3) - 1) * 0.006
    scene.add(seam)
  }

  for (let i = 0; i < seamCount; i += 1) {
    const cross = new THREE.Mesh(new THREE.BoxGeometry(width * (0.48 + (i % 3) * 0.12), 0.013, 0.024), seamMaterial)

    cross.position.set(x + ((i % 5) - 2) * 0.08, y + 0.003, z + length / 2 - 1.6 - i * (PERFORMANCE_MODE ? 11.2 : 3.1))
    cross.rotation.y = ((i % 7) - 3) * 0.015
    scene.add(cross)
  }

  for (let row = 0; row < rows; row += 1) {
    for (let i = 0; i < stoneCount; i += 1) {
      const stone = new THREE.Mesh(
        new THREE.BoxGeometry(0.34 + (i % 4) * 0.11, 0.012, 0.035 + (row % 2) * 0.012),
        (i + row) % 6 === 0 ? stoneB : (i + row) % 5 === 0 ? stoneC : stoneA,
      )

      stone.position.set(
        x - width / 2 + 0.32 + row * (width / rows) + ((i % 3) - 1) * 0.035,
        y,
        z + length / 2 - 2.4 - i * (PERFORMANCE_MODE ? 12.8 : 4.3) - (row % 2) * 1.15,
      )
      stone.rotation.y = ((i + row) % 5 - 2) * 0.02
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
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.027, 0.04, 2.05, 8), material(0x343b3a))
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 0.16, 10), material(0x343b3a))
  const arm = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.038, 0.038), material(0x343b3a))
  const cap = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.16, 10), material(0x4f8f83))
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.13, 12, 8), paperMaterial(0xffefc1))
  const glow = new THREE.Mesh(new THREE.PlaneGeometry(0.38, 0.46), new THREE.MeshBasicMaterial({
    color: 0xfff1c7,
    opacity: 0.24,
    transparent: true,
  }))

  base.position.y = 0.08
  pole.position.y = 1.05
  arm.position.set(0.23, 2.05, 0)
  cap.position.set(0.54, 1.98, 0)
  cap.rotation.x = Math.PI
  bulb.position.set(0.54, 1.88, 0)
  glow.position.set(0.54, 1.82, -0.012)
  addOutlined(group, base, 0.006)
  addOutlined(group, pole, 0.006)
  addOutlined(group, arm, 0.006)
  addOutlined(group, cap, 0.006)
  addOutlined(group, bulb, 0.006)
  group.add(glow)

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
  const pot = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.24, 0.34), paperMaterial(0xc58d70))
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
  const paperBacking = new THREE.Mesh(new THREE.PlaneGeometry(0.98, 0.72), paperMaterial(0xfff0d7))
  const wheelA = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.018, 8, 22), tire)
  const wheelB = wheelA.clone()
  const tubeA = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.035, 0.035), frame)
  const tubeB = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.035, 0.035), frame)
  const handle = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.035, 0.035), metal)
  const seat = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.045, 0.08), material(0x5a3f35))

  paperBacking.position.set(0, 0.36, -0.035)
  wheelA.position.set(-0.28, 0.22, 0)
  wheelB.position.set(0.28, 0.22, 0)
  tubeA.position.set(0, 0.35, 0)
  tubeA.rotation.z = -0.28
  tubeB.position.set(-0.02, 0.48, 0)
  tubeB.rotation.z = 0.36
  handle.position.set(0.42, 0.56, 0)
  handle.rotation.z = 0.35
  seat.position.set(-0.15, 0.58, 0)

  addOutlined(group, paperBacking, 0.004)
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
  return paperMaterial(color)
}

function createPaperSkyTexture() {
  const canvas = document.createElement('canvas')
  const context = canvas.getContext('2d')

  canvas.width = 512
  canvas.height = 512
  if (!context) {
    return new THREE.Color(0xf5dcca)
  }

  const gradient = context.createLinearGradient(0, 0, 0, canvas.height)

  gradient.addColorStop(0, '#f6d8c8')
  gradient.addColorStop(0.62, '#f5decc')
  gradient.addColorStop(1, '#ead7c3')
  context.fillStyle = gradient
  context.fillRect(0, 0, canvas.width, canvas.height)

  for (let i = 0; i < 180; i += 1) {
    const alpha = i % 3 === 0 ? 0.16 : 0.08

    context.strokeStyle = i % 2 === 0
      ? `rgba(255, 250, 240, ${alpha})`
      : `rgba(130, 103, 92, ${alpha})`
    context.lineWidth = 1 + (i % 4)
    context.beginPath()
    context.moveTo((i * 37) % canvas.width, (i * 61) % canvas.height)
    context.lineTo(((i * 37) % canvas.width) + 80 + (i % 6) * 24, ((i * 61) % canvas.height) + ((i % 9) - 4) * 9)
    context.stroke()
  }

  const texture = new THREE.CanvasTexture(canvas)

  texture.colorSpace = THREE.SRGBColorSpace

  return texture
}

function paperMaterial(color, options = {}) {
  return new THREE.MeshLambertMaterial({
    color,
    map: getPaintTexture(color, options),
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

function getPaintTexture(color, options = {}) {
  const repeatX = options.repeatX ?? 2
  const repeatY = options.repeatY ?? 2
  const cacheKey = `${color}-${repeatX}-${repeatY}`

  if (textureCache.has(cacheKey)) {
    return textureCache.get(cacheKey)
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
  texture.repeat.set(repeatX, repeatY)
  texture.colorSpace = THREE.SRGBColorSpace
  textureCache.set(cacheKey, texture)

  return texture
}

function tintColor(color, target, amount) {
  return new THREE.Color(color).lerp(new THREE.Color(target), amount).getHex()
}
