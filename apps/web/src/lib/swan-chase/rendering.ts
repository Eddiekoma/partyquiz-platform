/**
 * Swan Chase Rendering Module
 *
 * Professional Canvas 2D rendering utilities for the Swan Chase mini-game.
 * CPU-friendly (no WebGL/GPU required). Uses layered rendering, seeded RNG
 * for deterministic obstacles, and offscreen canvas caching for performance.
 */

import type {
  SwanChaseGameState,
  SwanChasePlayer,
  SwanChaseSettings,
  Vector2D,
  Obstacle,
  SafeZone,
} from "@partyquiz/shared";
import { SwanChasePlayerStatus, SwanChaseTeam } from "@partyquiz/shared";

// ============================================================================
// COLOR PALETTE
// ============================================================================

export const COLORS = {
  water: {
    deep: '#0a2463',
    mid: '#1e3a8a',
    light: '#1d4ed8',
    surface: '#2563eb',
    foam: '#bfdbfe',
    highlight: '#93c5fd',
  },
  boat: {
    hull: '#2563eb',
    hullDark: '#1d4ed8',
    deck: '#3b82f6',
    trim: '#1e40af',
  },
  swan: {
    body: '#f8fafc',
    wing: '#e2e8f0',
    beak: '#f97316',
    eye: '#1e293b',
  },
  aiSwan: {
    body: '#fca5a5',
    wing: '#f87171',
    beak: '#dc2626',
    eye: '#7f1d1d',
    glow: '#ef4444',
  },
  team: {
    blue: '#3b82f6',
    white: '#f1f5f9',
    solo: '#6366f1',
    coop: '#8b5cf6',
    king: '#f59e0b',
    kingGlow: '#fbbf24',
  },
  safe: {
    primary: '#22c55e',
    glow: '#4ade80',
    ring: '#86efac',
  },
  danger: '#ef4444',
  hud: {
    bg: 'rgba(15, 23, 42, 0.85)',
    bgLight: 'rgba(30, 41, 59, 0.75)',
    text: '#f8fafc',
    textDim: '#94a3b8',
    border: 'rgba(148, 163, 184, 0.3)',
  },
} as const;

const FONT = {
  primary: '"Trebuchet MS", "Segoe UI", system-ui, sans-serif',
  mono: '"SF Mono", "Cascadia Code", "Fira Code", monospace',
};

// ============================================================================
// SEEDED PRNG (for deterministic obstacle rendering)
// ============================================================================

function hashCode(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash);
}

export function createSeededRNG(seed: string): () => number {
  let state = hashCode(seed);
  return () => {
    state = (state * 1664525 + 1013904223) & 0xffffffff;
    return (state >>> 0) / 0xffffffff;
  };
}

// ============================================================================
// OBSTACLE VERTEX CACHE
// ============================================================================

const obstacleVertexCache = new Map<string, Array<{ x: number; y: number }>>();
const obstaclePalmCache = new Map<string, { trunkAngle: number; leafAngles: number[]; coconuts: Array<{ x: number; y: number }> }>();

function getObstacleVertices(obstacle: Obstacle): Array<{ x: number; y: number }> {
  const cached = obstacleVertexCache.get(obstacle.id);
  if (cached) return cached;

  const rng = createSeededRNG(obstacle.id);
  const vertices: Array<{ x: number; y: number }> = [];

  if (obstacle.type === 'ROCK') {
    const numPoints = 7 + Math.floor(rng() * 4);
    for (let i = 0; i < numPoints; i++) {
      const angle = (i / numPoints) * Math.PI * 2;
      const radiusVariation = 0.7 + rng() * 0.5;
      vertices.push({
        x: Math.cos(angle) * obstacle.radius * radiusVariation,
        y: Math.sin(angle) * obstacle.radius * radiusVariation,
      });
    }
  } else {
    // Island - more circular
    const numPoints = 12;
    for (let i = 0; i < numPoints; i++) {
      const angle = (i / numPoints) * Math.PI * 2;
      const radiusVariation = 0.9 + rng() * 0.15;
      vertices.push({
        x: Math.cos(angle) * obstacle.radius * radiusVariation,
        y: Math.sin(angle) * obstacle.radius * radiusVariation,
      });
    }
  }

  obstacleVertexCache.set(obstacle.id, vertices);
  return vertices;
}

function getPalmData(obstacle: Obstacle) {
  const cached = obstaclePalmCache.get(obstacle.id);
  if (cached) return cached;

  const rng = createSeededRNG(obstacle.id + '_palm');
  const data = {
    trunkAngle: (rng() - 0.5) * 0.4,
    leafAngles: Array.from({ length: 5 }, () => rng() * Math.PI * 2),
    coconuts: Array.from({ length: 2 }, () => ({
      x: (rng() - 0.5) * 6,
      y: -obstacle.radius * 0.5 + rng() * 5,
    })),
  };
  obstaclePalmCache.set(obstacle.id, data);
  return data;
}

// ============================================================================
// WATER RENDERING
// ============================================================================

let waterBaseCanvas: OffscreenCanvas | null = null;
let waterBaseSize = { w: 0, h: 0 };

function ensureWaterBase(width: number, height: number): OffscreenCanvas {
  if (waterBaseCanvas && waterBaseSize.w === width && waterBaseSize.h === height) {
    return waterBaseCanvas;
  }

  waterBaseCanvas = new OffscreenCanvas(width, height);
  waterBaseSize = { w: width, h: height };
  const ctx = waterBaseCanvas.getContext('2d')!;

  // Deep blue gradient
  const gradient = ctx.createLinearGradient(0, 0, 0, height);
  gradient.addColorStop(0, COLORS.water.deep);
  gradient.addColorStop(0.3, COLORS.water.mid);
  gradient.addColorStop(0.7, COLORS.water.light);
  gradient.addColorStop(1, COLORS.water.surface);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  return waterBaseCanvas;
}

