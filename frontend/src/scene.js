import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

export function initScene() {
    // Grab canvas from DOM
    const canvas = document.querySelector('#aquarium-canvas');

    // Set up scene, camera, and renderer
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#0a192f'); // Temporary color
    scene.fog = new THREE.FogExp2('#041421', 0.04); // Adds underwater depth fading

    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0, 4, 10);

    const renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true});
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); // Optimize performance on higher resolution screens by choosing at most pixel ratio of 2

    // Aquarium Dimensions (Width, Height, Depth)
    const tankSize = { x: 30, y: 15, z: 20 };
    const tankGeo = new THREE.BoxGeometry(tankSize.x, tankSize.y, tankSize.z);
    const tankMat = new THREE.MeshBasicMaterial({ color: 0x00ffff, wireframe: true, transparent: true, opacity: 0.1 });
    const tankWireframe = new THREE.Mesh(tankGeo, tankMat);
    tankWireframe.position.y = tankSize.y / 2; // Sit it on the floor
    scene.add(tankWireframe);

    // Add Orbit Controls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.maxPolarAngle = Math.PI / 2 - 0.05; // Prevent camera from going into the floor

    // Lighting 
    const sun = new THREE.DirectionalLight(0x55aaff, 1);
    sun.position.set(10, 20, 10);
    scene.add(sun);
    const lightHelper = new THREE.DirectionalLightHelper(sun, 5);
    scene.add(lightHelper);

    // Fish tank floor
    const planeGeometry = new THREE.PlaneGeometry(40,40);
    const planeMaterial = new THREE.MeshStandardMaterial({
        color: '#c2b280', // sand
        roughness: .9
    });
    const floor = new THREE.Mesh(planeGeometry, planeMaterial);
    floor.rotation.x = -Math.PI /2;
    scene.add(floor);

    // Handle Window Resizing
    window.addEventListener('resize', () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    });

    // placeholder fish
    const fishes = [];
    const fishCount = 20;

    for (let i= 0; i < fishCount; i++) {
        // Use sphere as placeholder fish
        const geometry = new THREE.SphereGeometry(0.3, 16, 16);
        const material = new THREE.MeshStandardMaterial({
            color: new THREE.Color(`hsl(${Math.random() * 360}, 100%, 75%)`),
            emissive: new THREE.Color(0x000000)
        });

        const fish = new THREE.Mesh(geometry, material);

        // Random starting pos for fish
        fish.position.set(
            (Math.random() - 0.5) * tankSize.x,
            Math.random() * tankSize.y,
            (Math.random() - 0.5) * tankSize.z
        );

        // give fish direction
        fish.userData.velocity = new THREE.Vector3(
            (Math.random() - 0.5) * 0.1,
            (Math.random() - 0.5) * 0.1,
            (Math.random() - 0.5) * 0.1
        );

        scene.add(fish);
        fishes.push(fish);
    }

    // let frameCount = 0;
    // Animation Loop
    function animate(){
        // frameCount++;
        // if (frameCount > 1000) return;
        console.log("rendering");
        requestAnimationFrame(animate);

        // Update controls
        controls.update();

        fishes.forEach(fish =>{
            // give fish velocity
            fish.position.add(fish.userData.velocity);
            // Check X boundaries
            if (Math.abs(fish.position.x) > tankSize.x /2) {
                fish.userData.velocity.x *= -1; // Reverse direction
            }
            // Check Y boundaries
            if (fish.position.y > tankSize.y || fish.position.y < 0) {
                fish.userData.velocity.y *= -1;
            }
            // Check Z boundaries
            if (Math.abs(fish.position.z) > tankSize.z / 2) {
                fish.userData.velocity.z *= -1;
            }

            // Make fish look at where it's going
            const target = fish.position.clone().add(fish.userData.velocity);
            fish.lookAt(target);
        });

        renderer.render(scene, camera);
    }

    animate();
}