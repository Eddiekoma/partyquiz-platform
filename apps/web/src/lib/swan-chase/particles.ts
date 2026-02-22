/**
 * Particle System for Swan Chase
 *
 * Object-pooled particle system for CPU-friendly Canvas 2D effects.
 * Pre-allocates particles to avoid GC pressure during gameplay.
 */

export type ParticleType = 'SPLASH' | 'SPARKLE' | 'TRAIL' | 'CONFETTI' | 'SMOKE' | 'BUBBLE';

interface Particle {
  active: boolean;
  type: ParticleType;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
  alpha: number;
  rotation: number;
  rotationSpeed: number;
  gravity: number;
  friction: number;
}

interface EmitOptions {
  color?: string;
  colors?: string[];
  minSize?: number;
  maxSize?: number;
  minSpeed?: number;
  maxSpeed?: number;
  minLife?: number;
  maxLife?: number;
  gravity?: number;
  friction?: number;
  spread?: number; // angle spread in radians (default: Math.PI * 2 = all directions)
  direction?: number; // base direction in radians
}

const DEFAULT_COLORS: Record<ParticleType, string[]> = {
  SPLASH: ['#ffffff', '#e0f2fe', '#bae6fd', '#7dd3fc'],
  SPARKLE: ['#fbbf24', '#f59e0b', '#fde68a', '#ffffff'],
  TRAIL: ['#3b82f6', '#60a5fa', '#93c5fd'],
  CONFETTI: ['#ef4444', '#f59e0b', '#22c55e', '#3b82f6', '#a855f7', '#ec4899'],
  SMOKE: ['#6b7280', '#9ca3af', '#d1d5db'],
  BUBBLE: ['#bfdbfe', '#dbeafe', '#eff6ff'],
};

export class ParticleSystem {
  private pool: Particle[];
  private maxParticles: number;

  constructor(maxParticles: number = 200) {
    this.maxParticles = maxParticles;
    this.pool = [];
    for (let i = 0; i < maxParticles; i++) {
      this.pool.push(this.createDeadParticle());
    }
  }

  private createDeadParticle(): Particle {
    return {
      active: false,
      type: 'SPLASH',
      x: 0, y: 0,
      vx: 0, vy: 0,
      life: 0, maxLife: 1,
      size: 2,
      color: '#ffffff',
      alpha: 1,
      rotation: 0,
      rotationSpeed: 0,
      gravity: 0,
      friction: 0.98,
    };
  }

  private getInactive(): Particle | null {
    for (const p of this.pool) {
      if (!p.active) return p;
    }
    // If pool is full, steal the oldest (lowest life ratio)
    let oldest: Particle | null = null;
    let lowestLifeRatio = Infinity;
    for (const p of this.pool) {
      const ratio = p.life / p.maxLife;
      if (ratio < lowestLifeRatio) {
        lowestLifeRatio = ratio;
        oldest = p;
      }
    }
    return oldest;
  }

  emit(type: ParticleType, x: number, y: number, count: number, options: EmitOptions = {}): void {
    const colors = options.colors || options.color ? [options.color!] : DEFAULT_COLORS[type];
    const minSize = options.minSize ?? (type === 'CONFETTI' ? 4 : type === 'SMOKE' ? 6 : 2);
    const maxSize = options.maxSize ?? (type === 'CONFETTI' ? 8 : type === 'SMOKE' ? 12 : 5);
    const minSpeed = options.minSpeed ?? (type === 'SPLASH' ? 1 : type === 'CONFETTI' ? 2 : 0.5);
    const maxSpeed = options.maxSpeed ?? (type === 'SPLASH' ? 4 : type === 'CONFETTI' ? 6 : 2);
    const minLife = options.minLife ?? (type === 'TRAIL' ? 0.3 : type === 'SMOKE' ? 0.8 : 0.5);
    const maxLife = options.maxLife ?? (type === 'TRAIL' ? 0.6 : type === 'SMOKE' ? 1.5 : 1.2);
    const gravity = options.gravity ?? (type === 'CONFETTI' ? 60 : type === 'SPLASH' ? 80 : type === 'BUBBLE' ? -30 : 0);
    const friction = options.friction ?? (type === 'SMOKE' ? 0.95 : 0.98);
    const spread = options.spread ?? Math.PI * 2;
    const direction = options.direction ?? 0;

    for (let i = 0; i < count; i++) {
      const p = this.getInactive();
      if (!p) break;

      const angle = direction + (Math.random() - 0.5) * spread;
      const speed = minSpeed + Math.random() * (maxSpeed - minSpeed);

      p.active = true;
      p.type = type;
      p.x = x + (Math.random() - 0.5) * 10;
      p.y = y + (Math.random() - 0.5) * 10;
      p.vx = Math.cos(angle) * speed;
      p.vy = Math.sin(angle) * speed;
      p.life = minLife + Math.random() * (maxLife - minLife);
      p.maxLife = p.life;
      p.size = minSize + Math.random() * (maxSize - minSize);
      p.color = colors[Math.floor(Math.random() * colors.length)];
      p.alpha = 1;
      p.rotation = Math.random() * Math.PI * 2;
      p.rotationSpeed = type === 'CONFETTI' ? (Math.random() - 0.5) * 8 : 0;
      p.gravity = gravity;
      p.friction = friction;
    }
  }

