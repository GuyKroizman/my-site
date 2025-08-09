export type HootGameContext = {
  scene: Phaser.Scene | undefined;
  balls: Phaser.GameObjects.GameObject[];
};

export const hootContext: HootGameContext = {
  scene: undefined,
  balls: []
}; 