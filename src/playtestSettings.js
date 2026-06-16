export const DEFAULT_PLAYTEST_SETTINGS = {
  assemblySnapRadiusMultiplier: 1,
  deselectTimeoutMs: 950,
  handReachSmoothing: 1,
  pickupScreenRadiusMultiplier: 1,
  showHandMarker: true,
  showPickupDebug: false,
}

export function createInitialPlaytestSettings() {
  if (typeof window === 'undefined') {
    return DEFAULT_PLAYTEST_SETTINGS
  }

  return {
    ...DEFAULT_PLAYTEST_SETTINGS,
    showPickupDebug:
      window.location.search.includes('pickupDebug=1') ||
      window.localStorage.getItem('pickupDebug') === '1',
  }
}
