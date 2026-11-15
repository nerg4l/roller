<script lang="ts">
	import { T, useTask, useThrelte } from '@threlte/core';
	import * as THREE from 'three';
	import { TEX_H, TEX_W, type D10, type Symmetry } from '#lib/d10.ts';
	import { drawNetWireframe, downloadCanvas } from '#lib/net-wireframe.ts';
	import { STEP, type Frame, type createDicePhysics } from '#lib/physics.ts';
	import textureUrl from './assets/texture.jpg';

	type Props = {
		d10: D10;
		physics: ReturnType<typeof createDicePhysics>;
		busy?: boolean;
		onresult?: (labels: number[]) => void;
	};

	let { d10, physics, busy = $bindable(false), onresult }: Props = $props();

	const { renderer } = useThrelte();

	// Number printed on a cell. Change these if your artwork uses other labels (e.g. 0-9).
	const cellToLabel = (cell: number) => cell + 1;
	const labelToCell = (label: number) => label - 1;

	function configureTexture<T extends THREE.Texture>(tex: T): T {
		tex.colorSpace = THREE.SRGBColorSpace;
		tex.generateMipmaps = false; // mipmaps would blend neighbouring cells
		tex.minFilter = THREE.LinearFilter;
		tex.magFilter = THREE.LinearFilter;
		tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
		return tex;
	}

	const wireOpts = {
		width: TEX_W,
		height: TEX_H,
		sampledPoints: d10.sampledPoints,
		edgeReach: d10.edgeReachPx
	};
	const wireTexture = configureTexture(
		new THREE.CanvasTexture(drawNetWireframe(d10.netPixelCorners, d10.netCells, wireOpts))
	);

	let showWireframe = $state(false);
	let artTexture: THREE.Texture = $state(
		new THREE.TextureLoader().load(
				textureUrl,
				(loaded) => {},
				undefined,
				() => console.info(`No ${textureUrl} found, using placeholder art.`)
		)
	);

	// One material shared by all dice
	const material = new THREE.MeshStandardMaterial({ roughness: 0.35, metalness: 0 });
	$effect(() => {
		material.map = showWireframe ? wireTexture : artTexture;
		material.needsUpdate = true;
	});

	// One track per die. `sym` rotates the recorded orientation by a symmetry of the d10:
	// the collider looks identical, but a different number ends up on top. This way all
	// dice can share one geometry with one fixed UV labeling.
	type Track = { frames: Frame[]; sym: Symmetry; label: number };

	let tracks: Track[] = $state.raw([]);
	let meshes: (THREE.Mesh | undefined)[] = $state([]);

	const quatA = new THREE.Quaternion();
	const quatB = new THREE.Quaternion();

	function poseTrack(track: Track, mesh: THREE.Mesh | undefined, t: number) {
		if (!mesh) return;
		const { frames } = track;
		const n = frames.length;
		const i = Math.min(Math.floor(t), n - 1);
		const j = Math.min(i + 1, n - 1);
		const a = Math.min(Math.max(t - i, 0), 1);
		const A = frames[i],
			B = frames[j];
		mesh.position.set(
			A[0] + (B[0] - A[0]) * a,
			A[1] + (B[1] - A[1]) * a,
			A[2] + (B[2] - A[2]) * a
		);
		quatA.set(A[3], A[4], A[5], A[6]).slerp(quatB.set(B[3], B[4], B[5], B[6]), a);
		mesh.quaternion.copy(quatA).multiply(track.sym.quat);
	}

	function poseAll(t: number) {
		tracks.forEach((track, i) => poseTrack(track, meshes[i], t));
	}

	// Picks, for every die, the symmetry that shows targets[i] (random when missing)
	function toTracks(dice: { frames: Frame[]; face: number }[], targets: (number | null)[] = []) {
		return dice.map(({ frames, face }, i): Track => {
			let sym = d10.symmetries[0];
			const target = targets[i];
			if (target !== undefined && target !== null) {
				const cell = labelToCell(target);
				const found = d10.symmetries.find((s) => s.perm[cell] === face);
				if (found) sym = found;
				else
					console.warn(
						`Cannot show ${target}: valid numbers are ${cellToLabel(0)}-${cellToLabel(9)}.`
					);
			}
			return { frames, sym, label: cellToLabel(sym.invPerm[face]) };
		});
	}

	let playback: { elapsed: number; length: number } | null = null;


	// Re-pose once the meshes for the current tracks exist
	$effect(() => {
		if (!playback && meshes.length >= tracks.length) poseAll(Infinity);
	});

	// Throws all dice so that die i lands showing targets[i]. Missing targets are random.
	export function throwDice(count: number, targets?: (number | null)[]) {
		const plan = physics.planThrow(count, physics.setupRandomThrow);
		tracks = toTracks(plan.dice, targets);
		playback = { elapsed: 0, length: Math.max(1, ...plan.dice.map((d) => d.frames.length)) };
		busy = true;
		playbackTask.start();
	}

	const playbackTask = useTask(
		(delta) => {
			if (!playback) return;
			playback.elapsed += delta;
			const t = playback.elapsed / STEP;
			poseAll(t);
			if (t >= playback.length - 1) {
				playback = null;
				busy = false;
				playbackTask.stop();
				onresult?.(tracks.map((track) => track.label));
			}
		},
		{ autoStart: false }
	);

	function onkeydown(e: KeyboardEvent) {
		const key = e.key.toLowerCase();
		if (key === 'w') {
			showWireframe = !showWireframe;
		} else if (key === 'd') {
			// Template with transparent background, to paint over in an image editor
			downloadCanvas(
				drawNetWireframe(d10.netPixelCorners, d10.netCells, { ...wireOpts, background: null }),
				'net-wireframe.png'
			);
		}
	}
</script>

<svelte:window {onkeydown} />

{#each tracks as _, i (i)}
	<T.Mesh bind:ref={meshes[i]} geometry={d10.geometry} {material} castShadow />
{/each}
