import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

export function initScene() {
    // Grab canvas from DOM
    const canvas = document.querySelector('#aquarium-canvas');
    const fishes = [];
    const fish_capacity = 75;
    let live_fish = 0;

    // Set up scene, camera, and renderer
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#0a192f'); 
    scene.fog = new THREE.FogExp2('#041421', 0.04); 

    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0, 4, 10);

    const renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true});
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); 

    // --- HUD / Tooltip Setup ---
    const tooltip = document.createElement('div');
    tooltip.style.position = 'absolute';
    tooltip.style.background = 'transparent';
    tooltip.style.color = 'white'; 
    tooltip.style.padding = '5px 10px';
    tooltip.style.fontFamily = 'sans-serif';
    tooltip.style.fontSize = '14px';
    tooltip.style.fontWeight = 'bold';
    tooltip.style.textShadow = '1px 1px 2px black'; 
    tooltip.style.pointerEvents = 'none'; 
    tooltip.style.display = 'none'; 
    tooltip.style.zIndex = '100';
    document.body.appendChild(tooltip);

    // Raycaster Setup
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    window.addEventListener('mousemove', (event) => {
        mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
        mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
    });

    // Aquarium Dimensions
    const tankSize = { x: 30, y: 15, z: 20 };
    const tankGeo = new THREE.BoxGeometry(tankSize.x, tankSize.y, tankSize.z);
    const tankMat = new THREE.MeshBasicMaterial({ color: 0x00ffff, wireframe: true, transparent: true, opacity: 0.1 });
    const tankWireframe = new THREE.Mesh(tankGeo, tankMat);
    tankWireframe.position.y = tankSize.y / 2; 
    scene.add(tankWireframe);

    function create3DFish(data, expiresAt) {
        const geometry = new THREE.SphereGeometry(0.4, 32, 32);
        
        let color = 0x00ffcc; 
        if (data.category && data.category.toLowerCase().includes('guppy')) color = 0xffaa00;
        if (data.category && data.category.toLowerCase().includes('angelfish')) color = 0xff00ff;

        const material = new THREE.MeshStandardMaterial({ color: color, emissive: color, emissiveIntensity: 0.2 });
        const fish = new THREE.Mesh(geometry, material);

        fish.position.set(
            (Math.random() - 0.5) * (tankSize.x - 1),
            Math.random() * (tankSize.y - 1),
            (Math.random() - 0.5) * (tankSize.z - 1)
        );

        fish.userData = {
            title: data.title,
            price: data.price,
            expiresAt: expiresAt,
            velocity: new THREE.Vector3(
                (Math.random() - 0.5) * 0.05,
                (Math.random() - 0.5) * 0.05,
                (Math.random() - 0.5) * 0.05
            ),
            isHovered: false,
            anchorPosition: new THREE.Vector3()
        };

        fish.userData.anchorPosition.copy(fish.position);
        scene.add(fish);
        fishes.push(fish);
    }

    async function loadFishData() {
        try {
            const response = await fetch('/fish_data.json');

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const rawData = await response.json();
            const now = Date.now() / 1000;

            rawData.forEach(item => {
                const expiresAt = item.scraped_at + item.seconds_remaining;
                if (expiresAt > now && live_fish <= fish_capacity) {
                    create3DFish(item, expiresAt);
                    live_fish++;
                }
            });
            console.log(`Spawned ${fishes.length} live auctions.`);
        } catch (err) {
            console.error("Data not found, run scraper.py first", err);
        }
    }

    // Add Orbit Controls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.maxPolarAngle = Math.PI / 2 - 0.05; 

    // Lighting 
    const sun = new THREE.DirectionalLight(0x55aaff, 1);
    sun.position.set(10, 20, 10);
    scene.add(sun);
    const lightHelper = new THREE.DirectionalLightHelper(sun, 5);
    scene.add(lightHelper);

    // Fish tank floor
    const planeGeometry = new THREE.PlaneGeometry(40,40);
    const planeMaterial = new THREE.MeshStandardMaterial({
        color: '#c2b280', 
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

    let currentHoveredFish = null;
    
    // Animation Loop
    function animate(){
        requestAnimationFrame(animate);
        const now = Date.now() / 1000;
        controls.update();

        // --- Raycasting (Hover Detection) ---
        raycaster.setFromCamera(mouse, camera);
        const intersects = raycaster.intersectObjects(fishes);

        let nextHoveredFish = null;

        // 1. Check for direct laser hit
        if (intersects.length > 0) {
            nextHoveredFish = intersects[0].object;
        } 
        // 2. Dual-Zone Magnetic Leash
        else if (currentHoveredFish) {
            // Zone A: The original grab point in the corner
            const dxGrab = mouse.x - currentHoveredFish.userData.grabX;
            const dyGrab = mouse.y - currentHoveredFish.userData.grabY;
            const distGrab = Math.sqrt(dxGrab * dxGrab + dyGrab * dyGrab);

            // Zone B: The center of the screen (0, 0)
            const distCenter = Math.sqrt(mouse.x * mouse.x + mouse.y * mouse.y);

            // Keep holding if mouse is near the grab point OR the center!
            if (distGrab < 0.4 || distCenter < 0.4) {
                nextHoveredFish = currentHoveredFish;
            }
        }

        // 3. Handle State Change
        if (currentHoveredFish !== nextHoveredFish) {
            if (currentHoveredFish) {
                currentHoveredFish.userData.isHovered = false;
            }
            
            currentHoveredFish = nextHoveredFish;
            if (currentHoveredFish) {
                currentHoveredFish.userData.isHovered = true;
                // Save the exact mouse coordinates where the fish was caught
                currentHoveredFish.userData.grabX = mouse.x;
                currentHoveredFish.userData.grabY = mouse.y;
            }
        }

        // 4. Update the HTML Tooltip (World-to-Screen Projection)
        if (currentHoveredFish) {
            tooltip.style.display = 'block';
            tooltip.innerText = currentHoveredFish.userData.title;

            // Flatten the 3D fish position onto the 2D monitor
            const screenPos = currentHoveredFish.position.clone().project(camera);
            
            // Convert normalized coordinates (-1 to +1) back to CSS pixels
            const screenX = (screenPos.x * 0.5 + 0.5) * window.innerWidth;
            const screenY = -(screenPos.y * 0.5 - 0.5) * window.innerHeight;

            // Attach tooltip to the fish, not the mouse
            tooltip.style.left = (screenX + 25) + 'px';
            tooltip.style.top = (screenY) + 'px';
        } else {
            tooltip.style.display = 'none';
        }

        // --- Calculate Inspection Point (Back to Center) ---
        const inspectionPoint = new THREE.Vector3(0, 0, -4);
        inspectionPoint.applyMatrix4(camera.matrixWorld);

        // --- Fish Iteration Loop ---
        for (let i = fishes.length - 1; i >= 0; i--) {
            const fish = fishes[i];
            
            if (now > fish.userData.expiresAt) {
                scene.remove(fish);
                fishes.splice(i, 1);
                live_fish--;
                continue;
            }

            // --- RESTORED: THE GHOST SWIMMING MATH ---
            fish.userData.anchorPosition.add(fish.userData.velocity);

            // Boundary Collisions (Checking Ghost's position)
            if (Math.abs(fish.userData.anchorPosition.x) > tankSize.x / 2) fish.userData.velocity.x *= -1;
            if (fish.userData.anchorPosition.y > tankSize.y || fish.userData.anchorPosition.y < 0) fish.userData.velocity.y *= -1;
            if (Math.abs(fish.userData.anchorPosition.z) > tankSize.z / 2) fish.userData.velocity.z *= -1;
            // -----------------------------------------

            // --- SMOOTH SCALING LOGIC ---
            // Target scale is 2.5x when hovered, 1.0x when swimming normally
            const targetScale = fish.userData.isHovered ? 2.5 : 1.0;
            const currentScale = fish.scale.x;
            const newScale = currentScale + (targetScale - currentScale) * 0.1;
            fish.scale.setScalar(newScale);

            // --- MANUAL LERP MOVEMENT ---
            if (fish.userData.isHovered) {
                // Drag to the center inspection point smoothly (Alpha = 0.05)
                fish.position.x += (inspectionPoint.x - fish.position.x) * 0.05;
                fish.position.y += (inspectionPoint.y - fish.position.y) * 0.05;
                fish.position.z += (inspectionPoint.z - fish.position.z) * 0.05;
                
                // Face the camera
                const lookTarget = camera.position.clone();
                lookTarget.y = fish.position.y; 
                fish.lookAt(lookTarget);
            } else {
                // Drag back to the Ghost position smoothly (Alpha = 0.1)
                fish.position.x += (fish.userData.anchorPosition.x - fish.position.x) * 0.1;
                fish.position.y += (fish.userData.anchorPosition.y - fish.position.y) * 0.1;
                fish.position.z += (fish.userData.anchorPosition.z - fish.position.z) * 0.1;
                
                // Look where the velocity is taking it
                const target = fish.position.clone().add(fish.userData.velocity);
                fish.lookAt(target);
            }
        } // <-- THE RESTORED MISSING BRACKET

        renderer.render(scene, camera);
    }

    loadFishData().then(() => animate());
}