export function drawWater(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  time: number,
  maxWaveLayers: number = 4,
  drawFoam: boolean = true,
): void {
  // Blit cached water base gradient
  const baseCanvas = ensureWaterBase(width, height);
  ctx.drawImage(baseCanvas, 0, 0);

  // Animated wave layers (adaptive: 4 at HIGH, 2 at MEDIUM, 0 at LOW)
  if (maxWaveLayers > 0) {
    const allLayers = [
      { amplitude: 6, frequency: 0.004, speed: 0.3, color: COLORS.water.highlight, alpha: 0.06, yOffset: 0 },
      { amplitude: 4, frequency: 0.007, speed: 0.5, color: COLORS.water.foam, alpha: 0.05, yOffset: 0.3 },
      { amplitude: 3, frequency: 0.012, speed: 0.8, color: COLORS.water.highlight, alpha: 0.04, yOffset: 0.6 },
      { amplitude: 2, frequency: 0.02, speed: 1.2, color: '#ffffff', alpha: 0.03, yOffset: 0.8 },
    ];
    const layers = allLayers.slice(0, maxWaveLayers);

    for (const layer of layers) {
      ctx.strokeStyle = layer.color;
      ctx.globalAlpha = layer.alpha;
      ctx.lineWidth = 1.5;

      const yBase = height * layer.yOffset;
      const numLines = 6;
      const lineSpacing = (height * 0.25) / numLines;

      for (let line = 0; line < numLines; line++) {
        ctx.beginPath();
        const y = yBase + line * lineSpacing;
        for (let x = 0; x < width; x += 4) {
          const wave = Math.sin((x * layer.frequency) + (time * layer.speed) + line * 0.8) * layer.amplitude;
          const wave2 = Math.sin((x * layer.frequency * 1.5) + (time * layer.speed * 0.7) + line) * layer.amplitude * 0.5;
          if (x === 0) {
            ctx.moveTo(x, y + wave + wave2);
          } else {
            ctx.lineTo(x, y + wave + wave2);
          }
        }
        ctx.stroke();
      }
    }
  }

  // Foam highlights at wave peaks (skip at LOW quality)
  if (drawFoam) {
    ctx.globalAlpha = 0.08;
    ctx.fillStyle = '#ffffff';
    for (let x = 0; x < width; x += 80) {
      const phaseOffset = hashCode(`foam_${Math.floor(x / 80)}`) * 0.01;
      const y = height * 0.4 + Math.sin(x * 0.003 + time * 0.4 + phaseOffset) * 8;
      const foamWidth = 20 + Math.sin(time * 0.6 + x * 0.01) * 10;
      ctx.beginPath();
      ctx.ellipse(x, y, foamWidth, 2, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  ctx.globalAlpha = 1;
}

// ============================================================================
// BOAT SPRITE
// ============================================================================

export function drawBoatSprite(
  ctx: CanvasRenderingContext2D,
  player: SwanChasePlayer,
  time: number,
  isLocalPlayer: boolean = false
): void {
  const { position, rotation, status, team, abilities } = player;

  ctx.save();
  ctx.translate(position.x, position.y);
  ctx.rotate(rotation);

  // Determine colors based on team/mode
  const isKing = status === SwanChasePlayerStatus.KING;
  const isSolo = team === SwanChaseTeam.SOLO;
  const isCoop = team === SwanChaseTeam.COOP;
  const isGhosted = status === SwanChasePlayerStatus.TAGGED || status === SwanChasePlayerStatus.ELIMINATED;

  const hullColor = isKing ? COLORS.team.king
    : isSolo ? COLORS.team.solo
    : isCoop ? COLORS.team.coop
    : COLORS.boat.hull;

  if (isGhosted) {
    ctx.globalAlpha = 0.35;
  }

  // Shadow
  ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
  ctx.beginPath();
  ctx.ellipse(3, 4, 18, 8, 0, 0, Math.PI * 2);
  ctx.fill();

  // Wake trail (only when moving)
  const speed = Math.sqrt(player.velocity.x ** 2 + player.velocity.y ** 2);
  if (speed > 0.5 && !isGhosted) {
    ctx.globalAlpha = isGhosted ? 0.1 : 0.15;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.5;
    // Left wake line
    ctx.beginPath();
    ctx.moveTo(-12, -4);
    ctx.lineTo(-25 - speed * 2, -12 - speed);
    ctx.stroke();
    // Right wake line
    ctx.beginPath();
    ctx.moveTo(-12, 4);
    ctx.lineTo(-25 - speed * 2, 12 + speed);
    ctx.stroke();
    // Center wake
    ctx.globalAlpha = 0.08;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-14, 0);
    ctx.lineTo(-30 - speed * 3, 0);
    ctx.stroke();
    ctx.globalAlpha = isGhosted ? 0.35 : 1;
  }

  // Hull
  const hullGradient = ctx.createLinearGradient(-15, -12, -15, 12);
  hullGradient.addColorStop(0, hullColor);
  hullGradient.addColorStop(1, adjustColor(hullColor, -30));
  ctx.fillStyle = hullGradient;
  ctx.beginPath();
  ctx.moveTo(22, 0);        // Bow
  ctx.quadraticCurveTo(18, -10, 5, -12);
  ctx.lineTo(-16, -10);
  ctx.quadraticCurveTo(-20, -8, -20, 0);
  ctx.quadraticCurveTo(-20, 8, -16, 10);
  ctx.lineTo(5, 12);
  ctx.quadraticCurveTo(18, 10, 22, 0);
  ctx.closePath();
  ctx.fill();

  // Hull outline
  ctx.strokeStyle = adjustColor(hullColor, -50);
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Deck line
  ctx.strokeStyle = 'rgba(255,255,255,0.3)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(-14, 0);
  ctx.lineTo(16, 0);
  ctx.stroke();

  // Deck detail - small cabin
  ctx.fillStyle = 'rgba(255,255,255,0.2)';
  ctx.fillRect(-8, -4, 10, 8);
  ctx.strokeStyle = 'rgba(255,255,255,0.15)';
  ctx.strokeRect(-8, -4, 10, 8);

  // Sprint glow
  if (abilities.sprint.active && !isGhosted) {
    ctx.globalAlpha = 0.3 + Math.sin(time * 10) * 0.1;
    ctx.strokeStyle = '#60a5fa';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(22, 0);
    ctx.quadraticCurveTo(18, -10, 5, -12);
    ctx.lineTo(-16, -10);
    ctx.quadraticCurveTo(-20, -8, -20, 0);
    ctx.quadraticCurveTo(-20, 8, -16, 10);
    ctx.lineTo(5, 12);
    ctx.quadraticCurveTo(18, 10, 22, 0);
    ctx.closePath();
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  // Dash glow
  if (abilities.dash?.active && !isGhosted) {
    ctx.globalAlpha = 0.4 + Math.sin(time * 12) * 0.15;
    ctx.strokeStyle = '#f97316';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(0, 0, 20, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  // King crown
  if (isKing) {
    drawCrown(ctx, 0, -20, time);
  }

  // Tagged X overlay
  if (status === SwanChasePlayerStatus.TAGGED) {
    ctx.strokeStyle = '#ef4444';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-10, -10);
    ctx.lineTo(10, 10);
    ctx.moveTo(10, -10);
    ctx.lineTo(-10, 10);
    ctx.stroke();
  }

  // Safe checkmark
  if (status === SwanChasePlayerStatus.SAFE) {
    ctx.strokeStyle = '#22c55e';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-8, 0);
    ctx.lineTo(-2, 8);
    ctx.lineTo(10, -8);
    ctx.stroke();
  }

  // Local player indicator
  if (isLocalPlayer && !isGhosted) {
    ctx.strokeStyle = '#fbbf24';
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.arc(0, 0, 26, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  ctx.restore();
}

// ============================================================================
// SWAN SPRITE
// ============================================================================

export function drawSwanSprite(
  ctx: CanvasRenderingContext2D,
  player: SwanChasePlayer,
  time: number,
  isLocalPlayer: boolean = false
): void {
  const { position, rotation, status, abilities } = player;
  const isDashing = status === SwanChasePlayerStatus.DASHING;
  const isGhosted = status === SwanChasePlayerStatus.TAGGED || status === SwanChasePlayerStatus.ELIMINATED;

  ctx.save();
  ctx.translate(position.x, position.y);
  ctx.rotate(rotation);

  if (isGhosted) {
    ctx.globalAlpha = 0.35;
  }

  // Shadow
  ctx.fillStyle = 'rgba(0, 0, 0, 0.15)';
  ctx.beginPath();
  ctx.ellipse(2, 5, 16, 7, 0, 0, Math.PI * 2);
  ctx.fill();

  // Wing flap animation
  const wingFlap = isDashing
    ? Math.sin(time * 15) * 0.4  // Fast flap when dashing
    : Math.sin(time * 2) * 0.1;   // Gentle bob normally

  // Body bob
  const bob = Math.sin(time * 3) * 1.5;

  ctx.translate(0, bob);

  // Body
  const bodyGradient = ctx.createRadialGradient(0, 0, 0, 0, 0, 14);
  bodyGradient.addColorStop(0, COLORS.swan.body);
  bodyGradient.addColorStop(1, COLORS.swan.wing);
  ctx.fillStyle = bodyGradient;
  ctx.beginPath();
  ctx.ellipse(0, 0, 14, 10, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#cbd5e1';
  ctx.lineWidth = 1;
  ctx.stroke();

  // Left wing
  ctx.save();
  ctx.rotate(-wingFlap);
  ctx.fillStyle = COLORS.swan.wing;
  ctx.beginPath();
  ctx.moveTo(-2, -4);
  ctx.quadraticCurveTo(-12, -14 - Math.abs(wingFlap) * 10, -6, -2);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  // Right wing
  ctx.save();
  ctx.rotate(wingFlap);
  ctx.fillStyle = COLORS.swan.wing;
  ctx.beginPath();
  ctx.moveTo(-2, 4);
  ctx.quadraticCurveTo(-12, 14 + Math.abs(wingFlap) * 10, -6, 2);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  // Neck
  ctx.strokeStyle = COLORS.swan.body;
  ctx.lineWidth = 4;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(8, 0);
  ctx.quadraticCurveTo(16, -6, 20, -10);
  ctx.stroke();

  // Head
  ctx.fillStyle = COLORS.swan.body;
  ctx.beginPath();
  ctx.arc(20, -10, 5, 0, Math.PI * 2);
  ctx.fill();

  // Beak
  ctx.fillStyle = COLORS.swan.beak;
  ctx.beginPath();
  ctx.moveTo(24, -11);
  ctx.lineTo(30, -10);
  ctx.lineTo(24, -9);
  ctx.closePath();
  ctx.fill();

  // Eye
  ctx.fillStyle = COLORS.swan.eye;
  ctx.beginPath();
  ctx.arc(21, -11, 1.5, 0, Math.PI * 2);
  ctx.fill();

  // Dash glow
  if (isDashing && !isGhosted) {
    ctx.globalAlpha = 0.3 + Math.sin(time * 10) * 0.15;
    ctx.strokeStyle = '#f97316';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.ellipse(0, 0, 20, 16, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = isGhosted ? 0.35 : 1;
  }

  // Local player indicator
  if (isLocalPlayer && !isGhosted) {
    ctx.strokeStyle = '#fbbf24';
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.arc(0, 0, 24, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  ctx.restore();
}

// ============================================================================
// AI SWAN SPRITE
// ============================================================================

export function drawAISwanSprite(
  ctx: CanvasRenderingContext2D,
  ai: { position: Vector2D; rotation: number; velocity: Vector2D },
  time: number
): void {
  ctx.save();
  ctx.translate(ai.position.x, ai.position.y);
  ctx.rotate(ai.rotation);

  // Menacing glow
  ctx.globalAlpha = 0.15 + Math.sin(time * 4) * 0.05;
  ctx.fillStyle = COLORS.aiSwan.glow;
  ctx.beginPath();
  ctx.arc(0, 0, 22, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;

  // Shadow
  ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
  ctx.beginPath();
  ctx.ellipse(2, 4, 14, 6, 0, 0, Math.PI * 2);
  ctx.fill();

  // Wing flap
  const wingFlap = Math.sin(time * 8) * 0.3;
  const bob = Math.sin(time * 4) * 1;
  ctx.translate(0, bob);

  // Body
  ctx.fillStyle = COLORS.aiSwan.body;
  ctx.beginPath();
  ctx.ellipse(0, 0, 12, 9, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = COLORS.aiSwan.wing;
  ctx.lineWidth = 1;
  ctx.stroke();

  // Wings
  ctx.save();
  ctx.rotate(-wingFlap);
  ctx.fillStyle = COLORS.aiSwan.wing;
  ctx.beginPath();
  ctx.moveTo(-2, -3);
  ctx.quadraticCurveTo(-10, -12, -5, -1);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  ctx.save();
  ctx.rotate(wingFlap);
  ctx.fillStyle = COLORS.aiSwan.wing;
  ctx.beginPath();
  ctx.moveTo(-2, 3);
  ctx.quadraticCurveTo(-10, 12, -5, 1);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  // Neck
  ctx.strokeStyle = COLORS.aiSwan.body;
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(7, 0);
  ctx.quadraticCurveTo(14, -5, 17, -8);
  ctx.stroke();

  // Head
  ctx.fillStyle = COLORS.aiSwan.body;
  ctx.beginPath();
  ctx.arc(17, -8, 4, 0, Math.PI * 2);
  ctx.fill();

  // Beak
  ctx.fillStyle = COLORS.aiSwan.beak;
  ctx.beginPath();
  ctx.moveTo(20, -9);
  ctx.lineTo(26, -8);
  ctx.lineTo(20, -7);
  ctx.closePath();
  ctx.fill();

  // Glowing red eyes
  const eyeGlow = 0.6 + Math.sin(time * 6) * 0.4;
  ctx.fillStyle = `rgba(239, 68, 68, ${eyeGlow})`;
  ctx.beginPath();
  ctx.arc(18, -9, 2, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

// ============================================================================
// CROWN
// ============================================================================

function drawCrown(ctx: CanvasRenderingContext2D, x: number, y: number, time: number): void {
  const bob = Math.sin(time * 3) * 2;
  ctx.save();
  ctx.translate(x, y + bob);

  // Crown body
  const gradient = ctx.createLinearGradient(-10, -8, -10, 4);
  gradient.addColorStop(0, '#fde68a');
  gradient.addColorStop(0.5, '#f59e0b');
  gradient.addColorStop(1, '#d97706');
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.moveTo(-10, 4);
  ctx.lineTo(-10, -4);
  ctx.lineTo(-6, 0);
  ctx.lineTo(-2, -8);
  ctx.lineTo(2, -2);
  ctx.lineTo(6, -6);
  ctx.lineTo(10, 0);
  ctx.lineTo(10, 4);
  ctx.closePath();
  ctx.fill();

  // Crown outline
  ctx.strokeStyle = '#92400e';
  ctx.lineWidth = 1;
  ctx.stroke();

  // Gems
  ctx.fillStyle = '#ef4444';
  ctx.beginPath();
  ctx.arc(-2, -2, 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#3b82f6';
  ctx.beginPath();
  ctx.arc(5, -1, 1.5, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

// ============================================================================
// OBSTACLES
// ============================================================================

let obstacleLayerCanvas: OffscreenCanvas | null = null;
let obstacleLayerKey = '';

export function drawObstacles(
  ctx: CanvasRenderingContext2D,
  obstacles: Obstacle[],
  width: number,
  height: number,
  time: number
): void {
  // Cache key based on obstacle positions (they don't move)
  const key = obstacles.map(o => `${o.id}_${o.position.x}_${o.position.y}`).join('|');

  if (obstacleLayerCanvas && obstacleLayerKey === key) {
    ctx.drawImage(obstacleLayerCanvas, 0, 0);
    // Draw animated water rings around obstacles (not cached)
    drawObstacleWaterRings(ctx, obstacles, time);
    return;
  }

  // Render obstacles to offscreen canvas
  obstacleLayerCanvas = new OffscreenCanvas(width, height);
  obstacleLayerKey = key;
  const offCtx = obstacleLayerCanvas.getContext('2d')! as unknown as CanvasRenderingContext2D;

  for (const obstacle of obstacles) {
    drawSingleObstacle(offCtx, obstacle);
  }

  ctx.drawImage(obstacleLayerCanvas, 0, 0);
  drawObstacleWaterRings(ctx, obstacles, time);
}

function drawObstacleWaterRings(ctx: CanvasRenderingContext2D, obstacles: Obstacle[], time: number): void {
  for (const obstacle of obstacles) {
    ctx.save();
    ctx.translate(obstacle.position.x, obstacle.position.y);

    // Animated water ring
    const ringRadius = obstacle.radius + 8 + Math.sin(time * 2) * 2;
    ctx.strokeStyle = 'rgba(147, 197, 253, 0.2)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, ringRadius, 0, Math.PI * 2);
    ctx.stroke();

    ctx.restore();
  }
}

function drawSingleObstacle(ctx: CanvasRenderingContext2D, obstacle: Obstacle): void {
  const vertices = getObstacleVertices(obstacle);

  ctx.save();
  ctx.translate(obstacle.position.x, obstacle.position.y);

  // Shadow
  ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
  ctx.beginPath();
  ctx.moveTo(vertices[0].x + 4, vertices[0].y + 4);
  for (let i = 1; i < vertices.length; i++) {
    ctx.lineTo(vertices[i].x + 4, vertices[i].y + 4);
  }
  ctx.closePath();
  ctx.fill();

  if (obstacle.type === 'ROCK') {
    // Rock body
    const gradient = ctx.createRadialGradient(-5, -5, 0, 0, 0, obstacle.radius);
    gradient.addColorStop(0, '#9ca3af');
    gradient.addColorStop(0.5, '#6b7280');
    gradient.addColorStop(1, '#4b5563');
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.moveTo(vertices[0].x, vertices[0].y);
    for (let i = 1; i < vertices.length; i++) {
      ctx.lineTo(vertices[i].x, vertices[i].y);
    }
    ctx.closePath();
    ctx.fill();

    // Rock outline
    ctx.strokeStyle = '#374151';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Highlight on top-left
    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    ctx.beginPath();
    ctx.arc(-obstacle.radius * 0.3, -obstacle.radius * 0.3, obstacle.radius * 0.4, 0, Math.PI * 2);
    ctx.fill();

    // Moss spots
    const rng = createSeededRNG(obstacle.id + '_moss');
    ctx.fillStyle = 'rgba(34, 197, 94, 0.3)';
    for (let i = 0; i < 3; i++) {
      const mx = (rng() - 0.5) * obstacle.radius;
      const my = (rng() - 0.5) * obstacle.radius * 0.5 + obstacle.radius * 0.2;
      ctx.beginPath();
      ctx.arc(mx, my, 3 + rng() * 3, 0, Math.PI * 2);
      ctx.fill();
    }

  } else {
    // Island - green with sand ring
    // Sand ring
    ctx.fillStyle = '#d4a574';
    ctx.beginPath();
    ctx.arc(0, 0, obstacle.radius + 3, 0, Math.PI * 2);
    ctx.fill();

    // Green base
    const islandGradient = ctx.createRadialGradient(0, 0, 0, 0, 0, obstacle.radius);
    islandGradient.addColorStop(0, '#22c55e');
    islandGradient.addColorStop(0.7, '#16a34a');
    islandGradient.addColorStop(1, '#15803d');
    ctx.fillStyle = islandGradient;
    ctx.beginPath();
    ctx.moveTo(vertices[0].x, vertices[0].y);
    for (let i = 1; i < vertices.length; i++) {
      ctx.lineTo(vertices[i].x, vertices[i].y);
    }
    ctx.closePath();
    ctx.fill();

    // Island outline
    ctx.strokeStyle = '#166534';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Palm tree
    const palm = getPalmData(obstacle);
    const trunkBase = { x: 0, y: 0 };
    const trunkTop = { x: Math.sin(palm.trunkAngle) * obstacle.radius * 0.6, y: -obstacle.radius * 0.8 };

    // Trunk
    ctx.strokeStyle = '#92400e';
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(trunkBase.x, trunkBase.y);
    ctx.quadraticCurveTo(trunkTop.x * 0.5, trunkTop.y * 0.6, trunkTop.x, trunkTop.y);
    ctx.stroke();

    // Trunk texture
    ctx.strokeStyle = '#78350f';
    ctx.lineWidth = 0.5;
    for (let i = 0; i < 4; i++) {
      const t = 0.2 + (i / 4) * 0.6;
      const px = trunkBase.x + (trunkTop.x - trunkBase.x) * t;
      const py = trunkBase.y + (trunkTop.y - trunkBase.y) * t;
      ctx.beginPath();
      ctx.moveTo(px - 3, py);
      ctx.lineTo(px + 3, py);
      ctx.stroke();
    }

    // Leaves
    ctx.fillStyle = '#15803d';
    for (const angle of palm.leafAngles) {
      ctx.save();
      ctx.translate(trunkTop.x, trunkTop.y);
      ctx.rotate(angle);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.quadraticCurveTo(15, -5, 25, 4);
      ctx.quadraticCurveTo(12, 2, 0, 0);
      ctx.fill();
      ctx.restore();
    }

    // Coconuts
    ctx.fillStyle = '#92400e';
    for (const coconut of palm.coconuts) {
      ctx.beginPath();
      ctx.arc(trunkTop.x + coconut.x, trunkTop.y + coconut.y, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  ctx.restore();
}

// ============================================================================
// SAFE ZONE
// ============================================================================

export function drawSafeZone(
  ctx: CanvasRenderingContext2D,
  safeZone: SafeZone,
  time: number
): void {
  if (safeZone.radius <= 0) return;

  const { position, radius } = safeZone;
  ctx.save();
  ctx.translate(position.x, position.y);

  // Outer glow
  const glowPulse = 0.08 + Math.sin(time * 2) * 0.04;
  ctx.globalAlpha = glowPulse;
  ctx.fillStyle = COLORS.safe.glow;
  ctx.beginPath();
  ctx.arc(0, 0, radius + 20, 0, Math.PI * 2);
  ctx.fill();

  // Expanding rings
  for (let i = 0; i < 3; i++) {
    const ringPhase = ((time * 0.5 + i * 0.33) % 1);
    const ringRadius = radius * (0.6 + ringPhase * 0.6);
    const ringAlpha = (1 - ringPhase) * 0.15;
    ctx.globalAlpha = ringAlpha;
    ctx.strokeStyle = COLORS.safe.ring;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, ringRadius, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Main zone fill
  ctx.globalAlpha = 0.12;
  ctx.fillStyle = COLORS.safe.primary;
  ctx.beginPath();
  ctx.arc(0, 0, radius, 0, Math.PI * 2);
  ctx.fill();

  // Rotating dashed border
  ctx.globalAlpha = 0.5;
  ctx.strokeStyle = COLORS.safe.primary;
  ctx.lineWidth = 2.5;
  ctx.setLineDash([10, 8]);
  ctx.lineDashOffset = -time * 30;
  ctx.beginPath();
  ctx.arc(0, 0, radius, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);

  // Arrow indicators (4 cardinal directions, pointing inward)
  ctx.globalAlpha = 0.4 + Math.sin(time * 3) * 0.2;
  ctx.fillStyle = COLORS.safe.primary;
  for (let i = 0; i < 4; i++) {
    const angle = (i / 4) * Math.PI * 2 + time * 0.3;
    const arrowDist = radius + 30 + Math.sin(time * 2 + i) * 8;
    ctx.save();
    ctx.translate(Math.cos(angle) * arrowDist, Math.sin(angle) * arrowDist);
    ctx.rotate(angle + Math.PI); // Point inward
    // Arrow shape
    ctx.beginPath();
    ctx.moveTo(8, 0);
    ctx.lineTo(-4, -5);
    ctx.lineTo(-2, 0);
    ctx.lineTo(-4, 5);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  // Center text
  ctx.globalAlpha = 0.6 + Math.sin(time * 2) * 0.1;
  ctx.fillStyle = COLORS.safe.primary;
  ctx.font = `bold 16px ${FONT.primary}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('SAFE', 0, 0);

  ctx.restore();
}

// ============================================================================
// PLAYER NAME LABELS
// ============================================================================

export function drawPlayerLabel(
  ctx: CanvasRenderingContext2D,
  player: SwanChasePlayer,
  state: SwanChaseGameState
): void {
  const { position, name, status, team } = player;
  const isKing = state.currentKingId === player.id;

  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // Determine label text and color
  const displayName = name.length > 12 ? name.slice(0, 11) + '…' : name;
  const prefix = isKing ? '👑 ' : '';
  const text = prefix + displayName;

  ctx.font = `bold 11px ${FONT.primary}`;
  const textWidth = ctx.measureText(text).width;
  const bgWidth = textWidth + 12;
  const bgHeight = 18;

  // Background pill
  const bgColor = isKing ? 'rgba(245, 158, 11, 0.9)'
    : team === SwanChaseTeam.BLUE ? 'rgba(37, 99, 235, 0.85)'
    : team === SwanChaseTeam.WHITE ? 'rgba(241, 245, 249, 0.85)'
    : team === SwanChaseTeam.SOLO ? 'rgba(99, 102, 241, 0.85)'
    : team === SwanChaseTeam.COOP ? 'rgba(139, 92, 246, 0.85)'
    : 'rgba(100, 116, 139, 0.85)';

  const labelY = position.y - 38;
  ctx.fillStyle = bgColor;
  roundedRect(ctx, position.x - bgWidth / 2, labelY - bgHeight / 2, bgWidth, bgHeight, 9);
  ctx.fill();

  // Text
  ctx.fillStyle = team === SwanChaseTeam.WHITE && !isKing ? '#1e293b' : '#ffffff';
  ctx.fillText(text, position.x, labelY);

  // Status badge below label
  let badge = '';
  let badgeColor = '';
  if (status === SwanChasePlayerStatus.TAGGED) {
    badge = 'TAGGED';
    badgeColor = '#ef4444';
  } else if (status === SwanChasePlayerStatus.SAFE) {
    badge = 'SAFE';
    badgeColor = '#22c55e';
  } else if (status === SwanChasePlayerStatus.ELIMINATED) {
    badge = 'OUT';
    badgeColor = '#ef4444';
  } else if (isKing) {
    badge = 'KING';
    badgeColor = '#f59e0b';
  }

  if (badge) {
    ctx.font = `bold 9px ${FONT.primary}`;
    const badgeWidth = ctx.measureText(badge).width + 8;
    ctx.fillStyle = badgeColor;
    roundedRect(ctx, position.x - badgeWidth / 2, labelY + 12, badgeWidth, 14, 7);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.fillText(badge, position.x, labelY + 19);
  }

  ctx.restore();
}

// ============================================================================
// HUD
// ============================================================================

export function drawHUD(
  ctx: CanvasRenderingContext2D,
  state: SwanChaseGameState,
  width: number,
  height: number,
  time: number
): void {
  // Timer bar at top
  drawTimerBar(ctx, state, width);

  // Mode-specific HUD panels
  if (state.mode === 'KING_OF_LAKE') {
    drawKingOfLakeHUD(ctx, state, width);
  } else if (state.mode === 'SWAN_SWARM') {
    drawSwanSwarmHUD(ctx, state, width, time);
  } else {
    drawClassicHUD(ctx, state, width);
  }
}

function drawTimerBar(ctx: CanvasRenderingContext2D, state: SwanChaseGameState, width: number): void {
  const duration = state.settings.duration;
  const remaining = state.timeRemaining;
  const progress = Math.max(0, Math.min(1, remaining / duration));

  // Timer background
  ctx.fillStyle = COLORS.hud.bg;
  roundedRect(ctx, width / 2 - 100, 8, 200, 36, 18);
  ctx.fill();

  // Progress bar
  const barWidth = 180;
  const barX = width / 2 - barWidth / 2;
  const barColor = progress > 0.5 ? '#22c55e'
    : progress > 0.25 ? '#f59e0b'
    : '#ef4444';

  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  roundedRect(ctx, barX, 32, barWidth, 6, 3);
  ctx.fill();

  ctx.fillStyle = barColor;
  roundedRect(ctx, barX, 32, barWidth * progress, 6, 3);
  ctx.fill();

  // Time text
  const minutes = Math.floor(remaining / 60);
  const seconds = remaining % 60;
  const timeText = `${minutes}:${seconds.toString().padStart(2, '0')}`;

  ctx.fillStyle = remaining <= 10 ? '#ef4444' : COLORS.hud.text;
  ctx.font = `bold 16px ${FONT.mono}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(timeText, width / 2, 22);
}

function drawClassicHUD(ctx: CanvasRenderingContext2D, state: SwanChaseGameState, width: number): void {
  const boats = state.players.filter(p => p.team === SwanChaseTeam.BLUE);
  const activeBoats = boats.filter(p => p.status === SwanChasePlayerStatus.ACTIVE).length;
  const safeBoats = boats.filter(p => p.status === SwanChasePlayerStatus.SAFE).length;
  const taggedBoats = boats.filter(p => p.status === SwanChasePlayerStatus.TAGGED).length;
  const swans = state.players.filter(p => p.team === SwanChaseTeam.WHITE);
  const totalTags = swans.reduce((sum, s) => sum + (s.tagsCount || 0), 0);

  // Left panel - Boats
  ctx.fillStyle = COLORS.hud.bg;
  roundedRect(ctx, 10, 10, 180, 58, 10);
  ctx.fill();
  ctx.fillStyle = COLORS.team.blue;
  ctx.font = `bold 13px ${FONT.primary}`;
  ctx.textAlign = 'left';
  ctx.fillText('🚣 BOATS', 20, 30);
  ctx.fillStyle = COLORS.hud.textDim;
  ctx.font = `11px ${FONT.primary}`;
  ctx.fillText(`Active: ${activeBoats}  Safe: ${safeBoats}  Tagged: ${taggedBoats}`, 20, 52);

  // Right panel - Swans
  ctx.fillStyle = COLORS.hud.bg;
  roundedRect(ctx, width - 190, 10, 180, 58, 10);
  ctx.fill();
  ctx.fillStyle = COLORS.swan.body;
  ctx.font = `bold 13px ${FONT.primary}`;
  ctx.textAlign = 'right';
  ctx.fillText('🦢 SWANS', width - 20, 30);
  ctx.fillStyle = COLORS.hud.textDim;
  ctx.font = `11px ${FONT.primary}`;
  ctx.fillText(`Tags: ${totalTags}  Hunters: ${swans.length}`, width - 20, 52);
}

function drawKingOfLakeHUD(ctx: CanvasRenderingContext2D, state: SwanChaseGameState, width: number): void {
  const alive = state.players.filter(p => p.status !== SwanChasePlayerStatus.ELIMINATED).length;
  const kingPlayer = state.players.find(p => p.id === state.currentKingId);

  // Left panel - King
  ctx.fillStyle = COLORS.hud.bg;
  roundedRect(ctx, 10, 10, 200, 58, 10);
  ctx.fill();
  ctx.fillStyle = COLORS.team.king;
  ctx.font = `bold 13px ${FONT.primary}`;
  ctx.textAlign = 'left';
  ctx.fillText('👑 KING OF THE LAKE', 20, 30);
  ctx.fillStyle = COLORS.hud.text;
  ctx.font = `11px ${FONT.primary}`;
  ctx.fillText(`King: ${kingPlayer?.name || '—'}  Tags: ${kingPlayer?.tagsCount || 0}`, 20, 52);

  // Right panel - Alive
  ctx.fillStyle = COLORS.hud.bg;
  roundedRect(ctx, width - 140, 10, 130, 58, 10);
  ctx.fill();
  ctx.fillStyle = '#22c55e';
  ctx.font = `bold 30px ${FONT.primary}`;
  ctx.textAlign = 'center';
  ctx.fillText(`${alive}`, width - 75, 40);
  ctx.fillStyle = COLORS.hud.textDim;
  ctx.font = `10px ${FONT.primary}`;
  ctx.fillText('ALIVE', width - 75, 58);
}

function drawSwanSwarmHUD(ctx: CanvasRenderingContext2D, state: SwanChaseGameState, width: number, time: number): void {
  const alive = state.players.filter(p =>
    p.status === SwanChasePlayerStatus.ACTIVE || p.status === SwanChasePlayerStatus.DASHING
  ).length;
  const aiCount = state.aiSwans?.length || 0;
  const wave = state.currentWave || 1;

  // Left panel - Crew
  ctx.fillStyle = COLORS.hud.bg;
  roundedRect(ctx, 10, 10, 180, 58, 10);
  ctx.fill();
  ctx.fillStyle = COLORS.team.coop;
  ctx.font = `bold 13px ${FONT.primary}`;
  ctx.textAlign = 'left';
  ctx.fillText('🌊 SWAN SWARM', 20, 30);
  ctx.fillStyle = COLORS.hud.textDim;
  ctx.font = `11px ${FONT.primary}`;
  ctx.fillText(`Crew: ${alive}/${state.players.length}  Wave: #${wave}`, 20, 52);

  // Right panel - AI count
  const dangerColor = aiCount > 6 ? '#ef4444' : aiCount > 3 ? '#f59e0b' : '#22c55e';
  ctx.fillStyle = COLORS.hud.bg;
  roundedRect(ctx, width - 160, 10, 150, 58, 10);
  ctx.fill();
  ctx.fillStyle = dangerColor;
  ctx.font = `bold 26px ${FONT.primary}`;
  ctx.textAlign = 'center';
  ctx.fillText(`${aiCount}`, width - 85, 38);
  ctx.fillStyle = COLORS.hud.textDim;
  ctx.font = `10px ${FONT.primary}`;
  ctx.fillText('AI SWANS', width - 85, 56);
}

// ============================================================================
// MINI-MAP
// ============================================================================

export function drawMiniMap(
  ctx: CanvasRenderingContext2D,
  state: SwanChaseGameState,
  canvasWidth: number,
  canvasHeight: number
): void {
  const mapW = 140;
  const mapH = Math.round(mapW * (state.settings.gameArea.height / state.settings.gameArea.width));
  const mapX = canvasWidth - mapW - 12;
  const mapY = canvasHeight - mapH - 12;
  const scaleX = mapW / state.settings.gameArea.width;
  const scaleY = mapH / state.settings.gameArea.height;

  ctx.save();

  // Background
  ctx.fillStyle = 'rgba(15, 23, 42, 0.8)';
  roundedRect(ctx, mapX - 2, mapY - 2, mapW + 4, mapH + 4, 6);
  ctx.fill();
  ctx.strokeStyle = COLORS.hud.border;
  ctx.lineWidth = 1;
  roundedRect(ctx, mapX - 2, mapY - 2, mapW + 4, mapH + 4, 6);
  ctx.stroke();

  // Water bg
  ctx.fillStyle = COLORS.water.mid;
  ctx.fillRect(mapX, mapY, mapW, mapH);

  // Safe zone
  if (state.settings.safeZone.radius > 0) {
    ctx.fillStyle = 'rgba(34, 197, 94, 0.3)';
    ctx.beginPath();
    ctx.arc(
      mapX + state.settings.safeZone.position.x * scaleX,
      mapY + state.settings.safeZone.position.y * scaleY,
      state.settings.safeZone.radius * scaleX,
      0, Math.PI * 2
    );
    ctx.fill();
  }

  // Obstacles
  ctx.fillStyle = 'rgba(100, 116, 139, 0.6)';
  for (const obs of state.settings.obstacles) {
    ctx.beginPath();
    ctx.arc(
      mapX + obs.position.x * scaleX,
      mapY + obs.position.y * scaleY,
      Math.max(2, obs.radius * scaleX),
      0, Math.PI * 2
    );
    ctx.fill();
  }

  // AI swans
  if (state.aiSwans) {
    ctx.fillStyle = '#ef4444';
    for (const ai of state.aiSwans) {
      ctx.beginPath();
      ctx.arc(
        mapX + ai.position.x * scaleX,
        mapY + ai.position.y * scaleY,
        2, 0, Math.PI * 2
      );
      ctx.fill();
    }
  }

  // Players
  for (const p of state.players) {
    const isGhosted = p.status === SwanChasePlayerStatus.TAGGED || p.status === SwanChasePlayerStatus.ELIMINATED;
    if (isGhosted) {
      ctx.globalAlpha = 0.3;
    }

    const isKing = p.id === state.currentKingId;
    ctx.fillStyle = isKing ? COLORS.team.king
      : p.team === SwanChaseTeam.BLUE ? COLORS.team.blue
      : p.team === SwanChaseTeam.WHITE ? '#e2e8f0'
      : p.team === SwanChaseTeam.SOLO ? COLORS.team.solo
      : COLORS.team.coop;

    ctx.beginPath();
    ctx.arc(
      mapX + p.position.x * scaleX,
      mapY + p.position.y * scaleY,
      isKing ? 4 : 3,
      0, Math.PI * 2
    );
    ctx.fill();

    ctx.globalAlpha = 1;
  }

  ctx.restore();
}

// ============================================================================
// COUNTDOWN
// ============================================================================

export function drawCountdown(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  state: SwanChaseGameState,
  time: number
): void {
  if (state.status !== 'COUNTDOWN') return;

  const elapsed = (Date.now() - state.startTime) / 1000;
  const countdownValue = Math.ceil(3 - elapsed);

  if (countdownValue <= 0) return;

  // Darken background
  ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
  ctx.fillRect(0, 0, width, height);

  // Scale animation
  const phase = elapsed % 1;
  const scale = 1 + (1 - phase) * 1.5;
  const alpha = 0.3 + phase * 0.7;

  ctx.save();
  ctx.translate(width / 2, height / 2);
  ctx.scale(scale, scale);
  ctx.globalAlpha = alpha;

  // Ripple rings
  for (let i = 0; i < 3; i++) {
    const ringPhase = (phase + i * 0.3) % 1;
    const ringRadius = 40 + ringPhase * 80;
    ctx.globalAlpha = (1 - ringPhase) * 0.2;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, ringRadius, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Number
  ctx.globalAlpha = alpha;
  ctx.fillStyle = '#ffffff';
  ctx.font = `bold 120px ${FONT.primary}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(`${countdownValue}`, 0, 0);

  // Mode label below
  ctx.globalAlpha = 0.6;
  ctx.font = `bold 24px ${FONT.primary}`;
  const modeLabel = state.mode === 'KING_OF_LAKE' ? 'KING OF THE LAKE'
    : state.mode === 'SWAN_SWARM' ? 'SWAN SWARM'
    : (state.mode as string) === 'RACE' ? 'SWAN RACE'
    : 'BOATS vs SWANS';
  ctx.fillText(modeLabel, 0, 80);

  ctx.restore();
}

// ============================================================================
// END SCREEN
// ============================================================================

export function drawEndScreen(
  ctx: CanvasRenderingContext2D,
  state: SwanChaseGameState,
  width: number,
  height: number,
  time: number
): void {
  if (state.status !== 'ENDED') return;

  // Dark overlay
  ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
  ctx.fillRect(0, 0, width, height);

  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  if (state.mode === 'KING_OF_LAKE') {
    const winner = state.winnerId ? state.players.find(p => p.id === state.winnerId) : null;
    const eliminated = state.players.filter(p => p.status === SwanChasePlayerStatus.ELIMINATED).length;

    // Crown animation
    const bob = Math.sin(time * 2) * 5;
    drawCrown(ctx, width / 2, height / 2 - 100 + bob, time);

    // Winner name
    ctx.fillStyle = COLORS.team.kingGlow;
    ctx.font = `bold 56px ${FONT.primary}`;
    ctx.fillText(winner?.name || 'No one', width / 2, height / 2 - 30);

    ctx.fillStyle = '#ffffff';
    ctx.font = `bold 28px ${FONT.primary}`;
    ctx.fillText('KING OF THE LAKE!', width / 2, height / 2 + 20);

    ctx.fillStyle = COLORS.hud.textDim;
    ctx.font = `18px ${FONT.primary}`;
    ctx.fillText(`Eliminated: ${eliminated} / ${state.players.length}`, width / 2, height / 2 + 60);

  } else if (state.mode === 'SWAN_SWARM') {
    const survived = state.players.filter(p => p.status === SwanChasePlayerStatus.ACTIVE).length;
    const allCaught = survived === 0;

    ctx.fillStyle = allCaught ? '#ef4444' : '#22c55e';
    ctx.font = `bold 64px ${FONT.primary}`;
    ctx.fillText(allCaught ? 'SWARM WINS!' : 'CREW SURVIVES!', width / 2, height / 2 - 30);

    ctx.fillStyle = '#ffffff';
    ctx.font = `22px ${FONT.primary}`;
    ctx.fillText(
      `Survived: ${survived} / ${state.players.length} | Waves: ${state.currentWave || 1}`,
      width / 2, height / 2 + 30
    );

  } else {
    // CLASSIC / ROUNDS
    const boatsWon = state.winner === SwanChaseTeam.BLUE;
    ctx.fillStyle = boatsWon ? COLORS.team.blue : '#f8fafc';
    ctx.font = `bold 64px ${FONT.primary}`;
    ctx.fillText(boatsWon ? 'BOATS WIN!' : 'SWANS WIN!', width / 2, height / 2 - 30);

    const boats = state.players.filter(p => p.team === SwanChaseTeam.BLUE);
    const safeCount = boats.filter(p => p.status === SwanChasePlayerStatus.SAFE).length;
    const taggedCount = boats.filter(p => p.status === SwanChasePlayerStatus.TAGGED).length;

    ctx.fillStyle = '#ffffff';
    ctx.font = `20px ${FONT.primary}`;
    ctx.fillText(`Safe: ${safeCount}  Tagged: ${taggedCount}  Total Boats: ${boats.length}`, width / 2, height / 2 + 30);
  }

  // Top scores
  const sortedPlayers = [...state.players].sort((a, b) => b.score - a.score).slice(0, 5);
  const startY = height / 2 + 90;

  ctx.fillStyle = COLORS.hud.bg;
  roundedRect(ctx, width / 2 - 160, startY - 10, 320, sortedPlayers.length * 28 + 20, 10);
  ctx.fill();

  sortedPlayers.forEach((p, i) => {
    const y = startY + 10 + i * 28;
    const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`;

    ctx.fillStyle = COLORS.hud.textDim;
    ctx.font = `13px ${FONT.primary}`;
    ctx.textAlign = 'left';
    ctx.fillText(medal, width / 2 - 140, y);

    ctx.fillStyle = COLORS.hud.text;
    ctx.font = `bold 13px ${FONT.primary}`;
    ctx.fillText(p.name, width / 2 - 110, y);

    ctx.textAlign = 'right';
    ctx.fillStyle = COLORS.team.king;
    ctx.fillText(`${p.score} pts`, width / 2 + 140, y);
  });

  ctx.restore();
}

// ============================================================================
// SCREEN SHAKE
// ============================================================================

export interface ScreenShake {
  intensity: number;
  duration: number;
  startTime: number;
}

export function applyScreenShake(ctx: CanvasRenderingContext2D, shake: ScreenShake | null, now: number): boolean {
  if (!shake) return false;
  const elapsed = now - shake.startTime;
  if (elapsed > shake.duration) return false;

  const decay = 1 - (elapsed / shake.duration);
  // Use seeded values based on elapsed for deterministic shake per frame
  const seed = Math.floor(elapsed * 0.1);
  const offsetX = (Math.sin(seed * 127.1) * 2 - 1) * shake.intensity * decay;
  const offsetY = (Math.sin(seed * 269.5) * 2 - 1) * shake.intensity * decay;
  ctx.translate(offsetX, offsetY);
  return true;
}

export function createShake(intensity: number, durationMs: number): ScreenShake {
  return {
    intensity,
    duration: durationMs,
    startTime: Date.now(),
  };
}

// ============================================================================
// UTILITIES
// ============================================================================

function roundedRect(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number, r: number
): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function adjustColor(hex: string, amount: number): string {
  const num = parseInt(hex.replace('#', ''), 16);
  const r = Math.min(255, Math.max(0, ((num >> 16) & 0xff) + amount));
  const g = Math.min(255, Math.max(0, ((num >> 8) & 0xff) + amount));
  const b = Math.min(255, Math.max(0, (num & 0xff) + amount));
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

// ============================================================================
// RACE MODE RENDERING
// ============================================================================

const RACE_LANE_PADDING = 60;
const RACE_START_X = 100;
const RACE_FINISH_X = 1500;

/**
 * Draw race-specific overlays: lane separators, start/finish lines, position labels.
 * Called AFTER water but BEFORE players for RACE mode.
 */
export function drawRaceLanes(
  ctx: CanvasRenderingContext2D,
  state: SwanChaseGameState,
  width: number,
  height: number,
  time: number,
): void {
  const playerCount = state.players.length;
  if (playerCount === 0) return;

  const laneHeight = (height - 2 * RACE_LANE_PADDING) / playerCount;

  // Lane separator lines
  ctx.save();
  ctx.setLineDash([12, 8]);
  ctx.strokeStyle = 'rgba(255,255,255,0.15)';
  ctx.lineWidth = 1;

  for (let i = 1; i < playerCount; i++) {
    const y = RACE_LANE_PADDING + i * laneHeight;
    ctx.beginPath();
    ctx.moveTo(RACE_START_X, y);
    ctx.lineTo(RACE_FINISH_X, y);
    ctx.stroke();
  }
  ctx.setLineDash([]);
  ctx.restore();

  // Start line
  ctx.save();
  ctx.strokeStyle = 'rgba(255,255,255,0.5)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(RACE_START_X, RACE_LANE_PADDING - 10);
  ctx.lineTo(RACE_START_X, height - RACE_LANE_PADDING + 10);
  ctx.stroke();

  ctx.fillStyle = 'rgba(255,255,255,0.4)';
  ctx.font = `bold 14px ${FONT.primary}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText('START', RACE_START_X, RACE_LANE_PADDING - 30);
  ctx.restore();

  // Finish line (checkered pattern)
  ctx.save();
  const finishWidth = 20;
  const checkerSize = 12;
  const finishTop = RACE_LANE_PADDING - 10;
  const finishBottom = height - RACE_LANE_PADDING + 10;

  for (let y = finishTop; y < finishBottom; y += checkerSize) {
    for (let x = 0; x < finishWidth; x += checkerSize) {
      const isWhite = ((Math.floor(x / checkerSize) + Math.floor((y - finishTop) / checkerSize)) % 2 === 0);
      ctx.fillStyle = isWhite ? 'rgba(255,255,255,0.8)' : 'rgba(0,0,0,0.5)';
      ctx.fillRect(
        RACE_FINISH_X - finishWidth / 2 + x,
        y,
        Math.min(checkerSize, finishWidth - x),
        Math.min(checkerSize, finishBottom - y),
      );
    }
  }

  ctx.fillStyle = 'rgba(255,255,255,0.4)';
  ctx.font = `bold 14px ${FONT.primary}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText('FINISH', RACE_FINISH_X, RACE_LANE_PADDING - 30);
  ctx.restore();

  // Lane numbers and player names on the left
  ctx.save();
  ctx.font = `bold 16px ${FONT.primary}`;
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';

  // Sort players by laneIndex (Y position)
  const sortedByLane = [...state.players].sort((a, b) => a.position.y - b.position.y);

  sortedByLane.forEach((player, i) => {
    const laneY = RACE_LANE_PADDING + i * laneHeight + laneHeight / 2;

    // Lane number
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.fillText(`${i + 1}`, RACE_START_X - 20, laneY);
  });
  ctx.restore();

  // Distance markers every 200px
  ctx.save();
  ctx.fillStyle = 'rgba(255,255,255,0.1)';
  ctx.font = `10px ${FONT.mono}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';

  for (let x = RACE_START_X + 200; x < RACE_FINISH_X; x += 200) {
    // Vertical tick
    ctx.fillRect(x - 0.5, RACE_LANE_PADDING - 5, 1, height - 2 * RACE_LANE_PADDING + 10);

    // Percentage label
    const pct = Math.round(((x - RACE_START_X) / (RACE_FINISH_X - RACE_START_X)) * 100);
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.fillText(`${pct}%`, x, RACE_LANE_PADDING - 8);
    ctx.fillStyle = 'rgba(255,255,255,0.1)';
  }
  ctx.restore();
}
