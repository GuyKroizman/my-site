export const isMobileBrowser = (): boolean =>
  /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)

export const isIPhoneBrowser = (): boolean =>
  /iPhone|iPad|iPod/i.test(navigator.userAgent)

export const isLocalViteDev = (): boolean => import.meta.env.DEV

export const canUseLocalDesktopRacingDebug = (): boolean =>
  isLocalViteDev() && !isMobileBrowser()
