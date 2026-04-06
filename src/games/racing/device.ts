export const isTouchDevice = (): boolean => 'ontouchstart' in window || navigator.maxTouchPoints > 0

export const isLandscape = (): boolean => window.innerWidth > window.innerHeight

export const isPortrait = (): boolean => window.innerHeight > window.innerWidth

export const isMobileLandscape = (): boolean => isTouchDevice() && isLandscape()
