import './style.css';
import { initScene } from './scene.js';

document.querySelector('#app').innerHTML = `
  <canvas id="aquarium-canvas"></canvas>
`;

initScene();