import * as THREE from 'three';
import { ConvexGeometry } from 'three/examples/jsm/geometries/ConvexGeometry.js';
import type { Cell, Point2 } from '#lib/net-wireframe.ts';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------
export const TEX_W = 1600;
export const TEX_H = 900;

export type D10Options = {
	radius?: number;
	poleHeight?: number;
	bevelRadius?: number; // rounding of the die edges (3D units)
	samplesPerVertex?: number; // sphere samples per vertex for the rounded hull
	kiteLenPx?: number; // pole-to-tip length of each kite in the texture
};

export type Face3D = { corners: THREE.Vector3[]; normal: THREE.Vector3 };
export type Symmetry = {
	quat: THREE.Quaternion;
	inv: THREE.Quaternion;
	perm: number[]; // perm[f] = the face that face f is moved onto
	invPerm: number[];
};

export type D10 = ReturnType<typeof createD10>;

export function createD10(opts: D10Options = {}) {
	const {
		radius = 1.2,
		poleHeight = 1.35,
		bevelRadius = 0.25,
		samplesPerVertex = 999,
		kiteLenPx = 330
	} = opts;

	// -------------------------------------------------------------------------
	// Pentagonal trapezohedron vertices
	// -------------------------------------------------------------------------
	const tan2 = Math.pow(Math.tan(Math.PI / 10), 2);
	const ringHeight = poleHeight * tan2;

	const vTop = new THREE.Vector3(0, poleHeight, 0);
	const vBot = new THREE.Vector3(0, -poleHeight, 0);

	const upperRing: THREE.Vector3[] = [];
	const lowerRing: THREE.Vector3[] = [];
	for (let i = 0; i < 5; i++) {
		const a = (i * 2 * Math.PI) / 5;
		upperRing.push(new THREE.Vector3(radius * Math.cos(a), ringHeight, radius * Math.sin(a)));
		const b = a + Math.PI / 5;
		lowerRing.push(new THREE.Vector3(radius * Math.cos(b), -ringHeight, radius * Math.sin(b)));
	}

	const baseVertices = [vTop, vBot, ...upperRing, ...lowerRing];

	// -------------------------------------------------------------------------
	// The 10 kite faces. Corners: [pole, p1 (widest), tip, p3 (widest)]
	// -------------------------------------------------------------------------
	const faces3D: Face3D[] = [];
	const pushFace = (corners: THREE.Vector3[]) => {
		const normal = new THREE.Vector3()
			.subVectors(corners[1], corners[0])
			.cross(new THREE.Vector3().subVectors(corners[2], corners[0]))
			.normalize();
		faces3D.push({ corners, normal });
	};
	for (let i = 0; i < 5; i++) {
		const next = (i + 1) % 5;
		pushFace([vTop, upperRing[i], lowerRing[i], upperRing[next]]);
	}
	for (let i = 0; i < 5; i++) {
		const next = (i + 1) % 5;
		pushFace([vBot, lowerRing[next], upperRing[next], lowerRing[i]]);
	}
	faces3D.forEach((f) => {
		const centroid = new THREE.Vector3();
		f.corners.forEach((c) => centroid.add(c));
		centroid.multiplyScalar(0.25);
		if (f.normal.dot(centroid) < 0) f.normal.negate();
	});

	// -------------------------------------------------------------------------
	// Rounded convex die geometry
	// -------------------------------------------------------------------------
	const points: THREE.Vector3[] = [];
	baseVertices.forEach((v) => {
		points.push(v.clone());
		for (let i = 0; i < samplesPerVertex; i++) {
			const phi = Math.acos(-1 + (2 * i) / samplesPerVertex);
			const theta = Math.sqrt(samplesPerVertex * Math.PI) * phi;
			points.push(
				new THREE.Vector3(
					v.x + bevelRadius * Math.cos(theta) * Math.sin(phi),
					v.y + bevelRadius * Math.sin(theta) * Math.sin(phi),
					v.z + bevelRadius * Math.cos(phi)
				)
			);
		}
	});

	let geometry: THREE.BufferGeometry = new ConvexGeometry(points);
	if (geometry.index) geometry = geometry.toNonIndexed();
	geometry.computeVertexNormals();

	const posAttr = geometry.attributes.position;
	const normAttr = geometry.attributes.normal;
	const triCount = posAttr.count / 3;

	// -------------------------------------------------------------------------
	// Assign every triangle to ONE face and measure the reach of the rounded edge
	// -------------------------------------------------------------------------
	const rel = new THREE.Vector3();
	const vertexPos = new THREE.Vector3();
	const tmpNormal = new THREE.Vector3();
	const triNormal = new THREE.Vector3();

	const planar = faces3D.map((face) => {
		const [p0, p1] = face.corners;
		const u = new THREE.Vector3().subVectors(p1, p0).normalize();
		const w = new THREE.Vector3().crossVectors(face.normal, u);
		const to2 = (p: THREE.Vector3): Point2 => {
			rel.subVectors(p, p0);
			return [rel.dot(u), rel.dot(w)];
		};
		return { to2, poly: face.corners.map(to2) };
	});

	function distOutsidePoly(P: Point2, poly: Point2[]) {
		let sign = 0,
			inside = true,
			best = Infinity;
		for (let k = 0; k < poly.length; k++) {
			const a = poly[k],
				b = poly[(k + 1) % poly.length];
			const ex = b[0] - a[0],
				ey = b[1] - a[1];
			const c = ex * (P[1] - a[1]) - ey * (P[0] - a[0]);
			if (c !== 0) {
				if (sign === 0) sign = Math.sign(c);
				else if (Math.sign(c) !== sign) inside = false;
			}
			const t = THREE.MathUtils.clamp(
				((P[0] - a[0]) * ex + (P[1] - a[1]) * ey) / (ex * ex + ey * ey),
				0,
				1
			);
			best = Math.min(best, Math.hypot(P[0] - (a[0] + t * ex), P[1] - (a[1] + t * ey)));
		}
		return inside ? 0 : best;
	}

	const triFace = new Int8Array(triCount);
	let maxOutsideUnits = 0;
	for (let tri = 0; tri < triCount; tri++) {
		triNormal.set(0, 0, 0);
		for (let k = 0; k < 3; k++) triNormal.add(tmpNormal.fromBufferAttribute(normAttr, tri * 3 + k));
		triNormal.normalize();

		let bestFace = 0,
			maxDot = -Infinity;
		for (let f = 0; f < 10; f++) {
			const dot = triNormal.dot(faces3D[f].normal);
			if (dot > maxDot) {
				maxDot = dot;
				bestFace = f;
			}
		}
		triFace[tri] = bestFace;

		for (let k = 0; k < 3; k++) {
			vertexPos.fromBufferAttribute(posAttr, tri * 3 + k);
			const d = distOutsidePoly(planar[bestFace].to2(vertexPos), planar[bestFace].poly);
			if (d > maxOutsideUnits) maxOutsideUnits = d;
		}
	}

	const edgeReachUnits = faces3D.map((face, i) =>
		face.corners.map((a, k) => {
			const b = face.corners[(k + 1) % 4];
			const nb = faces3D.find((g, j) => j !== i && g.corners.includes(a) && g.corners.includes(b))!;
			const ang = Math.acos(THREE.MathUtils.clamp(face.normal.dot(nb.normal), -1, 1));
			return bevelRadius * Math.sin(ang / 2);
		})
	);

	// -------------------------------------------------------------------------
	// Texture layout: one padded cell per face
	// -------------------------------------------------------------------------
	const pxToUV = (x: number, y: number): Point2 => [x / TEX_W, 1.0 - y / TEX_H];

	const len3D = faces3D[0].corners[0].distanceTo(faces3D[0].corners[2]);
	const pxPerUnit = kiteLenPx / len3D;

	const FLAP_PX = Math.ceil(maxOutsideUnits * pxPerUnit) + 2;
	const edgeReachPx = edgeReachUnits.map((r) => r.map((u) => u * pxPerUnit));

	const d1_0 = new THREE.Vector3().subVectors(faces3D[0].corners[1], faces3D[0].corners[0]);
	const axis0 = new THREE.Vector3()
		.subVectors(faces3D[0].corners[2], faces3D[0].corners[0])
		.normalize();
	const alongF = d1_0.dot(axis0) * pxPerUnit;
	const along = Math.round(alongF);
	const perp = Math.round(Math.sqrt(d1_0.lengthSq() * pxPerUnit * pxPerUnit - alongF * alongF));

	const CELL_W = 2 * perp + 2 * FLAP_PX;
	const CELL_H = kiteLenPx + 2 * FLAP_PX;
	if (5 * CELL_W > TEX_W || 2 * CELL_H > TEX_H) {
		console.warn(
			`Cells (${CELL_W}x${CELL_H}) do not fit the ${TEX_W}x${TEX_H} texture. Lower kiteLenPx or bevelRadius.`
		);
	}
	const X0 = Math.floor((TEX_W - 5 * CELL_W) / 2);
	const Y0 = Math.floor((TEX_H - 2 * CELL_H) / 2);

	const netCells: Cell[] = faces3D.map((_, i) => ({
		x: X0 + (i % 5) * CELL_W,
		y: Y0 + Math.floor(i / 5) * CELL_H,
		w: CELL_W,
		h: CELL_H
	}));

	const netPixelCorners: Point2[][] = faces3D.map((face, i) => {
		const [p0, p1, , p3] = face.corners;
		const handed =
			Math.sign(
				new THREE.Vector3()
					.subVectors(p1, p0)
					.cross(new THREE.Vector3().subVectors(p3, p0))
					.dot(face.normal)
			) || 1;
		const side = -handed;
		const c = netCells[i];
		const cx = c.x + c.w / 2;
		const y0 = c.y + FLAP_PX;
		return [
			[cx, y0],
			[cx + side * perp, y0 + along],
			[cx, y0 + kiteLenPx],
			[cx - side * perp, y0 + along]
		];
	});

	// -------------------------------------------------------------------------
	// UV mapping
	// -------------------------------------------------------------------------
	const faceBasis = faces3D.map((face, f) => {
		const [p0, p1, , p3] = face.corners;
		const e1 = new THREE.Vector3().subVectors(p1, p0);
		const e2 = new THREE.Vector3().subVectors(p3, p0);
		const d11 = e1.dot(e1),
			d12 = e1.dot(e2),
			d22 = e2.dot(e2);
		return {
			p0,
			e1,
			e2,
			d11,
			d12,
			d22,
			denom: d11 * d22 - d12 * d12,
			quad: netPixelCorners[f],
			cell: netCells[f]
		};
	});

	function mapToCellPx(faceIdx: number, pos: THREE.Vector3): Point2 {
		const b = faceBasis[faceIdx];
		rel.subVectors(pos, b.p0);
		const r1 = rel.dot(b.e1);
		const r2 = rel.dot(b.e2);
		const s = (b.d22 * r1 - b.d12 * r2) / b.denom;
		const t = (b.d11 * r2 - b.d12 * r1) / b.denom;
		const [q0, q1, , q3] = b.quad;
		let px = q0[0] + s * (q1[0] - q0[0]) + t * (q3[0] - q0[0]);
		let py = q0[1] + s * (q1[1] - q0[1]) + t * (q3[1] - q0[1]);
		px = THREE.MathUtils.clamp(px, b.cell.x + 1, b.cell.x + b.cell.w - 1);
		py = THREE.MathUtils.clamp(py, b.cell.y + 1, b.cell.y + b.cell.h - 1);
		return [px, py];
	}

	const uvArray = new Float32Array(posAttr.count * 2);
	const uvAttr = new THREE.BufferAttribute(uvArray, 2);
	geometry.setAttribute('uv', uvAttr);

	// The 10 rotations mapping the d10 onto itself
	const symmetries: Symmetry[] = [];
	{
		const Y = new THREE.Vector3(0, 1, 0);
		const c2 = new THREE.Vector3(Math.cos(Math.PI / 10), 0, Math.sin(Math.PI / 10));
		const flip = new THREE.Quaternion().setFromAxisAngle(c2, Math.PI);
		const n = new THREE.Vector3();
		for (let m = 0; m < 5; m++) {
			const ry = new THREE.Quaternion().setFromAxisAngle(Y, (2 * Math.PI * m) / 5);
			for (const quat of [ry, ry.clone().multiply(flip)]) {
				const perm = faces3D.map((face) => {
					n.copy(face.normal).applyQuaternion(quat);
					let best = 0,
						bestDot = -Infinity;
					faces3D.forEach((g, j) => {
						const d = n.dot(g.normal);
						if (d > bestDot) {
							bestDot = d;
							best = j;
						}
					});
					return best;
				});
				const invPerm: number[] = [];
				perm.forEach((g, f) => (invPerm[g] = f));
				symmetries.push({ quat, inv: quat.clone().invert(), perm, invPerm });
			}
		}
		if (symmetries.some((sym) => new Set(sym.perm).size !== 10)) {
			console.warn('Symmetry check failed: the die geometry is not a regular d10.');
		}
	}

	// Choose which cell (= number of the artwork) is shown on which face.
	function applyLabeling(sym: Symmetry, collect: Point2[][] | null = null) {
		for (let tri = 0; tri < triCount; tri++) {
			const f = sym.invPerm[triFace[tri]];
			for (let k = 0; k < 3; k++) {
				const idx = tri * 3 + k;
				vertexPos.fromBufferAttribute(posAttr, idx).applyQuaternion(sym.inv);
				const [px, py] = mapToCellPx(f, vertexPos);
				if (collect) collect[f].push([px, py]);
				const [u, v] = pxToUV(px, py);
				uvArray[idx * 2] = u;
				uvArray[idx * 2 + 1] = v;
			}
		}
		uvAttr.needsUpdate = true;
	}

	const sampledPoints: Point2[][] = faces3D.map(() => []);
	applyLabeling(symmetries[0], sampledPoints);

	return {
		geometry,
		baseVertices,
		faces3D,
		bevelRadius,
		symmetries,
		applyLabeling,
		netCells,
		netPixelCorners,
		sampledPoints,
		edgeReachPx
	};
}
