// Ambient types for the checkJs build (npm run typecheck): what the plain-JS code relies on dynamically.
import 'three';

declare module 'three' {
  // traverse() callbacks test o.isMesh and then use the mesh fields
  interface Object3D {
    isMesh?: boolean;
    geometry?: any;
    material?: any;
  }
}

declare global {
  interface Window {
    game: any;                              // debugging / automated tests handle (main.js)
    webkitAudioContext?: typeof AudioContext;
  }
}
