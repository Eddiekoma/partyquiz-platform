"use client";

import { useEffect, useRef, useState } from "react";

interface JoystickPosition {
  x: number; // -1 to 1
  y: number; // -1 to 1
  angle: number; // 0 to 360 degrees
  distance: number; // 0 to 1
}

interface VirtualJoystickProps {
  size?: number; // Size in pixels (default 200)
  maxDistance?: number; // Max stick travel distance (default 80)
  onMove: (position: JoystickPosition) => void;
  onStop: () => void;
  disabled?: boolean;
  color?: string; // Primary color for the joystick
  className?: string;
}

export function VirtualJoystick({
  size = 200,
  maxDistance = 80,
  onMove,
  onStop,
  disabled = false,
  color = "#3b82f6",
  className = "",
}: VirtualJoystickProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const stickRef = useRef<HTMLDivElement>(null);
  const [isActive, setIsActive] = useState(false);
  const [stickPosition, setStickPosition] = useState({ x: 0, y: 0 });
  const touchIdRef = useRef<number | null>(null);
  
  // Keyboard state tracking
  const keysPressed = useRef<Set<string>>(new Set());
  const keyboardIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const calculatePosition = (clientX: number, clientY: number): JoystickPosition => {
    if (!containerRef.current) {
      return { x: 0, y: 0, angle: 0, distance: 0 };
    }

    const rect = containerRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    // Calculate offset from center
    let deltaX = clientX - centerX;
    let deltaY = clientY - centerY;

    // Calculate distance and angle
    const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
    const angle = Math.atan2(deltaY, deltaX) * (180 / Math.PI) + 90; // 0° = up

    // Normalize angle to 0-360
    const normalizedAngle = (angle + 360) % 360;

    // Clamp distance to maxDistance
    const clampedDistance = Math.min(distance, maxDistance);
    const normalizedDistance = clampedDistance / maxDistance;

    // Adjust deltaX and deltaY if clamped
    if (distance > maxDistance) {
      const ratio = maxDistance / distance;
      deltaX *= ratio;
      deltaY *= ratio;
    }

    // Normalize to -1 to 1 range
    const normalizedX = deltaX / maxDistance;
    const normalizedY = deltaY / maxDistance;

    return {
      x: normalizedX,
      y: normalizedY,
      angle: normalizedAngle,
      distance: normalizedDistance,
    };
  };

  const handleStart = (clientX: number, clientY: number, touchId?: number) => {
    if (disabled) return;
    setIsActive(true);
    if (touchId !== undefined) {
      touchIdRef.current = touchId;
    }
    handleMove(clientX, clientY);
  };

  const handleMove = (clientX: number, clientY: number) => {
    if (!isActive && touchIdRef.current === null) return;
    if (disabled) return;

    const position = calculatePosition(clientX, clientY);
    setStickPosition({
      x: position.x * maxDistance,
      y: position.y * maxDistance,
    });
    onMove(position);
  };

  const handleEnd = () => {
    if (disabled) return;
    setIsActive(false);
    touchIdRef.current = null;
    setStickPosition({ x: 0, y: 0 });
    onStop();
  };

  // Mouse events
  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    handleStart(e.clientX, e.clientY);
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!isActive) return;
    handleMove(e.clientX, e.clientY);
  };

  const handleMouseUp = () => {
    if (isActive) handleEnd();
  };

  // Touch events
  const handleTouchStart = (e: React.TouchEvent) => {
    e.preventDefault();
    const touch = e.touches[0];
    if (touch) {
      handleStart(touch.clientX, touch.clientY, touch.identifier);
    }
  };

  const handleTouchMove = (e: TouchEvent) => {
    if (touchIdRef.current === null) return;
    
    // Find the touch with our tracked identifier
    const touch = Array.from(e.touches).find(
      (t) => t.identifier === touchIdRef.current
    );
    
    if (touch) {
      handleMove(touch.clientX, touch.clientY);
    }
  };

  const handleTouchEnd = (e: TouchEvent) => {
    if (touchIdRef.current === null) return;
    
    // Check if our tracked touch ended
    const touchEnded = !Array.from(e.touches).some(
      (t) => t.identifier === touchIdRef.current
    );
    
    if (touchEnded) {
      handleEnd();
    }
  };

  // Setup global event listeners
  useEffect(() => {
    if (isActive) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    } else {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    }

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isActive]);

  useEffect(() => {
    document.addEventListener("touchmove", handleTouchMove, { passive: false });
    document.addEventListener("touchend", handleTouchEnd);
    document.addEventListener("touchcancel", handleTouchEnd);

    return () => {
      document.removeEventListener("touchmove", handleTouchMove);
      document.removeEventListener("touchend", handleTouchEnd);
      document.removeEventListener("touchcancel", handleTouchEnd);
    };
  }, [touchIdRef.current]);

  // Keyboard controls: WASD or Arrow Keys
  useEffect(() => {
    if (disabled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if typing in input field
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      const key = e.key.toLowerCase();
      
      // Check if it's a movement key
      const movementKeys = ['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'];
      if (movementKeys.includes(key)) {
        e.preventDefault(); // Prevent page scrolling
        
        keysPressed.current.add(key);
        
        // Start interval to send continuous updates if not already running
        if (!keyboardIntervalRef.current) {
          updateKeyboardMovement();
          keyboardIntervalRef.current = setInterval(updateKeyboardMovement, 50); // 20 FPS updates
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      keysPressed.current.delete(key);
      
      // Stop interval if no keys pressed
      if (keysPressed.current.size === 0 && keyboardIntervalRef.current) {
        clearInterval(keyboardIntervalRef.current);
        keyboardIntervalRef.current = null;
        handleEnd(); // Reset joystick to center
      }
    };

    const updateKeyboardMovement = () => {
      if (disabled) return;
      
      const keys = keysPressed.current;
      if (keys.size === 0) return;

      // Calculate direction from pressed keys
      let x = 0;
      let y = 0;

      // Horizontal
      if (keys.has('a') || keys.has('arrowleft')) x -= 1;
      if (keys.has('d') || keys.has('arrowright')) x += 1;

      // Vertical (note: positive Y is DOWN in screen coordinates)
      if (keys.has('w') || keys.has('arrowup')) y -= 1;
      if (keys.has('s') || keys.has('arrowdown')) y += 1;

      // Normalize diagonal movement
      const magnitude = Math.sqrt(x * x + y * y);
      if (magnitude > 0) {
        x /= magnitude;
        y /= magnitude;

        // Calculate angle (0° = up, clockwise)
        const angleRad = Math.atan2(y, x);
        const angle = (angleRad * 180 / Math.PI + 90 + 360) % 360;

        // Update visual stick position
        setStickPosition({
          x: x * maxDistance,
          y: y * maxDistance,
        });
        setIsActive(true);

        // Send movement to parent
        onMove({
          x,
          y,
          angle,
          distance: 1, // Full movement from keyboard
        });
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      if (keyboardIntervalRef.current) {
        clearInterval(keyboardIntervalRef.current);
      }
    };
  }, [disabled, maxDistance, onMove, handleEnd]);


  return (
    <div className="flex flex-col items-center gap-2">
      <div
        ref={containerRef}
        className={`relative select-none touch-none ${className}`}
        style={{
          width: size,
          height: size,
        }}
        onMouseDown={handleMouseDown}
        onTouchStart={handleTouchStart}
      >
        {/* Outer circle (base) */}
        <div
          className="absolute inset-0 rounded-full transition-all"
          style={{
            backgroundColor: disabled ? "#6b7280" : `${color}20`,
            border: `2px solid ${disabled ? "#9ca3af" : color}`,
            opacity: isActive ? 1 : 0.7,
          }}
        >
          {/* Direction indicators */}
          <div className="absolute top-2 left-1/2 -translate-x-1/2 text-white/40 text-xs font-bold">
            ▲
          </div>
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 text-white/40 text-xs font-bold">
            ▼
          </div>
          <div className="absolute left-2 top-1/2 -translate-y-1/2 text-white/40 text-xs font-bold">
            ◀
          </div>
          <div className="absolute right-2 top-1/2 -translate-y-1/2 text-white/40 text-xs font-bold">
            ▶
          </div>

          {/* Center dot */}
          <div
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full"
            style={{
              width: 8,
              height: 8,
              backgroundColor: disabled ? "#9ca3af" : `${color}60`,
            }}
          />
        </div>

        {/* Stick (movable part) */}
        <div
          ref={stickRef}
          className="absolute top-1/2 left-1/2 rounded-full transition-all pointer-events-none"
          style={{
            width: size * 0.4,
            height: size * 0.4,
            backgroundColor: disabled ? "#9ca3af" : color,
            boxShadow: isActive
              ? `0 0 20px ${color}80`
              : "0 2px 8px rgba(0,0,0,0.3)",
            transform: `translate(calc(-50% + ${stickPosition.x}px), calc(-50% + ${stickPosition.y}px)) scale(${
              isActive ? 1.1 : 1
            })`,
            border: "4px solid rgba(255,255,255,0.3)",
          }}
        >
          {/* Inner highlight */}
          <div
            className="absolute inset-2 rounded-full"
            style={{
              background: "radial-gradient(circle at 30% 30%, rgba(255,255,255,0.4), transparent)",
            }}
          />
        </div>

        {/* Visual feedback when disabled */}
        {disabled && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/20 rounded-full">
            <span className="text-white/60 text-2xl">🚫</span>
          </div>
        )}
      </div>
      
      {/* Keyboard controls hint */}
      {!disabled && (
        <div className="text-center text-xs text-slate-400 mt-1">
          <div className="flex items-center gap-2 justify-center">
            <span>🎮</span>
            <span>WASD or Arrow Keys</span>
          </div>
        </div>
      )}
    </div>
  );
}
