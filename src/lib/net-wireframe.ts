// Draws a wireframe/template image of the UV net.
//
// corners:  netPixelCorners -> per face [pole, p1, tip, p3] in pixels
// cells:    netCells        -> per face {x, y, w, h}: kite plus flap margin
// opts.sampledPoints: per face, every pixel position the die actually samples
//                     (used to outline the area that is really visible)
// opts.edgeReach:     per face, 4 numbers: how far (px) the rounded edge shows
//                     beyond each kite edge k (corner k -> corner k+1)
//
// Blue = top faces (1-5), orange = bottom faces (6-10).

export type Point2 = [number, number];
export type Cell = { x: number; y: number; w: number; h: number };

export type WireframeOptions = {
	width?: number;
	height?: number;
	background?: string | null; // null = transparent
	lineWidth?: number;
	showLabels?: boolean;
	showCornerCoords?: boolean;
	showCells?: boolean;
	showBounds?: boolean;
	sampledPoints?: Point2[][] | null;
	edgeReach?: number[][] | null;
};

function convexHull(points: Point2[]): Point2[] {
	const pts = points.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
	if (pts.length < 3) return pts;
	const cross = (o: Point2, a: Point2, b: Point2) =>
		(a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
	const lower: Point2[] = [];
	for (const p of pts) {
		while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0)
			lower.pop();
		lower.push(p);
	}
	const upper: Point2[] = [];
	for (let i = pts.length - 1; i >= 0; i--) {
		const p = pts[i];
		while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0)
			upper.pop();
		upper.push(p);
	}
	lower.pop();
	upper.pop();
	return lower.concat(upper);
}

export function drawNetWireframe(
	corners: Point2[][],
	cells: Cell[],
	opts: WireframeOptions = {}
): HTMLCanvasElement {
	const {
		width = 1600,
		height = 900,
		background = '#111111',
		lineWidth = 2,
		showLabels = true,
		showCornerCoords = true,
		showCells = true,
		showBounds = true,
		sampledPoints = null,
		edgeReach = null
	} = opts;

	const canvas = document.createElement('canvas');
	canvas.width = width;
	canvas.height = height;
	const ctx = canvas.getContext('2d')!;

	if (background) {
		ctx.fillStyle = background;
		ctx.fillRect(0, 0, width, height);
	}

	if (showBounds) {
		ctx.strokeStyle = '#444';
		ctx.lineWidth = 1;
		ctx.strokeRect(0.5, 0.5, width - 1, height - 1);
	}

	corners.forEach((quad, i) => {
		const color = i < 5 ? '#4aa3ff' : '#ff9a3c';
		const cell = cells[i];
		const cx = (quad[0][0] + quad[1][0] + quad[2][0] + quad[3][0]) / 4;
		const cy = (quad[0][1] + quad[1][1] + quad[2][1] + quad[3][1]) / 4;

		// Cell (kite + reserved flap margin)
		if (showCells) {
			ctx.save();
			ctx.fillStyle = color;
			ctx.globalAlpha = 0.07;
			ctx.fillRect(cell.x, cell.y, cell.w, cell.h);
			ctx.globalAlpha = 0.6;
			ctx.setLineDash([4, 4]);
			ctx.strokeStyle = color;
			ctx.lineWidth = 1;
			ctx.strokeRect(cell.x + 0.5, cell.y + 0.5, cell.w - 1, cell.h - 1);
			ctx.restore();
		}

		// Area of the image that is really visible on the die (convex hull of all samples)
		if (sampledPoints && sampledPoints[i] && sampledPoints[i].length > 2) {
			const hull = convexHull(sampledPoints[i]);
			ctx.save();
			ctx.beginPath();
			hull.forEach(([x, y], n) => (n ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
			ctx.closePath();
			ctx.fillStyle = color;
			ctx.globalAlpha = 0.12;
			ctx.fill();
			ctx.globalAlpha = 0.9;
			ctx.setLineDash([3, 3]);
			ctx.strokeStyle = color;
			ctx.lineWidth = 1;
			ctx.stroke();
			ctx.restore();
		}

		// Kite outline
		ctx.beginPath();
		ctx.moveTo(quad[0][0], quad[0][1]);
		for (let k = 1; k < 4; k++) ctx.lineTo(quad[k][0], quad[k][1]);
		ctx.closePath();
		ctx.strokeStyle = color;
		ctx.lineWidth = lineWidth;
		ctx.lineJoin = 'miter';
		ctx.stroke();

		// Lines marking both ends of every edge, as long as the edge's visible reach
		if (edgeReach && edgeReach[i]) {
			ctx.save();
			ctx.strokeStyle = color;
			ctx.lineWidth = 1;
			ctx.beginPath();
			for (let k = 0; k < 4; k++) {
				const a = quad[k],
					b = quad[(k + 1) % 4];
				let nx = -(b[1] - a[1]),
					ny = b[0] - a[0];
				const l = Math.hypot(nx, ny) || 1;
				nx /= l;
				ny /= l;
				if (nx * ((a[0] + b[0]) / 2 - cx) + ny * ((a[1] + b[1]) / 2 - cy) < 0) {
					nx = -nx;
					ny = -ny;
				}
				const reach = edgeReach[i][k];
				for (const p of [a, b]) {
					ctx.moveTo(p[0], p[1]);
					ctx.lineTo(p[0] + nx * reach, p[1] + ny * reach);
				}
			}
			ctx.stroke();
			ctx.restore();
		}

		// Pole-to-tip axis and widest-point diagonal
		ctx.save();
		ctx.setLineDash([6, 6]);
		ctx.lineWidth = 1;
		ctx.globalAlpha = 0.5;
		ctx.strokeStyle = color;
		ctx.beginPath();
		ctx.moveTo(quad[0][0], quad[0][1]);
		ctx.lineTo(quad[2][0], quad[2][1]);
		ctx.moveTo(quad[1][0], quad[1][1]);
		ctx.lineTo(quad[3][0], quad[3][1]);
		ctx.stroke();
		ctx.restore();

		// Pole marker
		ctx.beginPath();
		ctx.arc(quad[0][0], quad[0][1], 5, 0, Math.PI * 2);
		ctx.fillStyle = color;
		ctx.fill();

		if (showLabels) {
			ctx.fillStyle = color;
			ctx.font = 'bold 40px sans-serif';
			ctx.textAlign = 'center';
			ctx.textBaseline = 'middle';
			ctx.fillText(String(i + 1), cx, cy);
		}

		if (showCornerCoords) {
			ctx.font = '11px monospace';
			ctx.fillStyle = '#ddd';
			quad.forEach(([x, y], k) => {
				const dx = x - cx,
					dy = y - cy;
				const d = Math.hypot(dx, dy) || 1;
				ctx.textAlign = dx > 1 ? 'left' : dx < -1 ? 'right' : 'center';
				ctx.textBaseline = dy > 1 ? 'top' : 'bottom';
				ctx.fillText(`${k}:${x},${y}`, x + (dx / d) * 4, y + (dy / d) * 4);
			});
		}
	});

	return canvas;
}

export function downloadCanvas(canvas: HTMLCanvasElement, filename = 'net-wireframe.png') {
	canvas.toBlob((blob) => {
		if (!blob) return;
		const a = document.createElement('a');
		a.href = URL.createObjectURL(blob);
		a.download = filename;
		a.click();
		URL.revokeObjectURL(a.href);
	}, 'image/png');
}
