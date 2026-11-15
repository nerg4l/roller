<script lang="ts">
	import { T, useThrelte } from '@threlte/core';
	import * as THREE from 'three';
	import Dice from '#lib/Dice.svelte';
	import { createD10 } from '#lib/d10.ts';
	import { createDicePhysics } from '#lib/physics.ts';

	type Props = {
		busy?: boolean;
		onresult?: (labels: number[]) => void;
	};

	let { busy = $bindable(false), onresult }: Props = $props();

	// Number of dice of the last throw; changing the count input has no effect until the next throw
	let count = $state(1);

	// Half size of the tray along its SHORTER screen side (3D units); grows with the number of dice
	const VIEW_HALF_MIN = $derived(Math.max(6.5, 3 + 3.5 * Math.sqrt(count)));
	const FOV = 45;
	const tanHalfFov = Math.tan(THREE.MathUtils.degToRad(FOV / 2));

	const { size, renderer } = useThrelte();
	renderer.shadowMap.enabled = true;
	renderer.shadowMap.type = THREE.PCFShadowMap;

	const d10 = createD10();
	const physics = createDicePhysics(d10);

	// Fit camera, floor, shadow and walls to the screen
	const aspect = $derived($size.width / Math.max(1, $size.height));
	const trayHalfZ = $derived(aspect >= 1 ? VIEW_HALF_MIN : VIEW_HALF_MIN / aspect);
	const trayHalfX = $derived(trayHalfZ * aspect);

	let dirLight: THREE.DirectionalLight | undefined = $state();

	$effect(() => {
		physics.layout(trayHalfX, trayHalfZ);
		dirLight?.shadow.camera.updateProjectionMatrix();
	});

	let dice: ReturnType<typeof Dice> | undefined = $state();

	export function throwDice(n: number, targets?: (number | null)[]) {
		count = n;
		physics.layout(trayHalfX, trayHalfZ); // apply the resized tray before simulating
		dice?.throwDice(n, targets);
	}
</script>

<!-- Fixed camera looking straight down: screen up = -z, screen right = +x -->
<T.PerspectiveCamera
	makeDefault
	fov={FOV}
	near={0.1}
	far={100}
	up={[0, 0, -1]}
	position={[0, trayHalfZ / tanHalfFov, 0]}
	oncreate={(ref) => ref.lookAt(0, 0, 0)}
/>

<T.Color attach="background" args={[0x1e1e24]} />

<T.AmbientLight color={0xffffff} intensity={0.6} />

<T.DirectionalLight
	color={0xffffff}
	intensity={1.5}
	position={[5, 12, 5]}
	castShadow
	shadow.mapSize={[2048, 2048]}
	shadow.camera.near={1}
	shadow.camera.far={80}
	shadow.camera.left={-trayHalfX - 4}
	shadow.camera.right={trayHalfX + 4}
	shadow.camera.top={trayHalfZ + 4}
	shadow.camera.bottom={-trayHalfZ - 4}
	shadow.bias={-0.0005}
	bind:ref={dirLight}
/>

<T.DirectionalLight color={0x88aaff} intensity={0.8} position={[-5, -5, -5]} />

<!-- Floor, a little oversized so no background shows at the edges -->
<T.Mesh rotation.x={-Math.PI / 2} scale={[trayHalfX * 2.1, trayHalfZ * 2.1, 1]} receiveShadow>
	<T.PlaneGeometry args={[1, 1]} />
	<T.MeshStandardMaterial color={0x2b2d36} roughness={0.9} />
</T.Mesh>

<Dice bind:this={dice} bind:busy {d10} {physics} {onresult} />
