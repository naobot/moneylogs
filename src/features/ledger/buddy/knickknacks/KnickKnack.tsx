import { ART, GRID_SIZE, pixelPath } from "./art";
import { KNICK_KNACKS, KnickKnackId } from "./catalog";

const PATHS = Object.fromEntries(
  Object.entries(ART).map(([id, grid]) => [id, pixelPath(grid)]),
) as Record<KnickKnackId, string>;

/**
 * A knick-knack's pixel art in the current ink (night shift included). Sizes are whole
 * multiples of the 32-grid so the pixels stay crisp.
 */
const KnickKnack = ({ id, size = 64 }: { id: KnickKnackId; size?: 32 | 64 }) => (
  <svg
    className="KnickKnack"
    viewBox={`0 0 ${GRID_SIZE} ${GRID_SIZE}`}
    width={size}
    height={size}
    shapeRendering="crispEdges"
    fill="currentColor"
    role="img"
    aria-label={KNICK_KNACKS[id].name}
  >
    <path d={PATHS[id]} />
  </svg>
);

export default KnickKnack;
