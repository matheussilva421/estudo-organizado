// Visual Layout Lab — geometria pura do drag and drop (sem DOM).

export const DRAG_THRESHOLD = 4;
const ROW_TOLERANCE = 8;

export function exceedsThreshold(start, current, threshold = DRAG_THRESHOLD) {
  return Math.hypot(current.x - start.x, current.y - start.y) > threshold;
}

// Agrupa rects (em ordem visual) em linhas pelo topo, com tolerância.
export function groupIntoRows(rects) {
  const rows = [];
  let currentRow = null;
  let currentTop = null;
  for (const rect of rects) {
    if (currentRow === null || Math.abs(rect.top - currentTop) > ROW_TOLERANCE) {
      currentRow = [];
      rows.push(currentRow);
      currentTop = rect.top;
    }
    currentRow.push(rect);
  }
  return rows;
}

// Índice de inserção (0..n) dado o ponteiro: encontra a linha pelo eixo Y e,
// dentro dela, compara com os midpoints horizontais dos cards.
export function computeDropIndex(rects, point) {
  if (rects.length === 0) return 0;
  const rows = groupIntoRows(rects);

  let row = null;
  let indexBeforeRow = 0;
  for (const candidate of rows) {
    const top = Math.min(...candidate.map((r) => r.top));
    const bottom = Math.max(...candidate.map((r) => r.bottom));
    if (point.y < top) {
      row = candidate;
      break;
    }
    if (point.y <= bottom) {
      row = candidate;
      break;
    }
    indexBeforeRow += candidate.length;
  }
  if (row === null) return rects.length;

  let offset = 0;
  for (const rect of row) {
    const midX = (rect.left + rect.right) / 2;
    if (point.x > midX) offset += 1;
  }
  return indexBeforeRow + offset;
}

// Delta de scroll (px) quando o ponteiro se aproxima das bordas do viewport.
// Negativo = rolar para cima. Proporcional à profundidade na zona de borda.
export function autoScrollDelta(pointerY, { top, bottom, edge, maxStep }) {
  if (pointerY < top + edge) {
    const depth = Math.min(1, (top + edge - pointerY) / edge);
    return -Math.round(depth * maxStep);
  }
  if (pointerY > bottom - edge) {
    const depth = Math.min(1, (pointerY - (bottom - edge)) / edge);
    return Math.round(depth * maxStep);
  }
  return 0;
}

// Deltas FLIP: posição antiga - nova, por instanceId presente nos dois mapas.
export function computeFlipDeltas(before, after) {
  const deltas = new Map();
  for (const [id, prev] of before) {
    const next = after.get(id);
    if (!next) continue;
    const dx = prev.left - next.left;
    const dy = prev.top - next.top;
    if (dx !== 0 || dy !== 0) deltas.set(id, { dx, dy });
  }
  return deltas;
}
