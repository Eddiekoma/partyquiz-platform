/**
 * Client-Side Physics for Swan Chase
 *
 * Mirrors the server physics for client-side prediction.
 * Only handles position/velocity simulation - no tagging, win conditions etc.
 */

import type { Vector2D, SwanChaseSettings, Obstacle } from "@partyquiz/shared";

/**
 * Apply one frame of movement prediction
 */
export function applyMovement(
  position: Vector2D,
  velocity: Vector2D,
  bounds: { width: number; height: number },
  margin: number = 50
): Vector2D {
  return {
    x: Math.max(margin, Math.min(bounds.width - margin, position.x + velocity.x)),
    y: Math.max(margin, Math.min(bounds.height - margin, position.y + velocity.y)),
  };
}

/**
 * Check and resolve obstacle collisions
 */
export function resolveObstacleCollisions(
  position: Vector2D,
  obstacles: Obstacle[],
  playerRadius: number = 20
): Vector2D {
  let result = { ...position };

  for (const obstacle of obstacles) {
    const dx = result.x - obstacle.position.x;
    const dy = result.y - obstacle.position.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const minDist = obstacle.radius + playerRadius;

    if (dist < minDist && dist > 0) {
      // Push player out of obstacle
      const pushX = (dx / dist) * minDist;
      const pushY = (dy / dist) * minDist;
      result = {
        x: obstacle.position.x + pushX,
        y: obstacle.position.y + pushY,
      };
    }
  }

  return result;
}

/**
 * Calculate velocity from input direction and speed
 */
export function calculateVelocity(
  direction: Vector2D,
  speed: number
): Vector2D {
  const magnitude = Math.sqrt(direction.x ** 2 + direction.y ** 2);
  if (magnitude < 0.1) return { x: 0, y: 0 };

  return {
    x: (direction.x / magnitude) * speed,
    y: (direction.y / magnitude) * speed,
  };
}

/**
 * Determine player speed based on current abilities
 */
export function getPlayerSpeed(
  settings: SwanChaseSettings,
  isSprinting: boolean,
  isDashing: boolean,
  isKing: boolean
): number {
  if (isDashing) return settings.speeds.swanDash;
  if (isSprinting) return settings.speeds.boatSprint;
  if (isKing) return settings.speeds.swan; // King uses swan speed
  return settings.speeds.boat;
}

/**
 * Linear interpolation between two 2D positions
 */
export function lerpPosition(a: Vector2D, b: Vector2D, t: number): Vector2D {
  const clamped = Math.max(0, Math.min(1, t));
  return {
    x: a.x + (b.x - a.x) * clamped,
    y: a.y + (b.y - a.y) * clamped,
  };
}

/**
 * Interpolate angle (handling wrapping)
 */
export function lerpAngle(a: number, b: number, t: number): number {
  let diff = b - a;
  // Wrap difference to [-PI, PI]
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  return a + diff * Math.max(0, Math.min(1, t));
}

/**
 * Distance between two points
 */
export function distance(a: Vector2D, b: Vector2D): number {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
}
