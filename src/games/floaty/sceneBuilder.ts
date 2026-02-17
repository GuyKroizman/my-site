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
        width="30" 
        height="30" 
        color="#3d3d5c"
        shadow="receive: true"
        static-body
      ></a-plane>
      
      <!-- Ceiling -->
      <a-plane 
        position="0 12 0" 
        rotation="90 0 0" 
        width="30" 
        height="30" 
        color="#2a2a4a"
        static-body
      ></a-plane>
      
      <!-- Walls with physics -->
      <a-plane position="0 6 -15" width="30" height="12" color="#4a4a6a" static-body></a-plane>
      <a-plane position="0 6 15" rotation="0 180 0" width="30" height="12" color="#4a4a6a" static-body></a-plane>
      <a-plane position="-15 6 0" rotation="0 90 0" width="30" height="12" color="#4a4a6a" static-body></a-plane>
      <a-plane position="15 6 0" rotation="0 -90 0" width="30" height="12" color="#4a4a6a" static-body></a-plane>
      
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
      
      <!-- Invisible physics shoulder body (driven by player-motion raycasting). -->
      <a-box
        id="player-body"
        position="0 1.6 0"
        width="0.4"
        height="0.2"
        depth="0.2"
        material="opacity: 0; transparent: true; depthWrite: false"
        player-motion="gravity: -9.8; damping: 1.4; maxSpeed: 7"
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
      <a-entity id="rig" position="0 1.5 0" shoulder-camera-sync="shoulderOffsetY: 0.3; lockHorizontal: true; debugEveryMs: 250">
        <!-- Camera for VR view -->
        <a-camera id="camera" position="0 0 0" look-controls="pointerLockEnabled: true">
          <!-- In-headset debug HUD -->
          <a-entity
            id="debug-hud"
            position="0 -0.24 -2.2"
            scale="0.55 0.55 0.55"
            text="value: Waiting for VR debug...; color: #7CFF7C; width: 3.6; align: left; wrapCount: 64"
          ></a-entity>
        </a-camera>
        
        <!-- Left hand controller with hand-walker and arm-connector -->
        <a-entity 
          id="left-hand" 
          oculus-touch-controls="hand: left"
          hand-tracking-controls="hand: left"
          hand-walker="hand: left; contactDistance: 0.15; horizontalGain: 24; verticalGain: 14; maxSpeed: 7; minHandSpeed: 0.02"
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
          hand-walker="hand: right; contactDistance: 0.15; horizontalGain: 24; verticalGain: 14; maxSpeed: 7; minHandSpeed: 0.02"
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
