export interface TouchDriveState {
  throttle: number
  steering: number
}

export const NEUTRAL_TOUCH_DRIVE_STATE: TouchDriveState = {
  throttle: 0,
  steering: 0,
}
