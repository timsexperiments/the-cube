import * as THREE from 'three';
import { RubiksCube } from './cube';

const canvas = document.querySelector<HTMLCanvasElement>('canvas#app');

if (!canvas) {
  throw new Error('Canvas not found.');
}

const sizes = {
  width: window.innerWidth,
  height: window.innerHeight,
  aspect() {
    return this.width / this.height;
  },
};

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, sizes.aspect(), 0.1, 100);
camera.position.z = 7;
camera.position.y = 5;
camera.position.x = -4;
camera.rotation.z = Math.PI;
camera.updateMatrixWorld();
scene.add(camera);
scene.background = new THREE.Color(0x0a0b0a);

var ambientLight = new THREE.AmbientLight('white', 2);
scene.add(ambientLight);

// const controls = new OrbitControls(camera, canvas);
// controls.enableZoom = false;
// controls.enablePan = false;
// controls.enableRotate = true;
// controls.enableDamping = true;

const cube = new RubiksCube(camera, {
  // colors: [0x129178, 0xe69500, 0x277dd8, 0x8361ff, 0x232323, 0xe7e9e8],
  borderColor: 0x000000,
});
scene.add(cube);
camera.lookAt(cube.position);
cube.shuffle();

const renderer = new THREE.WebGLRenderer({ canvas });
renderer.setSize(sizes.width, sizes.height);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

window.addEventListener('resize', () => {
  sizes.width = window.innerWidth;
  sizes.height = window.innerHeight;

  camera.aspect = sizes.aspect();
  camera.updateProjectionMatrix();
  renderer.setSize(sizes.width, sizes.height);
  renderer.setPixelRatio(window.devicePixelRatio);
});

canvas.addEventListener('dblclick', () => {
  if (!document.fullscreenElement) {
    canvas.requestFullscreen();
  } else {
    document.exitFullscreen();
  }
});

function tick() {
  // controls.update();
  renderer.render(scene, camera);

  window.requestAnimationFrame(tick);
}

tick();
