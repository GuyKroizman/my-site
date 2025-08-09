import Phaser from "phaser";
import type { HootGameContext } from "./context";

export class HootGameScene extends Phaser.Scene {
  context: HootGameContext;
  private player!: Phaser.GameObjects.Container;
  private playerHealth: number = 100;
  private leftPupil!: Phaser.GameObjects.Shape;
  private rightPupil!: Phaser.GameObjects.Shape;
  private pupilUpdateTimer: number = 0;
  private pupilUpdateInterval: number = 4000; // 4 seconds in milliseconds
  private bullets: Phaser.GameObjects.Shape[] = [];
  private enemies: Phaser.GameObjects.Rectangle[] = [];
  private enemyHealths: Map<Phaser.GameObjects.Rectangle, number> = new Map();
  private enemy2: Phaser.GameObjects.Container | null = null;
  private enemy2Mode: 'chase' | 'avoid' = 'chase';
  private enemy2Speed: number = 1;
  private enemy2AvoidSpeed: number = 4; // Twice as fast when avoiding
  private lastShootTime: number = 0;
  private shootCooldown: number = 500; // 500ms = 0.5 seconds
  private gameOver: boolean = false;
  private healthText!: Phaser.GameObjects.Text;
  private gameOverText!: Phaser.GameObjects.Text;
  private stageText!: Phaser.GameObjects.Text;
  private congratulationsText!: Phaser.GameObjects.Text;
  private playerDirection: number = 0; // 0 = right, 1 = down, 2 = left, 3 = up
  private keys: { [key: string]: boolean } = {}; // Track key states
  private enemySpeed: number = 2; // Speed at which enemies advance toward player (doubled from 1)
  private explosionRadius: number = 50; // Proximity for explosion
  private explosionDamage: number = 50; // Damage from explosion
  private currentStage: number = 1;
  private stageConfigs = [
    { enemies: 1, balls: 1 }, // Stage 1
    { enemies: 4, balls: 2 }, // Stage 2
    { enemies: 14, balls: 4 }, // Stage 3 (4 balls size 60)
    { enemies: 1, balls: 2 }, // Stage 4 (1 smart enemy, 2 big balls)
  ];
  private isTransitioning: boolean = false; // Flag to prevent premature stage completion
  private gameState: 'menu' | 'playing' | 'gameOver' = 'menu'; // Game state management
  private menuTitle!: Phaser.GameObjects.Text;
  private menuSubtitle!: Phaser.GameObjects.Text;
  private gmtkText!: Phaser.GameObjects.Text;
  private creditsText!: Phaser.GameObjects.Text;
  private instructionsText!: Phaser.GameObjects.Text;
  private menuPlayer!: Phaser.GameObjects.Container;
  private menuEnemy!: Phaser.GameObjects.Rectangle;
  private menuBall!: Phaser.GameObjects.Shape;
  private menuPlayerLabel!: Phaser.GameObjects.Text;
  private menuEnemyLabel!: Phaser.GameObjects.Text;
  private menuBallLabel!: Phaser.GameObjects.Text;
  private dottedBorder: Phaser.GameObjects.Graphics | null = null; // Track dotted border
  private isStageFrozen: boolean = false; // Freeze state for stage transitions
  private freezeCountdownText!: Phaser.GameObjects.Text;
  private freezeTimer: number = 0; // Timer for freeze countdown
  private stageStartTime: number = 0; // Track when stage started
  private stageTimeText!: Phaser.GameObjects.Text;
  private deathMessages = [
    "I guess your school teachers were right - you are a failure.",
    "Don't quit your day job - maybe this isn't for you.",
    "Now I know AI will definitely take over the world. You poor excuse for a human."
  ];
  private playerSize: number = 15; // Player size (width and height)
  private debugLevel: number = 0; // 0 = normal game, 1-4 = start at specific level

  constructor(context: HootGameContext) {
    super("hoot-game-scene");
    this.context = context;
  }

  preload() {
    // Load sound assets
    this.load.audio('shoot', '/hoot-sounds/Shoot.wav');
    this.load.audio('shotHitBall', '/hoot-sounds/Shot Hit Ball.wav');
    this.load.audio('shotHitEnemy', '/hoot-sounds/Shot Hit Enemy.wav');
    this.load.audio('enemyDie', '/hoot-sounds/Enemy die.wav');
    this.load.audio('ballHitWall', '/hoot-sounds/Ball Hit Wall.wav');
    this.load.audio('ballHitBall1', '/hoot-sounds/Ball Hit Ball1.wav');
    this.load.audio('ballHitBall2', '/hoot-sounds/Ball Hit Ball2.wav');
    this.load.audio('ballHitBall3', '/hoot-sounds/Ball Hit Ball3.wav');

    // Load background music
    this.load.audio('backgroundMusic', '/hoot-sounds/music for loop 2.wav');
  }

  create() {
    if (!this.context) {
      console.error("Context is undefined!");
      return;
    }
    this.context.scene = this;

    // Create complex background
    this.createComplexBackground();

    // Create border
    this.createBorder();

    // Create UI
    this.createUI();

    // Setup input
    this.setupInput();

    // Show menu initially
    this.showMenu();
  }

  createBorder() {
    const graphics = this.add.graphics();
    graphics.lineStyle(4, 0xffffff);
    graphics.strokeRect(10, 10, this.cameras.main.width - 20, this.cameras.main.height - 20);
  }

  createDottedBorder() {
    // Create dotted rectangle border for balls only on level 4 (130px smaller than screen)
    const borderOffset = 130; // 130px total smaller = 65px on each side
    this.dottedBorder = this.add.graphics();
    this.dottedBorder.lineStyle(2, 0x00ff00, 0.7);

    // Create dotted line effect
    const dashLength = 10;
    const gapLength = 5;
    const totalDash = dashLength + gapLength;

    // Top border
    for (let x = borderOffset; x < this.cameras.main.width - borderOffset; x += totalDash) {
      this.dottedBorder.beginPath();
      this.dottedBorder.moveTo(x, borderOffset);
      this.dottedBorder.lineTo(Math.min(x + dashLength, this.cameras.main.width - borderOffset), borderOffset);
      this.dottedBorder.strokePath();
    }

    // Bottom border
    for (let x = borderOffset; x < this.cameras.main.width - borderOffset; x += totalDash) {
      this.dottedBorder.beginPath();
      this.dottedBorder.moveTo(x, this.cameras.main.height - borderOffset);
      this.dottedBorder.lineTo(Math.min(x + dashLength, this.cameras.main.width - borderOffset), this.cameras.main.height - borderOffset);
      this.dottedBorder.strokePath();
    }

    // Left border
    for (let y = borderOffset; y < this.cameras.main.height - borderOffset; y += totalDash) {
      this.dottedBorder.beginPath();
      this.dottedBorder.moveTo(borderOffset, y);
      this.dottedBorder.lineTo(borderOffset, Math.min(y + dashLength, this.cameras.main.height - borderOffset));
      this.dottedBorder.strokePath();
    }

    // Right border
    for (let y = borderOffset; y < this.cameras.main.height - borderOffset; y += totalDash) {
      this.dottedBorder.beginPath();
      this.dottedBorder.moveTo(this.cameras.main.width - borderOffset, y);
      this.dottedBorder.lineTo(this.cameras.main.width - borderOffset, Math.min(y + dashLength, this.cameras.main.height - borderOffset));
      this.dottedBorder.strokePath();
    }
  }

