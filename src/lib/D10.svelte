<script lang="ts">
	import { T, useTask } from '@threlte/core';
	import * as THREE from 'three';
	import { interactivity } from '@threlte/extras';
	import { createTextTexture } from '#lib/texture.ts';
	import { sideRotation } from '#lib/geometry.ts';

	interactivity();

	export let sides: string[];
	export let position: THREE.Vector3 = new THREE.Vector3();

	const step = 256;
	const edgeOffset = 0.105;

	const textScale = 1.5;
	const texture = createTextTexture(sides, step);

	let rotation = sideRotation(0, sides.length);

	let rotationStart: number[] = [0, 0, 0];
	let rotationEnd: number[] = [0, 0, 0];

	const calcRadDiff = (rotationStart: number, rotationEnd: number, timer: number) => {
		if (rotationStart < rotationEnd) {
			rotationStart += 2 * Math.PI;
		}
		return rotationStart + (rotationEnd - rotationStart) * timer;
	};

	let timer = 0;
	const randomizeFaceTask = useTask(
		(delta) => {
			if (timer >= 1) {
				return;
			}
			if (timer == 0) {
				rotationStart = rotation;
				rotationEnd = rotationEnd.map(() => Math.PI * 2 * Math.random());
				timer = 0;
			}
			timer += delta;
			if (timer >= 1) {
				randomizeFaceTask.stop();
				resolveFaceTask.start();
				timer = 1;
				rotationStart = rotation;
				const targetIndex = Math.floor(Math.random() * sides.length);
				rotationEnd = sideRotation(targetIndex, sides.length);
				return;
			}
			rotation = [
				calcRadDiff(rotationStart[0], rotationEnd[0], timer),
				calcRadDiff(rotationStart[1], rotationEnd[1], timer),
				calcRadDiff(rotationStart[2], rotationEnd[2], timer)
			];
		},
		{ autoStart: false }
	);
	const resolveFaceTask = useTask(
		(delta) => {
			if (timer >= 2) {
				return;
			}
			timer += delta;
			if (timer >= 2) {
				timer = 2;
			}
			rotation = [
				calcRadDiff(rotationStart[0], rotationEnd[0], timer - 1),
				calcRadDiff(rotationStart[1], rotationEnd[1], timer - 1),
				calcRadDiff(rotationStart[2], rotationEnd[2], timer - 1)
			];
			if (timer == 2) {
				resolveFaceTask.stop();
				timer = 0;
			}
		},
		{ autoStart: false }
	);

	const roll = async () => {
		if (timer > 0) {
			return;
		}
		// randomizeFaceTask.start()
		timer = 0;
	};

	const turn = (Math.PI * 2) / sides.length;
	const vertexes = [
		new THREE.Vector3(0, 1, 0),
		new THREE.Vector3(Math.sin(turn), edgeOffset, Math.cos(turn)),
		new THREE.Vector3(0, -edgeOffset, 1),
		new THREE.Vector3(Math.sin(-turn), edgeOffset, Math.cos(-turn))
	];

	const path = new THREE.CurvePath<THREE.Vector3>();
	vertexes.forEach((_, i) => {
		const prev = (i - 1 + vertexes.length) % vertexes.length;
		const next = (i + 1) % vertexes.length;
		path.curves.push(
			new THREE.LineCurve3(
				new THREE.Vector3(
					(vertexes[i].x + vertexes[prev].x) / 2,
					(vertexes[i].y + vertexes[prev].y) / 2,
					(vertexes[i].z + vertexes[prev].z) / 2
				),
				new THREE.Vector3(...vertexes[i])
			)
		);
		path.curves.push(
			new THREE.LineCurve3(
				new THREE.Vector3(...vertexes[i]),
				new THREE.Vector3(
					(vertexes[i].x + vertexes[next].x) / 2,
					(vertexes[i].y + vertexes[next].y) / 2,
					(vertexes[i].z + vertexes[next].z) / 2
				)
			)
		);
	});

	const offsetRadius = 0.08;

	const standardMaterial = {
		metalness: 0.75,
		roughness: 0.35
	};

	type Cord = { x: number; y: number; z: number };

	function angleAtA(A: Cord, B: Cord, C: Cord) {
		const AB = new THREE.Vector3().subVectors(B, A);
		const AC = new THREE.Vector3().subVectors(C, A);

		return AB.angleTo(AC);
	}
</script>

<T.Mesh on:click={roll} {rotation} position={position.toArray()} castShadow>
	{#each sides.slice(0, 1) as _, i}
		<T.Mesh
			position={[...vertexes[0].toArray()]}
			castShadow
			on:create={({ ref }) => {
				// console.log(vertexes[1])
				// ref.lookAt(vertexes[1])
			}}
			rotation={(() => {
				const A = vertexes[0];
				const B = vertexes[1];
				const dx = A.x - B.x;
				const dy = A.y - B.y;
				const dz = A.z - B.z;

				return [Math.atan2(dy, -dz), angleAtA(A, B, vertexes[2]), 0];
			})()}
		>
			<T.CylinderGeometry
				args={[
					offsetRadius,
					offsetRadius,
					new THREE.Vector3().subVectors(vertexes[1], vertexes[0]).length(),
					8,
					1,
					true,
					Math.PI / 2,
					Math.PI / 2
				]}
				on:create={({ ref }) => {
					const direction = new THREE.Vector3().subVectors(vertexes[1], vertexes[0]);
					ref.applyMatrix4(new THREE.Matrix4().makeTranslation(0, direction.length() / 2, 0));
					ref.applyMatrix4(new THREE.Matrix4().makeRotationX(Math.PI / 2));
				}}
			/>
			<T.MeshStandardMaterial color={0xcc00cc} {...standardMaterial} />
		</T.Mesh>
		<T.Mesh rotation={sideRotation(i, sides.length)} castShadow>
			<T.BufferGeometry
				on:create={({ ref }) => {
					ref.setAttribute(
						'position',
						new THREE.Float32BufferAttribute(
							vertexes
								.map((v, i) => {
									const A = vertexes[0];
									const B = vertexes[2];

									const dy = B.y - A.y;
									const dz = B.z - A.z;

									const angle = Math.atan2(dy, dz) + Math.PI / 2;
									return [
										v.x,
										v.y + Math.sin(angle) * offsetRadius,
										v.z + Math.cos(angle) * offsetRadius
									];
								})
								.flat(),
							3
						)
					);
					ref.setIndex([0, 2, 1, 0, 3, 2]);
					ref.computeVertexNormals();
					ref.setAttribute(
						'uv',
						new THREE.Float32BufferAttribute(
							[
								(0.5 + i) / sides.length,
								textScale,
								(1 + i) / sides.length,
								edgeOffset * 2 * textScale,
								(0.5 + i) / sides.length,
								0,
								(0 + i) / sides.length,
								edgeOffset * 2 * textScale
							],
							2
						)
					);
				}}
			/>
			<T.MeshStandardMaterial {...standardMaterial} map={texture} />
		</T.Mesh>
	{/each}
</T.Mesh>
