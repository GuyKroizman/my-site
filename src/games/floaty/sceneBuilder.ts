/**
 * Returns the full A-Frame scene HTML string for Floaty McHandface.
 */
export function getSceneHTML(): string {
  return `
    <a-scene 
      vr-mode-ui="enabled: true" 
      background="color: #1a1a2e"
      physics="driver: cannon; gravity: 0 -9.8 0; debug: false"
    >
      <!-- Room - big enclosed space -->
      <!-- Floor with physics -->
      <a-plane 
        position="0 0 0" 
        rotation="-90 0 0" 
        width="70" 
        height="70" 
        color="#3d3d5c"
        shadow="receive: true"
        static-body
      ></a-plane>
      
      <!-- Ceiling -->
      <a-plane 
        position="0 12 0" 
        rotation="90 0 0" 
        width="70" 
        height="70" 
        color="#2a2a4a"
        static-body
      ></a-plane>
      
      <!-- Walls with physics -->
      <a-plane position="0 6 -35" width="70" height="12" color="#4a4a6a" static-body></a-plane>
      <a-plane position="0 6 35" rotation="0 180 0" width="70" height="12" color="#4a4a6a" static-body></a-plane>
      <a-plane position="-35 6 0" rotation="0 90 0" width="70" height="12" color="#4a4a6a" static-body></a-plane>
      <a-plane position="35 6 0" rotation="0 -90 0" width="70" height="12" color="#4a4a6a" static-body></a-plane>
      
      <!-- Low box - easy to touch -->
      <a-box 
        position="-3 0.5 -5" 
        width="2" 
        height="1" 
        depth="2" 
        color="#ff6b6b"
        shadow="cast: true; receive: true"
        static-body
      ></a-box>
      
      <!-- Very high pillar box -->
      <a-box 
        position="4 5 -6" 
        width="1.5" 
        height="10" 
        depth="1.5" 
        color="#4ecdc4"
        shadow="cast: true; receive: true"
        static-body
      ></a-box>

      <!-- Wide ramp and elevated jump route -->
      <a-box
        position="0 0.8 -9.6"
        width="8"
        height="0.4"
        depth="8"
        rotation="-18 0 0"
        color="#9f845e"
        shadow="cast: true; receive: true"
        static-body
      ></a-box>
      <a-box
        position="0 1.1 -15"
        width="10"
        height="2.2"
        depth="9"
        color="#59627a"
        shadow="cast: true; receive: true"
        static-body
      ></a-box>
      <a-box
        position="0 1.55 -25.8"
        width="11"
        height="3.1"
        depth="11"
        color="#66708a"
        shadow="cast: true; receive: true"
        static-body
      ></a-box>
      <a-box
        position="0 0.02 -20.4"
        width="12"
        height="0.04"
        depth="2.8"
        color="#101420"
      ></a-box>

      <!-- Stationary cannon built from basic shapes -->
      <a-entity
        id="cannon"
        position="1.8 3.25 -23.8"
        rotation="6 -8 0"
        cannon-shooter="fireRateMs: 950; ballSpeed: 11; ballGravity: -3.2; damage: 20; lifeMs: 7000; muzzleOffset: 0 0.34 1.36; shotVolume: 0.11"
      >
        <a-cylinder
          position="0 0.1 0"
          radius="0.42"
          height="0.24"
          color="#2a2e39"
        ></a-cylinder>
        <a-cylinder
          position="0 0.34 0.68"
          radius="0.18"
          height="1.35"
          rotation="90 0 0"
          color="#343945"
        ></a-cylinder>
        <a-sphere
          position="0 0.34 1.36"
          radius="0.13"
          color="#3d444f"
        ></a-sphere>
        <a-box
          position="0 0.18 -0.35"
          width="0.8"
          height="0.12"
          depth="0.7"
          color="#3a2f22"
        ></a-box>
      </a-entity>
      
      <!-- Invisible physics shoulder body (driven by player-motion raycasting). -->
      <a-box
        id="player-body"
        position="0 1.6 0"
        width="0.4"
        height="0.2"
        depth="0.2"
        material="opacity: 0; transparent: true; depthWrite: false"
        player-motion="gravity: -9.8; damping: 1.4; maxSpeed: 7"
        player-health="maxHealth: 100; respawnPosition: 0 1.6 0; respawnInvulnMs: 1200"
      >
        <!-- Visible shoulder body. -->
        <a-box
          id="shoulder-box"
          position="0 0 0"
          width="0.4"
          height="0.2"
          depth="0.2"
          color="#ffd93d"
        ></a-box>
      </a-box>
      
      <!-- VR Camera Rig - shoulder anchored camera -->
      <a-entity id="rig" position="0 1.5 0" shoulder-camera-sync="shoulderOffsetY: 0.3; lockHorizontal: true; debugEveryMs: 250; debugEnabled: false; shoulderTurnLerp: 0.18">
        <!-- Camera for VR view -->
        <a-camera id="camera" position="0 0 0" look-controls="pointerLockEnabled: true">
          <!-- Health HUD -->
          <a-entity
            id="health-hud"
            position="0 0.26 -1.05"
            health-hud="maxWidth: 0.9"
          >
            <a-plane
              width="0.98"
              height="0.14"
              color="#220b0b"
              opacity="0.78"
            ></a-plane>
            <a-plane
              id="health-fill"
              width="0.9"
              height="0.09"
              position="0 0 0.01"
              color="#37ff66"
            ></a-plane>
            <a-entity
              id="health-text"
              position="0 0 0.02"
              text="value: HP 100/100; color: #ffffff; align: center; width: 1.35; wrapCount: 18"
            ></a-entity>
          </a-entity>
        </a-camera>
        
        <!-- Left hand controller with hand-walker and arm-connector -->
        <a-entity 
          id="left-hand" 
          oculus-touch-controls="hand: left"
          hand-tracking-controls="hand: left"
          hand-walker="hand: left; contactDistance: 0.15; horizontalGain: 24; verticalGain: 14; maxSpeed: 7; minHandSpeed: 0.02; oneHandBoost: 1.65; contactGraceMs: 90"
          arm-connector="hand: left"
        >
          <!-- Arm cylinder - dynamically positioned/rotated by arm-connector -->
          <a-cylinder
            radius="0.04"
            height="0.5"
            color="#ffb347"
          ></a-cylinder>
          <!-- Palm ball at controller/hand position -->
          <a-sphere
            id="left-palm"
            position="0 0 0"
            radius="0.1"
            color="#ff7f50"
          ></a-sphere>
        </a-entity>
        
        <!-- Right hand controller with hand-walker and arm-connector -->
        <a-entity 
          id="right-hand" 
          oculus-touch-controls="hand: right"
          hand-tracking-controls="hand: right"
          hand-walker="hand: right; contactDistance: 0.15; horizontalGain: 24; verticalGain: 14; maxSpeed: 7; minHandSpeed: 0.02; oneHandBoost: 1.65; contactGraceMs: 90"
          arm-connector="hand: right"
        >
          <!-- Arm cylinder - dynamically positioned/rotated by arm-connector -->
          <a-cylinder
            radius="0.04"
            height="0.5"
            color="#ffb347"
          ></a-cylinder>
          <!-- Palm ball at controller/hand position -->
          <a-sphere
            id="right-palm"
            position="0 0 0"
            radius="0.1"
            color="#ff7f50"
          ></a-sphere>
        </a-entity>
      </a-entity>
      
      <!-- Lighting -->
      <a-light type="ambient" color="#404060" intensity="0.4"></a-light>
      <a-light type="directional" position="2 8 4" intensity="0.8" castShadow="true"></a-light>
      <a-light type="point" position="-3 4 -3" color="#ff6b6b" intensity="0.3"></a-light>
      <a-light type="point" position="4 8 -6" color="#4ecdc4" intensity="0.4"></a-light>
      
      <!-- Sky gradient effect -->
      <a-sky color="#16213e"></a-sky>
    </a-scene>
  `
}