  createComplexBackground() {
    const graphics = this.add.graphics();
    const width = this.cameras.main.width;
    const height = this.cameras.main.height;

    // 1. Base Color - Slightly less bright pale neutral shade
    const baseColor = 0xF0F3F6; // Slightly darker blue-white

    // Fill the entire background with base color
    graphics.fillStyle(baseColor);
    graphics.fillRect(0, 0, width, height);

    // 2. Subtle Noise Texture Layer
    graphics.fillStyle(0xE8EBEE, 0.08); // Slightly darker with low opacity

    // Create sparse, soft noise pattern
    for (let i = 0; i < 200; i++) {
      const x = Math.random() * width;
      const y = Math.random() * height;
      const size = 2 + Math.random() * 4; // 2-6px dots

      graphics.fillCircle(x, y, size);
    }

    // Add some larger, very soft blotches
    graphics.fillStyle(0xE5E8EB, 0.05); // Slightly darker with very low opacity
    for (let i = 0; i < 50; i++) {
      const x = Math.random() * width;
      const y = Math.random() * height;
      const size = 8 + Math.random() * 15; // 8-23px blotches

      graphics.fillCircle(x, y, size);
    }

    // 3. Gradient Overlay - Very soft radial gradient
    const gradient = this.add.graphics();
    gradient.fillStyle(0xE8EBEE, 0.03); // Slightly darker white overlay
    gradient.fillCircle(width / 2, height / 2, Math.max(width, height) * 0.8);

    // Add a second, even more subtle gradient
    gradient.fillStyle(0xE0E3E6, 0.02); // Slightly darker blue tint
    gradient.fillCircle(width / 2, height / 2, Math.max(width, height) * 0.6);

    // 4. Soft Grid Pattern (optional)
    graphics.lineStyle(1, 0xE8EBEE, 0.03); // Slightly darker lines
    const gridSpacing = 100;

    // Vertical lines
    for (let x = 0; x <= width; x += gridSpacing) {
      graphics.beginPath();
      graphics.moveTo(x, 0);
      graphics.lineTo(x, height);
      graphics.strokePath();
    }

    // Horizontal lines
    for (let y = 0; y <= height; y += gridSpacing) {
      graphics.beginPath();
      graphics.moveTo(0, y);
      graphics.lineTo(width, y);
      graphics.strokePath();
    }
  }

  createPlayer() {
    // Create a container for the complex player object
    let playerX = this.cameras.main.width / 2;
    let playerY = this.cameras.main.height / 2;

    // For level 4, position player at x=80 and y=half screen height
    if (this.currentStage === 4) {
      playerX = 80;
      playerY = this.cameras.main.height / 2;
    }

    this.player = this.add.container(playerX, playerY);

    // Array to hold all player shapes
    const playerShapes: Phaser.GameObjects.GameObject[] = [];

    // Create the main brown capsule body using graphics
    const bodyGraphics = this.add.graphics();
    bodyGraphics.fillStyle(0x8B4513); // Brown color
    bodyGraphics.fillRoundedRect(-this.playerSize / 2, -this.playerSize / 2, this.playerSize, this.playerSize, this.playerSize / 2);
    playerShapes.push(bodyGraphics);



    const eyeSize = 5;
    const cornerOffset = (this.playerSize / 2) - 3;
    const leftEye = this.add.circle(-cornerOffset, -cornerOffset, eyeSize, 0xffff00);
    const rightEye = this.add.circle(cornerOffset, -cornerOffset, eyeSize, 0xffff00);
    playerShapes.push(leftEye);
    playerShapes.push(rightEye);

    const pupilSize = 2;
    const leftPupil = this.add.circle(-cornerOffset, -cornerOffset, pupilSize, 0x000000);
    const rightPupil = this.add.circle(cornerOffset, -cornerOffset, pupilSize, 0x000000);

    // Store references to pupils for updating their positions
    this.leftPupil = leftPupil;
    this.rightPupil = rightPupil;

    playerShapes.push(leftPupil);
    playerShapes.push(rightPupil);

    this.player.add(playerShapes);

    // Initialize pupil direction
    this.updatePupilDirection();
  }

  createBalls() {
    const currentConfig = this.stageConfigs[this.currentStage - 1];
    const ballCount = currentConfig.balls;

    // Clear existing balls
    this.context.balls.forEach(ball => ball.destroy());
    this.context.balls = [];

    // Create balls based on stage configuration
    for (let i = 0; i < ballCount; i++) {
      let ballRadius = 36; // Default radius for stages 1 and 2

      // Stage 3 has all balls the same size
      if (this.currentStage === 3) {
        ballRadius = 60; // All 4 balls are size 60
      }

      // Stage 4 has 2 big slow balls
      if (this.currentStage === 4) {
        ballRadius = 80; // Big balls for stage 4
      }

      // Position balls around the player for stage 3
      let ballX, ballY;
      if (this.currentStage === 3) {
        // For stage 3, position balls around the player
        const playerX = this.cameras.main.width / 2;
        const playerY = this.cameras.main.height / 2;

        switch (i) {
          case 0: // Ball above player
            ballX = playerX;
            ballY = playerY - 90;
            break;
          case 1: // Ball below player
            ballX = playerX;
            ballY = playerY + 90;
            break;
          case 2: // Ball to the right of player
            ballX = playerX + 90;
            ballY = playerY;
            break;
          case 3: // Ball to the left of player
            ballX = playerX - 90;
            ballY = playerY;
            break;
          default:
            ballX = playerX;
            ballY = playerY;
        }
      } else if (this.currentStage === 4) {
        // For stage 4, position balls 100 pixels to each side of player
        const playerX = this.cameras.main.width / 2;
        const playerY = this.cameras.main.height / 2;

        if (i === 0) {
          ballX = playerX - 100; // Left side
          ballY = playerY;
        } else {
          ballX = playerX + 100; // Right side
          ballY = playerY;
        }
      } else {
        // For other stages, use random positioning
        ballX = 100 + Math.random() * (this.cameras.main.width - 200);
        ballY = 50 + Math.random() * (this.cameras.main.height - 100);
      }

      // Create a pretty ball with gradient, glow, and animation
      const ball = this.createPrettyBall(ballX, ballY, ballRadius);

      // Add custom physics properties with specific directions for stage 3
      let velocityX, velocityY;
      if (this.currentStage === 3) {
        // Stage 3 has specific slow directions for each ball
        const slowSpeed = 1; // Slow speed
        switch (i) {
          case 0: // Ball above player - move upward
            velocityX = 0;
            velocityY = -slowSpeed;
            break;
          case 1: // Ball below player - move downward
            velocityX = 0;
            velocityY = slowSpeed;
            break;
          case 2: // Ball to the right of player - move rightward
            velocityX = slowSpeed;
            velocityY = 0;
            break;
          case 3: // Ball to the left of player - move leftward
            velocityX = -slowSpeed;
            velocityY = 0;
            break;
          default:
            velocityX = (Math.random() - 0.5) * 4;
            velocityY = (Math.random() - 0.5) * 4;
        }
      } else if (this.currentStage === 4) {
        // Stage 4 has slow big balls with specific initial directions
        const slowSpeed = 0.5; // Very slow speed for big balls
        if (i === 0) {
          // Left ball moves left
          velocityX = -slowSpeed;
          velocityY = 0;
        } else {
          // Right ball moves right
          velocityX = slowSpeed;
          velocityY = 0;
        }
      } else {
        // Random velocity for other stages
        velocityX = (Math.random() - 0.5) * 4;
        velocityY = (Math.random() - 0.5) * 4;
      }

      (ball as any).velocityX = velocityX;
      (ball as any).velocityY = velocityY;
      (ball as any).mass = 2;
      (ball as any).radius = ballRadius; // Updated radius to match visual size

      this.context.balls.push(ball);
    }
  }

  createPrettyBall(x: number, y: number, radius: number) {
    // Create a container for the ball and its effects
    const ballContainer = this.add.container(x, y);
    
    // Create the main ball with gradient effect
    const ballGraphics = this.add.graphics();
    
    // Create gradient effect (outer to inner)
    const gradientSteps = 5;
    for (let i = 0; i < gradientSteps; i++) {
      const currentRadius = radius - (i * radius / gradientSteps);
      const alpha = 1 - (i * 0.15); // Fade from outer to inner
      
      // Color gradient from bright red to darker red
      const color = 0xff0000 + (i * 0x110000); // Darken the red
      
      ballGraphics.fillStyle(color, alpha);
      ballGraphics.fillCircle(0, 0, currentRadius);
    }
    
    // Add highlight (reflection effect)
    const highlightGraphics = this.add.graphics();
    highlightGraphics.fillStyle(0xffffff, 0.3);
    highlightGraphics.fillCircle(-radius * 0.3, -radius * 0.3, radius * 0.4);
    
    // Add glow effect
    const glowGraphics = this.add.graphics();
    glowGraphics.fillStyle(0xff6666, 0.2);
    glowGraphics.fillCircle(0, 0, radius * 1.2);
    
    // Add all graphics to container
    ballContainer.add(ballGraphics);
    ballContainer.add(highlightGraphics);
    ballContainer.add(glowGraphics);
    
    // Add pulsing animation
    this.tweens.add({
      targets: ballContainer,
      scaleX: 1.1,
      scaleY: 1.1,
      duration: 2000,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
    });
    
    // Add rotation animation
    this.tweens.add({
      targets: ballContainer,
      angle: 360,
      duration: 8000,
      repeat: -1,
      ease: 'Linear'
    });
    
    // Store the radius for collision detection
    (ballContainer as any).radius = radius;
    
    return ballContainer;
  }

