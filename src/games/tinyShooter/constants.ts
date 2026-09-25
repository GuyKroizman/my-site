export const GROUND_SIZE = 200
// The visible ground extends well past the playable arena so its edge fades
// into the distance fog instead of ending in a hard line against the sky.
export const VISUAL_GROUND_SIZE = 800

export const PLAYER_HEIGHT = 1.7
export const PLAYER_BODY_RADIUS = 0.4
export const PLAYER_MASS = 80
export const PLAYER_SPEED = 8
export const PLAYER_MAX_HEALTH = 100

export const PHYSICS_DT = 1 / 60
export const PHYSICS_SUBSTEPS = 3

export const PROJECTILE_SPEED = 120
export const PROJECTILE_RADIUS = 1
export const PROJECTILE_LENGTH = 20
export const PROJECTILE_VISUAL_RADIUS = 0.1
export const PROJECTILE_LIFETIME = 8
export const MAX_PROJECTILES = 50
export const SHOOT_COOLDOWN = 0.5

// Where the shot leaves the player, in camera-local space (right, down,
// forward). Keeping it off-center means the bolt never overlaps the camera.
export const MUZZLE_OFFSET_X = 0.35
export const MUZZLE_OFFSET_Y = -0.3
export const MUZZLE_OFFSET_Z = -0.6
// Distance down the crosshair ray that the muzzle converges on, so shots from
// the off-center muzzle still fly toward what the player is aiming at.
export const PROJECTILE_AIM_DISTANCE = 100

export const MOUSE_SENSITIVITY = 0.002
export const GAMEPAD_DEADZONE = 0.2
export const GAMEPAD_LOOK_SPEED = 0.06
export const RADAR_RANGE_ARENA_FACTOR = 0.25
