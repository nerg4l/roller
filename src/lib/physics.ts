import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import type { D10 } from '#lib/d10.ts';

export const GRAVITY = -30; // stronger than real gravity: the die is ~3 units wide, so 9.8 looks floaty
export const WALL_INSET = 1.0; // walls sit slightly inside the screen edge
export const STEP = 1 / 120;

// One [x, y, z, qx, qy, qz, qw] entry per STEP seconds
export type Frame = [number, number, number, number, number, number, number];
export type DieTrack = { frames: Frame[]; face: number; dot: number };
// All tracks have the same length (shorter ones are padded with their last frame)
export type Plan = { dice: DieTrack[] };
export type ThrowSetup = (bodies: CANNON.Body[]) => void;

export const DIE_SPACING = 3; // distance between dice when they start next to each other

const rand = (min: number, max: number) => min + Math.random() * (max - min);

// cannon-es world with a floor, 4 invisible walls and any number of d10 colliders.
// The bodies are only used to PRE-SIMULATE a throw; the result is played back afterwards.
export function createDicePhysics(d10: D10) {
	const world = new CANNON.World({ gravity: new CANNON.Vec3(0, GRAVITY, 0) });
	world.allowSleep = true;
	(world.solver as CANNON.GSSolver).iterations = 20;

	const tableMat = new CANNON.Material('table');
	const dieMat = new CANNON.Material('die');
	world.addContactMaterial(
		new CANNON.ContactMaterial(dieMat, tableMat, { friction: 0.35, restitution: 0.35 })
	);
	world.addContactMaterial(
		new CANNON.ContactMaterial(dieMat, dieMat, { friction: 0.25, restitution: 0.4 })
	);

	const floorBody = new CANNON.Body({
		type: CANNON.Body.STATIC,
		shape: new CANNON.Plane(),
		material: tableMat
	});
	floorBody.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
	world.addBody(floorBody);

	const WALL_HALF_T = 1;
	const WALL_LONG = 200;
	const makeWall = (halfExtents: CANNON.Vec3) => {
		const body = new CANNON.Body({
			type: CANNON.Body.STATIC,
			material: tableMat,
			shape: new CANNON.Box(halfExtents)
		});
		world.addBody(body);
		return body;
	};
	const walls = {
		left: makeWall(new CANNON.Vec3(WALL_HALF_T, 6, WALL_LONG)),
		right: makeWall(new CANNON.Vec3(WALL_HALF_T, 6, WALL_LONG)),
		top: makeWall(new CANNON.Vec3(WALL_LONG, 6, WALL_HALF_T)),
		bottom: makeWall(new CANNON.Vec3(WALL_LONG, 6, WALL_HALF_T))
	};

	let trayHalfX = 10;
	let trayHalfZ = 6.5;

	function layout(halfX: number, halfZ: number) {
		trayHalfX = halfX;
		trayHalfZ = halfZ;
		const ex = halfX - WALL_INSET + WALL_HALF_T;
		const ez = halfZ - WALL_INSET + WALL_HALF_T;
		walls.left.position.set(-ex, 6, 0);
		walls.right.position.set(ex, 6, 0);
		walls.top.position.set(0, 6, -ez);
		walls.bottom.position.set(0, 6, ez);
		Object.values(walls).forEach((wall) => (wall.aabbNeedsUpdate = true));
	}

	// Die collider: the sharp d10, scaled so its faces sit where the rounded mesh's faces are
	const { faces3D, baseVertices, bevelRadius } = d10;
	const faceDist = faces3D[0].normal.dot(faces3D[0].corners[0]);
	const colliderScale = (faceDist + bevelRadius) / faceDist;

	const dieShape = new CANNON.ConvexPolyhedron({
		vertices: baseVertices.map(
			(v) => new CANNON.Vec3(v.x * colliderScale, v.y * colliderScale, v.z * colliderScale)
		),
		faces: faces3D.map((face) => {
			const idx = face.corners.map((c) => baseVertices.indexOf(c));
			const [p0, p1, , p3] = face.corners;
			const handed = new THREE.Vector3()
				.subVectors(p1, p0)
				.cross(new THREE.Vector3().subVectors(p3, p0))
				.dot(face.normal);
			return handed > 0 ? idx : idx.slice().reverse();
		})
	});

	// Pool of die bodies; only the first `count` are in the world during a simulation
	const pool: CANNON.Body[] = [];
	const active: CANNON.Body[] = [];
	function useBodies(count: number) {
		while (pool.length < count) {
			pool.push(
				new CANNON.Body({
					mass: 1,
					shape: dieShape,
					material: dieMat,
					linearDamping: 0.05,
					angularDamping: 0.08,
					sleepSpeedLimit: 0.25,
					sleepTimeLimit: 0.6
				})
			);
		}
		while (active.length > count) world.removeBody(active.pop()!);
		while (active.length < count) {
			const body = pool[active.length];
			world.addBody(body);
			active.push(body);
		}
		return active;
	}

	const upVec = new THREE.Vector3(0, 1, 0);
	const worldNormal = new THREE.Vector3();
	const quat = new THREE.Quaternion();

	// Face of the die whose normal points most upward for a given orientation
	function topFaceOf(q: THREE.Quaternion) {
		let best = 0,
			bestDot = -Infinity;
		faces3D.forEach((face, i) => {
			const d = worldNormal.copy(face.normal).applyQuaternion(q).dot(upVec);
			if (d > bestDot) {
				bestDot = d;
				best = i;
			}
		});
		return { face: best, dot: bestDot };
	}

	type V3 = { x: number; y: number; z: number };
	function placeDie(body: CANNON.Body, pos: V3, vel: V3, angVel: V3) {
		body.wakeUp();
		body.position.set(pos.x, pos.y, pos.z);
		body.quaternion.setFromEuler(rand(0, Math.PI * 2), rand(0, Math.PI * 2), rand(0, Math.PI * 2));
		body.velocity.set(vel.x, vel.y, vel.z);
		body.angularVelocity.set(angVel.x, angVel.y, angVel.z);
		body.force.setZero();
		body.torque.setZero();
	}

	// Offsets that put `count` dice in a compact grid, centred on 0
	function gridOffsets(count: number) {
		const cols = Math.ceil(Math.sqrt(count));
		const rows = Math.ceil(count / cols);
		return Array.from({ length: count }, (_, i) => ({
			a: ((i % cols) - (cols - 1) / 2) * DIE_SPACING,
			b: (Math.floor(i / cols) - (rows - 1) / 2) * DIE_SPACING
		}));
	}

	function randomSpin(min: number, max: number) {
		const axis = new THREE.Vector3(rand(-1, 1), rand(-1, 1), rand(-1, 1)).normalize();
		const w = rand(min, max);
		return { x: axis.x * w, y: axis.y * w, z: axis.z * w };
	}

	// All dice are thrown together from one side of the tray towards its centre.
	// They start in a grid: `a` across the throw direction, `b` stacked upwards.
	const setupRandomThrow: ThrowSetup = (bodies) => {
		const angle = rand(0, Math.PI * 2);
		const offsets = gridOffsets(bodies.length);
		const centre = new THREE.Vector3(
			Math.cos(angle) * Math.max(1, trayHalfX - 3),
			0,
			Math.sin(angle) * Math.max(1, trayHalfZ - 3)
		);
		const target = new THREE.Vector3(rand(-1.5, 1.5), 0, rand(-1.5, 1.5));
		const dir = new THREE.Vector3().subVectors(target, centre).setY(0).normalize();
		const side = new THREE.Vector3(-dir.z, 0, dir.x);
		const halfX = Math.max(1, trayHalfX - WALL_INSET - 1.5);
		const halfZ = Math.max(1, trayHalfZ - WALL_INSET - 1.5);
		bodies.forEach((body, i) => {
			const { a, b } = offsets[i];
			const spawn = centre.clone().addScaledVector(side, a);
			spawn.x = THREE.MathUtils.clamp(spawn.x, -halfX, halfX);
			spawn.z = THREE.MathUtils.clamp(spawn.z, -halfZ, halfZ);
			spawn.y = rand(3, 5) + (b - offsets[0].b);
			const speed = rand(9, 15);
			placeDie(
				body,
				spawn,
				{ x: dir.x * speed, y: rand(1, 4), z: dir.z * speed },
				randomSpin(10, 15)
			);
		});
	};

	const setupDrop: ThrowSetup = (bodies) => {
		const offsets = gridOffsets(bodies.length);
		const zero = { x: 0, y: 0, z: 0 };
		bodies.forEach((body, i) =>
			placeDie(body, { x: offsets[i].a, y: 4, z: offsets[i].b }, zero, zero)
		);
	};

	function simulateToRest(bodies: CANNON.Body[], setup: ThrowSetup, maxSeconds = 10) {
		setup(bodies);
		const tracks: Frame[][] = bodies.map(() => []);
		for (let i = 0; i < maxSeconds / STEP; i++) {
			world.step(STEP);
			bodies.forEach((body, d) => {
				const p = body.position,
					q = body.quaternion;
				tracks[d].push([p.x, p.y, p.z, q.x, q.y, q.z, q.w]);
			});
			if (bodies.every((body) => body.sleepState === CANNON.Body.SLEEPING)) break;
		}
		return tracks;
	}

	// Simulates `count` dice together until all lie flat on a face.
	// A throw where any die balances on an edge is retried; the attempt is scored by its worst die.
	function planThrow(count: number, setup: ThrowSetup): Plan {
		const bodies = useBodies(Math.max(0, Math.floor(count)));
		let best: Plan | null = null;
		let bestScore = -Infinity;
		for (let attempt = 0; attempt < 6; attempt++) {
			const dice = simulateToRest(bodies, setup).map((frames): DieTrack => {
				const last = frames[frames.length - 1];
				return { frames, ...topFaceOf(quat.set(last[3], last[4], last[5], last[6])) };
			});
			const score = Math.min(...dice.map((d) => d.dot));
			if (!best || score > bestScore) {
				best = { dice };
				bestScore = score;
			}
			if (score > 0.995) break;
		}
		return best!;
	}

	return { layout, planThrow, setupRandomThrow, setupDrop };
}