  createEnemy2() {
    // Create enemy2 container
    this.enemy2 = this.add.container(80, 80); // Start further from edges to account for larger size

    // Array to hold all enemy2 shapes
    const enemy2Shapes: Phaser.GameObjects.Shape[] = [];

    // Create the main green rectangle body (4x bigger: 30x30 -> 120x120)
    const body = this.add.rectangle(0, 0, 120, 120, 0x00ff00); // Green rectangle
    enemy2Shapes.push(body);

    // Create diagonal red eyebrows as rectangles - meaner look (4x bigger)
    const eyebrowWidth = 40; // 4x bigger: 10 -> 40
    const eyebrowHeight = 16; // 4x bigger: 4 -> 16
    const leftEyebrowY = -32 - 24; // 4x bigger: -8-6 -> -32-24
    const rightEyebrowY = -32 - 24; // 4x bigger: -8-6 -> -32-24

    // Left eyebrow - slopes down toward center
    const leftEyebrow = this.add.rectangle(16 + eyebrowWidth / 2, leftEyebrowY, eyebrowWidth, eyebrowHeight, 0xff0000); // 4x bigger: 4 -> 16
    leftEyebrow.setRotation(-0.3); // Rotate to slope down toward center

    // Right eyebrow - slopes down toward center
    const rightEyebrow = this.add.rectangle(-16 - eyebrowWidth / 2, rightEyebrowY, eyebrowWidth, eyebrowHeight, 0xff0000); // 4x bigger: -4 -> -16
    rightEyebrow.setRotation(0.3); // Rotate to slope down toward center

    enemy2Shapes.push(leftEyebrow);
    enemy2Shapes.push(rightEyebrow);

    // Create eyes (4x bigger)
    const eyeSize = 16; // 4x bigger: 4 -> 16
    const eyeOffset = 32; // 4x bigger: 8 -> 32
    const leftEye = this.add.circle(-eyeOffset, -eyeOffset, eyeSize, 0xffffff);
    const rightEye = this.add.circle(eyeOffset, -eyeOffset, eyeSize, 0xffffff);
    enemy2Shapes.push(leftEye);
    enemy2Shapes.push(rightEye);

    // Create pupils (always look at player) (4x bigger)
    const pupilSize = 12; // 4x bigger: 3 -> 12
    const leftPupil = this.add.circle(-eyeOffset, -eyeOffset, pupilSize, 0x000000);
    const rightPupil = this.add.circle(eyeOffset, -eyeOffset, pupilSize, 0x000000);
    enemy2Shapes.push(leftPupil);
    enemy2Shapes.push(rightPupil);

    // Add all shapes to the container
    this.enemy2.add(enemy2Shapes);

    // Store references to pupils for updating their positions
    (this.enemy2 as any).leftPupil = leftPupil;
    (this.enemy2 as any).rightPupil = rightPupil;
    (this.enemy2 as any).leftEye = leftEye;
    (this.enemy2 as any).rightEye = rightEye;
  }