  update(dt: number): void {
    for (const p of this.pool) {
      if (!p.active) continue;

      p.life -= dt;
      if (p.life <= 0) {
        p.active = false;
        continue;
      }

      // Physics
      p.vy += p.gravity * dt;
      p.vx *= p.friction;
      p.vy *= p.friction;
      p.x += p.vx;
      p.y += p.vy;
      p.rotation += p.rotationSpeed * dt;

      // Fade out
      const lifeRatio = p.life / p.maxLife;
      p.alpha = lifeRatio;

      // Shrink smoke/trail
      if (p.type === 'SMOKE' || p.type === 'TRAIL') {
        p.size *= 0.99;
      }
    }
  }

  draw(ctx: CanvasRenderingContext2D): void {
    for (const p of this.pool) {
      if (!p.active || p.alpha < 0.02) continue;

      ctx.save();
      ctx.globalAlpha = p.alpha;
      ctx.translate(p.x, p.y);

      switch (p.type) {
        case 'SPARKLE':
          this.drawSparkle(ctx, p);
          break;
        case 'CONFETTI':
          this.drawConfetti(ctx, p);
          break;
        case 'SMOKE':
          this.drawSmoke(ctx, p);
          break;
        case 'BUBBLE':
          this.drawBubble(ctx, p);
          break;
        case 'TRAIL':
        case 'SPLASH':
        default:
          this.drawDot(ctx, p);
          break;
      }

      ctx.restore();
    }
  }

  private drawDot(ctx: CanvasRenderingContext2D, p: Particle): void {
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(0, 0, p.size, 0, Math.PI * 2);
    ctx.fill();
  }

  private drawSparkle(ctx: CanvasRenderingContext2D, p: Particle): void {
    ctx.rotate(p.rotation);
    ctx.fillStyle = p.color;
    // 4-pointed star
    const s = p.size;
    ctx.beginPath();
    ctx.moveTo(0, -s);
    ctx.lineTo(s * 0.3, -s * 0.3);
    ctx.lineTo(s, 0);
    ctx.lineTo(s * 0.3, s * 0.3);
    ctx.lineTo(0, s);
    ctx.lineTo(-s * 0.3, s * 0.3);
    ctx.lineTo(-s, 0);
    ctx.lineTo(-s * 0.3, -s * 0.3);
    ctx.closePath();
    ctx.fill();
  }

  private drawConfetti(ctx: CanvasRenderingContext2D, p: Particle): void {
    ctx.rotate(p.rotation);
    ctx.fillStyle = p.color;
    // Thin rectangle that rotates
    ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
  }

  private drawSmoke(ctx: CanvasRenderingContext2D, p: Particle): void {
    const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, p.size);
    gradient.addColorStop(0, p.color);
    gradient.addColorStop(1, 'transparent');
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(0, 0, p.size, 0, Math.PI * 2);
    ctx.fill();
  }

  private drawBubble(ctx: CanvasRenderingContext2D, p: Particle): void {
    ctx.strokeStyle = p.color;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(0, 0, p.size, 0, Math.PI * 2);
    ctx.stroke();
    // Highlight
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.beginPath();
    ctx.arc(-p.size * 0.3, -p.size * 0.3, p.size * 0.3, 0, Math.PI * 2);
    ctx.fill();
  }

  get activeCount(): number {
    let count = 0;
    for (const p of this.pool) {
      if (p.active) count++;
    }
    return count;
  }

  clear(): void {
    for (const p of this.pool) {
      p.active = false;
    }
  }
}
