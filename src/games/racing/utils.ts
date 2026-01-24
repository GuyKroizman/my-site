// Format time as seconds.tenths
export const formatTime = (time: number): string => {
  const seconds = Math.floor(time)
  const tenths = Math.floor((time - seconds) * 10)
  return `${seconds}.${tenths}`
}