  updateEnemy2Pupils() {
    if (!this.enemy2 || !this.player) return;

    // Calculate direction from enemy2 to player
    // @ts-ignore
    const dx = this.player.x - this.enemy2.x;
    // @ts-ignore
    const dy = this.player.y - this.enemy2.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance > 0) {
      // Normalize direction
      const dirX = dx / distance;
      const dirY = dy / distance;

      // Calculate pupil offset within the eye (close to perimeter) (4x bigger)
      const eyeRadius = 16; // 4x bigger: 4 -> 16
      const pupilOffset = 8; // 4x bigger: 2 -> 8
      const maxOffset = eyeRadius - 4; // 4x bigger: Leave 4px margin

      // Calculate new pupil positions (4x bigger)
      const leftEyeX = -32; // 4x bigger: -8 -> -32
      const rightEyeX = 32; // 4x bigger: 8 -> 32
      const eyeY = -32; // 4x bigger: -8 -> -32

      // Update left pupil position
      const leftPupilX = leftEyeX + (dirX * pupilOffset);
      const leftPupilY = eyeY + (dirY * pupilOffset);
      (this.enemy2 as any).leftPupil.x = Math.max(leftEyeX - maxOffset, Math.min(leftEyeX + maxOffset, leftPupilX));
      (this.enemy2 as any).leftPupil.y = Math.max(eyeY - maxOffset, Math.min(eyeY + maxOffset, leftPupilY));

      // Update right pupil position
      const rightPupilX = rightEyeX + (dirX * pupilOffset);
      const rightPupilY = eyeY + (dirY * pupilOffset);
      (this.enemy2 as any).rightPupil.x = Math.max(rightEyeX - maxOffset, Math.min(rightEyeX + maxOffset, rightPupilX));
      (this.enemy2 as any).rightPupil.y = Math.max(eyeY - maxOffset, Math.min(eyeY + maxOffset, rightPupilY));
    }
  }

  updateEnemy2() {
    if (!this.enemy2 || !this.player || this.currentStage !== 4) return;

    // Check if any ball is closer to enemy2 than the player
    let closestBallDistance = Infinity;
    let closestBall: any = null;

    this.context.balls.forEach((ball: any) => {
      if (!ball || !ball.active) return;

      // TypeScript error after site migration - ignoring for game functionality
      // @ts-ignore
      const dx = ball.x - this.enemy2.x;
      // TypeScript error after site migration - ignoring for game functionality
      // @ts-ignore
      const dy = ball.y - this.enemy2.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance < closestBallDistance) {
        closestBallDistance = distance;
        closestBall = ball;
      }
    });

    // Calculate distance to player
    // TypeScript error after site migration - ignoring for game functionality
    // @ts-ignore
    const dxToPlayer = this.player.x - this.enemy2.x;
    // TypeScript error after site migration - ignoring for game functionality
    // @ts-ignore
    const dyToPlayer = this.player.y - this.enemy2.y;
    const distanceToPlayer = Math.sqrt(dxToPlayer * dxToPlayer + dyToPlayer * dyToPlayer);

    // Determine mode based on closest ball vs player distance
    if (closestBall && closestBallDistance < distanceToPlayer) {
      this.enemy2Mode = 'avoid';
    } else {
      this.enemy2Mode = 'chase';
    }

    // Move enemy2 based on current mode
    let moveX = 0;
    let moveY = 0;

    if (this.enemy2Mode === 'chase') {
      // Chase mode: move toward player
      if (distanceToPlayer > 0) {
        const moveSpeed = this.enemy2Speed;
        moveX = (dxToPlayer / distanceToPlayer) * moveSpeed;
        moveY = (dyToPlayer / distanceToPlayer) * moveSpeed;
      }
    } else {
      // Avoid mode: move away from closest ball
      if (closestBall) {
        // TypeScript error after site migration - ignoring for game functionality
        // @ts-ignore
        const dxFromBall = this.enemy2.x - closestBall.x;
        // TypeScript error after site migration - ignoring for game functionality
        // @ts-ignore
        const dyFromBall = this.enemy2.y - closestBall.y;
        const distanceFromBall = Math.sqrt(dxFromBall * dxFromBall + dyFromBall * dyFromBall);

        if (distanceFromBall > 0) {
          const moveSpeed = this.enemy2AvoidSpeed;
          moveX = (dxFromBall / distanceFromBall) * moveSpeed;
          moveY = (dyFromBall / distanceFromBall) * moveSpeed;
        }
      }
    }

    // Check collision with regular enemies
    this.enemies.forEach((enemy) => {
      if (!enemy || !enemy.active) return;

      // @ts-ignore
      const enemyDx = enemy.x - this.enemy2.x;
      // @ts-ignore
      const enemyDy = enemy.y - this.enemy2.y;
      const enemyDistance = Math.sqrt(enemyDx * enemyDx + enemyDy * enemyDy);
      const minDistance = 85; // Minimum distance (60 + 10 + 15 buffer)

      if (enemyDistance < minDistance && enemyDistance > 0) {
        // Push away from regular enemy
        const pushForce = (minDistance - enemyDistance) / minDistance;
        moveX -= (enemyDx / enemyDistance) * pushForce * 2;
        moveY -= (enemyDy / enemyDistance) * pushForce * 2;
      }
    });

    // Apply movement
    // TypeScript error after site migration - ignoring for game functionality
    // @ts-ignore
    this.enemy2.x += moveX;
    // TypeScript error after site migration - ignoring for game functionality
    // @ts-ignore
    this.enemy2.y += moveY;

    // Keep enemy2 within screen bounds (accounting for 120x120 size)
    const enemy2Radius = 60; // Half of 120x120
    // TypeScript error after site migration - ignoring for game functionality
    // @ts-ignore
    this.enemy2.x = Math.max(enemy2Radius, Math.min(this.cameras.main.width - enemy2Radius, this.enemy2.x));
    // TypeScript error after site migration - ignoring for game functionality
    // @ts-ignore
    this.enemy2.y = Math.max(enemy2Radius, Math.min(this.cameras.main.height - enemy2Radius, this.enemy2.y));
  }

  createEnemies() {
    const currentConfig = this.stageConfigs[this.currentStage - 1];
    const enemyCount = currentConfig.enemies;

    // Clear existing enemies
    this.enemies.forEach(enemy => enemy.destroy());
    this.enemies = [];
    this.enemyHealths.clear();

    // Clear enemy2 for stage 4
    if (this.enemy2) {
      // TypeScript error after site migration - ignoring for game functionality
      // @ts-ignore
      this.enemy2.destroy();
      this.enemy2 = null;
    }

    // Create enemies based on stage configuration
    const screenWidth = this.cameras.main.width;
    const screenHeight = this.cameras.main.height;

    const enemyPositions = [
      { x: 100, y: 100 },
      { x: screenWidth - 100, y: 100 },
      { x: 100, y: screenHeight - 100 },
      { x: screenWidth - 100, y: screenHeight - 100 },
      { x: screenWidth / 2, y: 50 },
      { x: screenWidth / 2, y: screenHeight - 50 }
    ];

    // Generate additional positions for stage 3 (30 enemies)
    if (this.currentStage === 3) {
      // Add more enemy positions around the screen, positioned far from center
      for (let i = 0; i < 24; i++) {
        const angle = (i / 24) * 2 * Math.PI;
        const radius = 300 + Math.random() * 200; // Much larger radius (300-500 instead of 150-250)
        const x = screenWidth / 2 + Math.cos(angle) * radius;
        const y = screenHeight / 2 + Math.sin(angle) * radius;
        enemyPositions.push({ x, y });
      }
    }

    // Use only the positions needed for this stage
    for (let i = 0; i < enemyCount; i++) {
      let pos: { x: number; y: number };
      if (i < enemyPositions.length) {
        pos = enemyPositions[i];
      } else {
        // Generate random positions for additional enemies, far from center for stage 3
        if (this.currentStage === 3) {
          // Place enemies in corners or edges, far from center
          const side = Math.floor(Math.random() * 4); // 0: top, 1: right, 2: bottom, 3: left
          switch (side) {
            case 0: // top
              pos = { x: Math.random() * screenWidth, y: 50 + Math.random() * 100 };
              break;
            case 1: // right
              pos = { x: screenWidth - 150 - Math.random() * 100, y: Math.random() * screenHeight };
              break;
            case 2: // bottom
              pos = { x: Math.random() * screenWidth, y: screenHeight - 150 - Math.random() * 100 };
              break;
            case 3: // left
              pos = { x: 50 + Math.random() * 100, y: Math.random() * screenHeight };
              break;
            default:
              pos = { x: 50 + Math.random() * (screenWidth - 100), y: 50 + Math.random() * (screenHeight - 100) };
          }
        } else {
          // Normal random positioning for other stages
          pos = {
            x: 50 + Math.random() * (screenWidth - 100),
            y: 50 + Math.random() * (screenHeight - 100)
          };
        }
      }

      if (this.currentStage === 4) {
        // Stage 4 uses enemy2 instead of regular enemies
        this.createEnemy2();
      } else {
        const enemy = this.add.rectangle(pos.x, pos.y, 20, 20, 0x00ff00); // Green rectangle
        this.enemies.push(enemy);
        this.enemyHealths.set(enemy, 100);
      }
    }
  }

  createUI() {
    this.healthText = this.add.text(80, 20, `HP: ${this.playerHealth}`, {
      fontSize: '32px',
      color: '#1a365d'
    });
    this.healthText.setVisible(false);

    this.stageText = this.add.text(80, 60, `Stage: ${this.currentStage}`, {
      fontSize: '24px',
      color: '#0055ff'
    });
    this.stageText.setVisible(false);

    this.gameOverText = this.add.text(this.cameras.main.width / 2, this.cameras.main.height / 2, 'GAME OVER', {
      fontSize: '48px',
      color: '#ff0000'
    });
    this.gameOverText.setOrigin(0.5);
    this.gameOverText.setVisible(false);

    this.congratulationsText = this.add.text(this.cameras.main.width / 2, this.cameras.main.height / 2 - 50, 'CONGRATULATIONS!', {
      fontSize: '36px',
      color: '#00ff00'
    });
    this.congratulationsText.setOrigin(0.5);
    this.congratulationsText.setVisible(false);

    this.stageTimeText = this.add.text(this.cameras.main.width / 2, this.cameras.main.height / 2 + 20, '', {
      fontSize: '24px',
      color: '#1a365d'
    });
    this.stageTimeText.setOrigin(0.5);
    this.stageTimeText.setVisible(false);

    // Create menu UI
    this.menuTitle = this.add.text(this.cameras.main.width / 2, this.cameras.main.height / 2 - 100, 'LOOPLESS GAME', {
      fontSize: '64px',
      color: '#ffffff'
    });
    this.menuTitle.setOrigin(0.5);

    this.menuSubtitle = this.add.text(this.cameras.main.width / 2, this.cameras.main.height / 2, 'Press SPACE to start', {
      fontSize: '24px',
      color: '#1a365d'
    });
    this.menuSubtitle.setOrigin(0.5);

    // Create freeze countdown text
    this.freezeCountdownText = this.add.text(this.cameras.main.width / 2, this.cameras.main.height / 2, '3', {
      fontSize: '72px',
      color: '#1a365d'
    });
    this.freezeCountdownText.setOrigin(0.5);
    this.freezeCountdownText.setVisible(false);

    // Create GMTK credit text
    this.gmtkText = this.add.text(this.cameras.main.width / 2, this.cameras.main.height - 80, 'Game for the 2025 GMTK', {
      fontSize: '24px',
      color: '#1a365d'
    });
    this.gmtkText.setOrigin(0.5);
    this.gmtkText.setVisible(false);

    // Create credits text
    this.creditsText = this.add.text(this.cameras.main.width / 2, this.cameras.main.height - 40, 'Sound and Music by Hed Gilboa', {
      fontSize: '26px',
      color: '#1a365d'
    });
    this.creditsText.setOrigin(0.5);
    this.creditsText.setVisible(false);

    // Create instructions text
    this.instructionsText = this.add.text(200, 200, 'Game Instructions:', {
      fontSize: '20px',
      color: '#1a365d'
    });
    this.instructionsText.setOrigin(0.5);
    this.instructionsText.setVisible(false);

    // Create menu game objects (static, non-moving) - in rows
    this.createMenuGameObjects();
  }

  createMenuGameObjects() {
    // Create a static player for the menu (similar to the real player but simplified)
    this.menuPlayer = this.add.container(150, 240);

    // Create player body (brown capsule)
    const bodyGraphics = this.add.graphics();
    bodyGraphics.fillStyle(0x8B4513); // Brown color
    bodyGraphics.fillRoundedRect(-this.playerSize / 2, -this.playerSize / 2, this.playerSize, this.playerSize, this.playerSize / 2);
    this.menuPlayer.add(bodyGraphics);

    // Create player eyes
    const leftEye = this.add.circle(-5, -5, 3, 0xffff00);
    const rightEye = this.add.circle(5, -5, 3, 0xffff00);
    this.menuPlayer.add(leftEye);
    this.menuPlayer.add(rightEye);

    // Create player pupils
    const leftPupil = this.add.circle(-5, -5, 1, 0x000000);
    const rightPupil = this.add.circle(5, -5, 1, 0x000000);
    this.menuPlayer.add(leftPupil);
    this.menuPlayer.add(rightPupil);

    // Create menu enemy (green rectangle) - second row
    this.menuEnemy = this.add.rectangle(150, 270, 20, 20, 0x00ff00);

    // Create menu ball (yellow circle) - third row
    this.menuBall = this.add.circle(150, 300, 15, 0xff0000);

    // Create labels - arranged in rows
    this.menuPlayerLabel = this.add.text(200, 240, 'This is you', {
      fontSize: '16px',
      color: '#1a365d'
    });
    this.menuPlayerLabel.setOrigin(0, 0.5);
    this.menuPlayerLabel.setVisible(false);

    this.menuEnemyLabel = this.add.text(200, 270, 'This is a very bad enemy. You can tell because it is green', {
      fontSize: '16px',
      color: '#1a365d'
    });
    this.menuEnemyLabel.setOrigin(0, 0.5);
    this.menuEnemyLabel.setVisible(false);

    this.menuBallLabel = this.add.text(200, 300, 'These massive things will roll and can hit you or the enemy', {
      fontSize: '16px',
      color: '#1a365d'
    });
    this.menuBallLabel.setOrigin(0, 0.5);
    this.menuBallLabel.setVisible(false);
  }

  setupInput() {
    // Track key states for continuous movement
    // @ts-ignore
    this.input.keyboard.on('keydown-LEFT', () => {
      this.keys['LEFT'] = true;
      this.playerDirection = 2; // Left
    });

    // @ts-ignore
    this.input.keyboard.on('keydown-RIGHT', () => {
      this.keys['RIGHT'] = true;
      this.playerDirection = 0; // Right
    });

    // @ts-ignore
    this.input.keyboard.on('keydown-UP', () => {
      this.keys['UP'] = true;
      this.playerDirection = 3; // Up
    });

    // @ts-ignore
    this.input.keyboard.on('keydown-DOWN', () => {
      this.keys['DOWN'] = true;
      this.playerDirection = 1; // Down
    });

    // Key up events to stop movement
    // @ts-ignore
    this.input.keyboard.on('keyup-LEFT', () => {
      this.keys['LEFT'] = false;
    });

    // @ts-ignore
    this.input.keyboard.on('keyup-RIGHT', () => {
      this.keys['RIGHT'] = false;
    });

    // @ts-ignore
    this.input.keyboard.on('keyup-UP', () => {
      this.keys['UP'] = false;
    });

    // @ts-ignore
    this.input.keyboard.on('keyup-DOWN', () => {
      this.keys['DOWN'] = false;
    });

    // Space to shoot or start game
    // @ts-ignore
    this.input.keyboard.on('keydown-SPACE', () => {
      if (this.gameState === 'menu') {
        this.startGame();
      } else if (this.gameState === 'playing' && !this.gameOver && !this.isStageFrozen && this.player && this.time.now - this.lastShootTime > this.shootCooldown) {
        this.shoot();
        this.lastShootTime = this.time.now;
      }
    });
  }

  shoot() {
    if (!this.player) return;

    // Play shoot sound
    this.sound.play('shoot');

    // Create bullet at player position (bigger size)
    const bullet = this.add.circle(this.player.x, this.player.y, 5, 0x000000); // Black circle, radius 5

    // Calculate direction based on player direction
    let angle = 0;
    switch (this.playerDirection) {
      case 0: // Right
        angle = 0;
        break;
      case 1: // Down
        angle = Math.PI / 2;
        break;
      case 2: // Left
        angle = Math.PI;
        break;
      case 3: // Up
        angle = -Math.PI / 2;
        break;
    }

    // Fast bullet velocity
    const bulletSpeed = 20;
    (bullet as any).velocityX = Math.cos(angle) * bulletSpeed;
    (bullet as any).velocityY = Math.sin(angle) * bulletSpeed;
    (bullet as any).radius = 5; // Updated radius

    this.bullets.push(bullet);
  }

  update() {
    if (this.gameState !== 'playing') return;

    // Handle freeze period
    if (this.isStageFrozen) {
      this.updateFreezeCountdown();
      return;
    }

    this.updatePlayerMovement();
    this.updateBalls();
    this.updateBullets();
    this.updateEnemies(); // New method for enemy advancement
    this.updateEnemy2(); // Update enemy2 behavior
    this.checkBallCollisions();
    this.checkBulletCollisions();
    this.checkPlayerCollisions();
    this.checkEnemyProximity(); // New method for explosion mechanic
    this.checkStageCompletion(); // New method for stage progression
    this.updatePupilDirection(); // Update pupil direction
    this.updateEnemy2Pupils(); // Update enemy2 pupils
    this.updateUI();
  }

  updatePlayerMovement() {
    if (!this.player || this.isStageFrozen) return;

    // Handle continuous movement based on key states
    if (this.keys['LEFT']) {
      this.player.x = Math.max(20, this.player.x - 5);
      this.playerDirection = 2; // Left
    }

    if (this.keys['RIGHT']) {
      this.player.x = Math.min(this.cameras.main.width - 20, this.player.x + 5);
      this.playerDirection = 0; // Right
    }

    if (this.keys['UP']) {
      this.player.y = Math.max(20, this.player.y - 5);
      this.playerDirection = 3; // Up
    }

    if (this.keys['DOWN']) {
      this.player.y = Math.min(this.cameras.main.height - 20, this.player.y + 5);
      this.playerDirection = 1; // Down
    }
  }

  updateEnemies() {
    // Make enemies slowly advance toward the player
    this.enemies.forEach((enemy) => {
      if (!enemy || !enemy.active || !this.player) return;

      // Calculate direction to player
      const dx = this.player!.x - enemy.x;
      const dy = this.player!.y - enemy.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance > 0) {
        // Normalize direction and move toward player
        let moveX = (dx / distance) * this.enemySpeed;
        let moveY = (dy / distance) * this.enemySpeed;

        // Check collision with other enemies
        this.enemies.forEach((otherEnemy) => {
          if (otherEnemy === enemy || !otherEnemy || !otherEnemy.active) return;

          const enemyDx = otherEnemy.x - enemy.x;
          const enemyDy = otherEnemy.y - enemy.y;
          const enemyDistance = Math.sqrt(enemyDx * enemyDx + enemyDy * enemyDy);
          const minDistance = 25; // Minimum distance between enemies (10 + 10 + 5 buffer)

          if (enemyDistance < minDistance && enemyDistance > 0) {
            // Push away from other enemy
            const pushForce = (minDistance - enemyDistance) / minDistance;
            moveX -= (enemyDx / enemyDistance) * pushForce * 2;
            moveY -= (enemyDy / enemyDistance) * pushForce * 2;
          }
        });

        // Check collision with enemy2 (if it exists)
        if (this.enemy2 && this.enemy2.active) {
          // TypeScript error after site migration - ignoring for game functionality
          // @ts-ignore
          const enemy2Dx = this.enemy2.x - enemy.x;
          // TypeScript error after site migration - ignoring for game functionality
          // @ts-ignore
          const enemy2Dy = this.enemy2.y - enemy.y;
          const enemy2Distance = Math.sqrt(enemy2Dx * enemy2Dx + enemy2Dy * enemy2Dy);
          const minDistanceWithEnemy2 = 85; // Minimum distance (10 + 60 + 15 buffer)

          if (enemy2Distance < minDistanceWithEnemy2 && enemy2Distance > 0) {
            // Push away from enemy2
            const pushForce = (minDistanceWithEnemy2 - enemy2Distance) / minDistanceWithEnemy2;
            moveX -= (enemy2Dx / enemy2Distance) * pushForce * 3;
            moveY -= (enemy2Dy / enemy2Distance) * pushForce * 3;
          }
        }

        if (enemy && enemy.active) {
          enemy.x += moveX;
          enemy.y += moveY;
        }
      }
    });
  }

  checkEnemyProximity() {
    // Check if any enemy is within explosion radius
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const enemy = this.enemies[i];
      if (!enemy || !enemy.active || !this.player) continue;

      const dx = enemy.x - this.player.x;
      const dy = enemy.y - this.player.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance <= this.explosionRadius) {
        // Enemy is within proximity - trigger explosion
        this.triggerExplosion(enemy);

        // Remove the enemy
        this.sound.play('enemyDie');
        enemy.destroy();
        this.enemies.splice(i, 1);
        this.enemyHealths.delete(enemy);
      }
    }
  }

  triggerExplosion(enemy: Phaser.GameObjects.Rectangle) {
    // Create explosion effect
    const explosion = this.add.circle(enemy.x, enemy.y, this.explosionRadius, 0xff0000, 0.3);

    // Reduce player health
    this.playerHealth -= this.explosionDamage;

    // Remove explosion effect after a short time
    this.time.delayedCall(200, () => {
      explosion.destroy();
    });

    // Check for game over
    if (this.playerHealth <= 0) {
      this.gameOver = true;
      this.gameState = 'gameOver';

      // Make game over text bigger
      this.gameOverText.setFontSize('96px');
      this.gameOverText.setVisible(true);

      // Show random death message
      const randomDeathMessage = this.deathMessages[Math.floor(Math.random() * this.deathMessages.length)];
      this.stageTimeText.setText(randomDeathMessage);
      this.stageTimeText.setVisible(true);

      // Return to menu after 3 seconds
      this.time.delayedCall(3000, () => {
        this.showMenu();
      });
    }
  }

  checkStageCompletion() {
    // Don't check for completion during stage transitions
    if (this.isTransitioning) return;

    // Check if all enemies are destroyed
    let stageComplete = false;

    if (this.currentStage === 4) {
      // Stage 4: check if enemy2 is destroyed
      stageComplete = !this.enemy2 || !this.enemy2.active;
      
      // Debug logging for stage 4 completion
      if (stageComplete) {
        console.log('Stage 4 completion detected!');
        console.log('enemy2:', this.enemy2);
        console.log('enemy2.active:', this.enemy2?.active);
      }
    } else {
      // Other stages: check if all enemies are destroyed
      stageComplete = this.enemies.length === 0;
    }

    if (stageComplete) {
      console.log(`Stage ${this.currentStage} completed!`);
      
      // Set transitioning flag to prevent multiple calls
      this.isTransitioning = true;

      // In debug mode, just show completion message and return to menu
      if (this.debugLevel > 0) {
        this.time.delayedCall(2000, () => {
          this.showMenu();
        });
      } else {
        // Normal game flow
        if (this.currentStage === 4) {
          // Stage 4 is the final stage - show congratulations and return to menu
          const stageTime = Math.round((this.time.now - this.stageStartTime) / 1000);

          console.log('Showing congratulations for stage 4!');
          this.congratulationsText.setText('"Congratulation" you made it to the end :)');
          this.congratulationsText.setVisible(true);

          this.stageTimeText.setText(`And it took you just ${stageTime} seconds.`);
          this.stageTimeText.setVisible(true);

          this.gameOver = true;
          this.gameState = 'gameOver';

          // Return to menu after 3 seconds
          this.time.delayedCall(3000, () => {
            console.log('Returning to menu after stage 4 completion');
            this.showMenu();
          });
        } else {
          // Other stages - wait 2 seconds then move to next stage
          this.time.delayedCall(2000, () => {
            this.nextStage();
          });
        }
      }
    }
  }

  showMenu() {
    this.gameState = 'menu';
    this.menuTitle.setVisible(true);
    this.menuSubtitle.setVisible(true);
    this.healthText.setVisible(false);
    this.stageText.setVisible(false);
    this.gameOverText.setVisible(false);
    this.gameOverText.setFontSize('48px'); // Reset to original size
    this.congratulationsText.setVisible(false);
    this.stageTimeText.setVisible(false);

    // Show menu game objects and instructions
    this.gmtkText.setVisible(true);
    this.creditsText.setVisible(true);
    this.instructionsText.setVisible(true);
    this.menuPlayer.setVisible(true);
    this.menuEnemy.setVisible(true);
    this.menuBall.setVisible(true);
    this.menuPlayerLabel.setVisible(true);
    this.menuEnemyLabel.setVisible(true);
    this.menuBallLabel.setVisible(true);

    // Stop background music when returning to menu
    this.sound.stopAll();
  }

  startGame() {
    this.gameState = 'playing';
    this.gameOver = false;
    this.currentStage = this.debugLevel > 0 ? this.debugLevel : 1;
    this.playerHealth = 100;

    // Hide menu
    this.menuTitle.setVisible(false);
    this.menuSubtitle.setVisible(false);
    this.gmtkText.setVisible(false);
    this.creditsText.setVisible(false);
    this.instructionsText.setVisible(false);
    this.menuPlayer.setVisible(false);
    this.menuEnemy.setVisible(false);
    this.menuBall.setVisible(false);
    this.menuPlayerLabel.setVisible(false);
    this.menuEnemyLabel.setVisible(false);
    this.menuBallLabel.setVisible(false);

    // Show game UI
    this.healthText.setVisible(true);
    this.stageText.setVisible(true);

    // Clear existing game elements
    if (this.player) {
      this.player.destroy();
    }
    this.bullets.forEach(bullet => bullet.destroy());
    this.bullets = [];
    this.enemies.forEach(enemy => enemy.destroy());
    this.enemies = [];
    this.enemyHealths.clear();
    if (this.enemy2) {
      // TypeScript error after site migration - ignoring for game functionality
      // @ts-ignore
      this.enemy2.destroy();
      this.enemy2 = null;
    }
    this.context.balls.forEach(ball => ball.destroy());
    this.context.balls = [];
    
    // Destroy dotted border if it exists
    if (this.dottedBorder) {
      this.dottedBorder.destroy();
      this.dottedBorder = null;
    }

    // Create game elements
    this.createPlayer();
    this.createBalls();
    this.createEnemies();

    // Create dotted border for level 4
    if (this.currentStage === 4) {
      this.createDottedBorder();
    }

    // Reset transitioning flag
    this.isTransitioning = false;

    // Start tracking stage time
    this.stageStartTime = this.time.now;

    // Start background music
    this.sound.play('backgroundMusic', { loop: true, volume: 0.8 });
  }

  nextStage() {
    // Calculate stage completion time
    const stageTime = Math.round((this.time.now - this.stageStartTime) / 1000);

    // Hide congratulations text
    this.congratulationsText.setVisible(false);
    this.stageTimeText.setVisible(false);

    // Check if there are more stages
    if (this.currentStage < this.stageConfigs.length) {
      // Show stage-specific completion message
      let completionMessage = '';
      switch (this.currentStage) {
        case 1:
          completionMessage = 'That was easy.';
          break;
        case 2:
          completionMessage = 'Level completed. But I\'m pretty sure you will die in the next level.';
          break;
        case 3:
          completionMessage = 'Level completed. But I\'m pretty sure you will die in the next level.';
          break;
        case 4:
          completionMessage = '"Congratulation" you made it to the end :)';
          break;
      }

      this.congratulationsText.setText(completionMessage);
      this.congratulationsText.setVisible(true);

      // Show time taken
      this.stageTimeText.setText(`And it took you just ${stageTime} seconds.`);
      this.stageTimeText.setVisible(true);

      // Wait 3 seconds then continue to next stage
      this.time.delayedCall(3000, () => {
        // Hide completion messages
        this.congratulationsText.setVisible(false);
        this.stageTimeText.setVisible(false);

        this.currentStage++;

        // Update stage text
        this.stageText.setText(`Stage: ${this.currentStage}`);

        // Reset player position
        if (this.player) {
          if (this.currentStage === 4) {
            // For level 4, position player at x=80 and y=half screen height
            this.player.x = 80;
            this.player.y = this.cameras.main.height / 2;
          } else {
            // For other levels, center the player
            this.player.x = this.cameras.main.width / 2;
            this.player.y = this.cameras.main.height / 2;
          }
        }

        // Create new stage content
        this.createBalls();
        this.createEnemies();

        // Create dotted border for level 4
        if (this.currentStage === 4) {
          this.createDottedBorder();
        }

        // Reset transitioning flag after creating new content
        this.isTransitioning = false;

        // Start tracking time for new stage
        this.stageStartTime = this.time.now;

        // Start freeze period for stages 2 and 3
        if (this.currentStage > 1) {
          this.startFreezePeriod();
        }
      });
    } else {
      // Game completed - show final congratulations
      this.congratulationsText.setText('"Congratulation" you made it to the end :)');
      this.congratulationsText.setVisible(true);

      // Show final time
      this.stageTimeText.setText(`And it took you just ${stageTime} seconds.`);
      this.stageTimeText.setVisible(true);

      this.gameOver = true;
      this.gameState = 'gameOver';

      // Return to menu after 3 seconds
      this.time.delayedCall(3000, () => {
        this.showMenu();
      });
    }
  }

  startFreezePeriod() {
    this.isStageFrozen = true;
    this.freezeTimer = 3; // 3 seconds
    this.freezeCountdownText.setVisible(true);
    this.freezeCountdownText.setText('3');
  }

  updateFreezeCountdown() {
    this.freezeTimer -= 1 / 60; // Assuming 60 FPS, decrement by 1/60th of a second

    if (this.freezeTimer <= 0) {
      // Freeze period ended
      this.isStageFrozen = false;
      this.freezeCountdownText.setVisible(false);
    } else {
      // Update countdown display
      const secondsLeft = Math.ceil(this.freezeTimer);
      this.freezeCountdownText.setText(secondsLeft.toString());
    }
  }

  updateBalls() {
    // Update ball physics
    this.context.balls.forEach((ball: any) => {
      // No friction - balls never stop
      ball.velocityX *= 1.0; // No friction
      ball.velocityY *= 1.0; // No friction

      // Update position
      ball.x += ball.velocityX;
      ball.y += ball.velocityY;

      if (this.currentStage === 4) {
        // Level 4: Bounce off dotted border (130px smaller than screen)
        const borderOffset = 130;

        if (ball.x - ball.radius < borderOffset) {
          ball.x = borderOffset + ball.radius;
          ball.velocityX *= -0.8;
          this.sound.play('ballHitWall');
        }
        if (ball.x + ball.radius > this.cameras.main.width - borderOffset) {
          ball.x = this.cameras.main.width - borderOffset - ball.radius;
          ball.velocityX *= -0.8;
          this.sound.play('ballHitWall');
        }
        if (ball.y - ball.radius < borderOffset) {
          ball.y = borderOffset + ball.radius;
          ball.velocityY *= -0.8;
          this.sound.play('ballHitWall');
        }
        if (ball.y + ball.radius > this.cameras.main.height - borderOffset) {
          ball.y = this.cameras.main.height - borderOffset - ball.radius;
          ball.velocityY *= -0.8;
          this.sound.play('ballHitWall');
        }
      } else {
        // Other levels: Bounce off regular walls
        if (ball.x - ball.radius < 20) {
          ball.x = 20 + ball.radius;
          ball.velocityX *= -0.8;
          this.sound.play('ballHitWall');
        }
        if (ball.x + ball.radius > this.cameras.main.width - 20) {
          ball.x = this.cameras.main.width - 20 - ball.radius;
          ball.velocityX *= -0.8;
          this.sound.play('ballHitWall');
        }
        if (ball.y - ball.radius < 20) {
          ball.y = 20 + ball.radius;
          ball.velocityY *= -0.8;
          this.sound.play('ballHitWall');
        }
        if (ball.y + ball.radius > this.cameras.main.height - 20) {
          ball.y = this.cameras.main.height - 20 - ball.radius;
          ball.velocityY *= -0.8;
          this.sound.play('ballHitWall');
        }
      }
    });
  }

  updateBullets() {
    // Update bullet positions and remove those off-screen
    this.bullets = this.bullets.filter(bullet => {
      (bullet as any).x += (bullet as any).velocityX;
      (bullet as any).y += (bullet as any).velocityY;

      // Remove bullets that leave the screen
      if ((bullet as any).x < 0 || (bullet as any).x > this.cameras.main.width ||
        (bullet as any).y < 0 || (bullet as any).y > this.cameras.main.height) {
        bullet.destroy();
        return false;
      }
      return true;
    });
  }

  checkBallCollisions() {
    // Check collisions between balls
    for (let i = 0; i < this.context.balls.length; i++) {
      for (let j = i + 1; j < this.context.balls.length; j++) {
        const ball1 = this.context.balls[i] as any;
        const ball2 = this.context.balls[j] as any;

        const dx = ball2.x - ball1.x;
        const dy = ball2.y - ball1.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const minDistance = ball1.radius + ball2.radius;

        if (distance < minDistance) {
          // Play random ball hit ball sound
          this.playRandomBallHitBallSound();

          // Collision detected - bounce balls off each other
          const angle = Math.atan2(dy, dx);

          // Push balls apart
          const overlap = minDistance - distance;
          const pushX = Math.cos(angle) * overlap * 0.5;
          const pushY = Math.sin(angle) * overlap * 0.5;

          ball1.x -= pushX;
          ball1.y -= pushY;
          ball2.x += pushX;
          ball2.y += pushY;

          // Calculate collision response
          const normalX = dx / distance;
          const normalY = dy / distance;

          // Relative velocity
          const relativeVelX = ball2.velocityX - ball1.velocityX;
          const relativeVelY = ball2.velocityY - ball1.velocityY;

          // Velocity along normal
          const velocityAlongNormal = relativeVelX * normalX + relativeVelY * normalY;

          // Don't resolve if velocities are separating
          if (velocityAlongNormal > 0) return;

          // Calculate impulse
          const restitution = 0.8; // Restored to original value for no friction
          const impulse = -(1 + restitution) * velocityAlongNormal;
          const impulseX = impulse * normalX;
          const impulseY = impulse * normalY;

          // Apply impulse
          ball1.velocityX -= impulseX / ball1.mass;
          ball1.velocityY -= impulseY / ball1.mass;
          ball2.velocityX += impulseX / ball2.mass;
          ball2.velocityY += impulseY / ball2.mass;
        }
      }
    }

    // Check ball collisions with enemies
    for (let i = 0; i < this.context.balls.length; i++) {
      const ball = this.context.balls[i] as any;
      if (!ball || !ball.active) continue;

      for (let j = this.enemies.length - 1; j >= 0; j--) {
        const enemy = this.enemies[j];
        if (!enemy || !enemy.active) continue;

        const dx = ball.x - enemy.x;
        const dy = ball.y - enemy.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const minDistance = ball.radius + 10; // Enemy radius is 10

        if (distance < minDistance) {
          // Ball hit enemy - destroy the enemy
          this.sound.play('enemyDie');
          enemy.destroy();
          this.enemies.splice(j, 1);
          this.enemyHealths.delete(enemy);
        }
      }
    }

    // Check ball collisions with enemy2 (stage 4)
    if (this.currentStage === 4 && this.enemy2 && this.enemy2.active) {
      for (let i = 0; i < this.context.balls.length; i++) {
        const ball = this.context.balls[i] as any;
        if (!ball || !ball.active) continue;

        // TypeScript error after site migration - ignoring for game functionality
        // @ts-ignore
        const dx = ball.x - this.enemy2.x;
        // TypeScript error after site migration - ignoring for game functionality
        // @ts-ignore
        const dy = ball.y - this.enemy2.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const minDistance = ball.radius + 60; // Enemy2 radius is 60 (half of 120x120)

        if (distance < minDistance) {
          // Ball hit enemy2 - destroy the enemy2
          this.sound.play('enemyDie');
          // TypeScript error after site migration - ignoring for game functionality
          // @ts-ignore
          this.enemy2.destroy();
          this.enemy2 = null;
          
          // Immediately check for stage completion
          this.checkStageCompletion();
        }
      }
    }
  }

  checkBulletCollisions() {
    // Check bullet collisions with balls and enemies
    for (let i = this.bullets.length - 1; i >= 0; i--) {
      const bullet = this.bullets[i];
      if (!bullet || !bullet.active) continue; // Skip destroyed bullets

      let bulletDestroyed = false;

      // Check bullet vs ball collisions
      for (let j = 0; j < this.context.balls.length; j++) {
        const ball = this.context.balls[j] as any;
        if (!ball || !ball.active) continue; // Skip destroyed balls

        const dx = bullet.x - ball.x;
        const dy = bullet.y - ball.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const minDistance = (bullet as any).radius + ball.radius;

        if (distance < minDistance) {
          // Play shot hit ball sound
          this.sound.play('shotHitBall');

          // Transfer bullet energy to ball
          const transferFactor = 0.5;

          ball.velocityX += (bullet as any).velocityX * transferFactor;
          ball.velocityY += (bullet as any).velocityY * transferFactor;

          // Destroy bullet
          bullet.destroy();
          this.bullets.splice(i, 1);
          bulletDestroyed = true;
          break; // Exit ball loop since bullet is destroyed
        }
      }

      // Check bullet vs enemy collisions (only if bullet still exists)
      if (!bulletDestroyed && bullet && bullet.active) {
        for (let j = this.enemies.length - 1; j >= 0; j--) {
          const enemy = this.enemies[j];
          if (!enemy || !enemy.active) continue;

          const dx = bullet.x - enemy.x;
          const dy = bullet.y - enemy.y;
          const distance = Math.sqrt(dx * dx + dy * dy);
          const minDistance = (bullet as any).radius + 10; // Enemy radius is 10

          if (distance < minDistance) {
            // Play shot hit enemy sound
            this.sound.play('shotHitEnemy');

            // Reduce enemy health
            const currentHealth = this.enemyHealths.get(enemy) || 0;
            const newHealth = currentHealth - 19;

            if (newHealth <= 0) {
              // Play enemy die sound
              this.sound.play('enemyDie');

              // Destroy enemy
              enemy.destroy();
              this.enemies.splice(j, 1);
              this.enemyHealths.delete(enemy);
            } else {
              // Update enemy health
              this.enemyHealths.set(enemy, newHealth);
            }

            // Destroy bullet
            bullet.destroy();
            this.bullets.splice(i, 1);
            break; // Exit enemy loop since bullet is destroyed
          }
        }
      }
    }
  }

  checkPlayerCollisions() {
    // Check ball collisions with player
    this.context.balls.forEach((ball: any) => {
      const dx = ball.x - this.player.x;
      const dy = ball.y - this.player.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      const minDistance = ball.radius + (this.playerSize / 2); // Player radius is half of player size

      if (distance < minDistance) {
        // Reduce player health
        this.playerHealth -= 10;

        // Push ball away from player
        const angle = Math.atan2(dy, dx);
        ball.x = this.player.x + Math.cos(angle) * minDistance;
        ball.y = this.player.y + Math.sin(angle) * minDistance;

        // Check for game over
        if (this.playerHealth <= 0) {
          this.gameOver = true;
          this.gameState = 'gameOver';

          // Make game over text bigger
          this.gameOverText.setFontSize('96px');
          this.gameOverText.setVisible(true);

          // Show random death message
          const randomDeathMessage = this.deathMessages[Math.floor(Math.random() * this.deathMessages.length)];
          this.stageTimeText.setText(randomDeathMessage);
          this.stageTimeText.setVisible(true);

          // Return to menu after 3 seconds
          this.time.delayedCall(3000, () => {
            this.showMenu();
          });
        }
      }
    });

    // Check enemy2 collision with player (only on stage 4)
    if (this.currentStage === 4 && this.enemy2 && this.enemy2.active) {
      // TypeScript error after site migration - ignoring for game functionality
      // @ts-ignore
      const dx = this.enemy2.x - this.player.x;
      // TypeScript error after site migration - ignoring for game functionality
      // @ts-ignore
      const dy = this.enemy2.y - this.player.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      const minDistance = 60 + (this.playerSize / 2); // Enemy2 radius (60) + player radius

      if (distance < minDistance) {
        // Reduce player health
        this.playerHealth -= 20; // More damage than ball collision

        // Push enemy2 away from player
        const angle = Math.atan2(dy, dx);
        // TypeScript error after site migration - ignoring for game functionality
        // @ts-ignore
        this.enemy2.x = this.player.x + Math.cos(angle) * minDistance;
        // TypeScript error after site migration - ignoring for game functionality
        // @ts-ignore
        this.enemy2.y = this.player.y + Math.sin(angle) * minDistance;

        // Check for game over
        if (this.playerHealth <= 0) {
          this.gameOver = true;
          this.gameState = 'gameOver';

          // Make game over text bigger
          this.gameOverText.setFontSize('96px');
          this.gameOverText.setVisible(true);

          // Show random death message
          const randomDeathMessage = this.deathMessages[Math.floor(Math.random() * this.deathMessages.length)];
          this.stageTimeText.setText(randomDeathMessage);
          this.stageTimeText.setVisible(true);

          // Return to menu after 3 seconds
          this.time.delayedCall(3000, () => {
            this.showMenu();
          });
        }
      }
    }
  }

  playRandomBallHitBallSound() {
    const ballHitSounds = ['ballHitBall1', 'ballHitBall2', 'ballHitBall3'];
    const randomSound = ballHitSounds[Math.floor(Math.random() * ballHitSounds.length)];
    this.sound.play(randomSound);
  }

  updateUI() {
    this.healthText.setText(`Health: ${this.playerHealth}`);
  }

  updatePupilDirection() {
    if (!this.leftPupil || !this.rightPupil || this.gameState !== 'playing') return;

    // Update timer
    this.pupilUpdateTimer += 16; // Assuming 60 FPS (16ms per frame)

    // Check if it's time to update pupil direction (every 4 seconds)
    if (this.pupilUpdateTimer >= this.pupilUpdateInterval) {
      this.pupilUpdateTimer = 0;

      // Create a list of all potential targets (enemies + enemy2)
      const targets: { x: number, y: number }[] = [];

      // Add regular enemies
      this.enemies.forEach(enemy => {
        if (enemy && enemy.active) {
          targets.push({ x: enemy.x, y: enemy.y });
        }
      });

      // Add enemy2 if it exists and is active
      if (this.enemy2 && this.enemy2.active) {
        // TypeScript error after site migration - ignoring for game functionality
        // @ts-ignore
        targets.push({ x: this.enemy2.x, y: this.enemy2.y });
      }

      if (targets.length > 0) {
        // Pick a random target
        const randomTarget = targets[Math.floor(Math.random() * targets.length)];

        // Calculate direction from player to target
        const dx = randomTarget.x - this.player.x;
        const dy = randomTarget.y - this.player.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance > 0) {
          // Normalize direction
          const dirX = dx / distance;
          const dirY = dy / distance;

          // Calculate pupil offset within the eye (close to perimeter)
          const eyeRadius = 5; // eyeSize
          const pupilOffset = 3; // How close to the edge of the eye
          const maxOffset = eyeRadius - 1; // Leave 1px margin

          // Calculate new pupil positions
          const leftEyeX = -((this.playerSize / 2) - 3); // Left eye position
          const rightEyeX = (this.playerSize / 2) - 3;   // Right eye position
          const eyeY = -((this.playerSize / 2) - 3);     // Eye Y position

          // Update left pupil position
          const leftPupilX = leftEyeX + (dirX * pupilOffset);
          const leftPupilY = eyeY + (dirY * pupilOffset);
          this.leftPupil.x = Math.max(leftEyeX - maxOffset, Math.min(leftEyeX + maxOffset, leftPupilX));
          this.leftPupil.y = Math.max(eyeY - maxOffset, Math.min(eyeY + maxOffset, leftPupilY));

          // Update right pupil position
          const rightPupilX = rightEyeX + (dirX * pupilOffset);
          const rightPupilY = eyeY + (dirY * pupilOffset);
          this.rightPupil.x = Math.max(rightEyeX - maxOffset, Math.min(rightEyeX + maxOffset, rightPupilX));
          this.rightPupil.y = Math.max(eyeY - maxOffset, Math.min(eyeY + maxOffset, rightPupilY));
        }
      } else {
        // No targets - look straight ahead
        const leftEyeX = -((this.playerSize / 2) - 3);
        const rightEyeX = (this.playerSize / 2) - 3;
        const eyeY = -((this.playerSize / 2) - 3);

        this.leftPupil.x = leftEyeX;
        this.leftPupil.y = eyeY;
        this.rightPupil.x = rightEyeX;
        this.rightPupil.y = eyeY;
      }
    }
  }
} 
