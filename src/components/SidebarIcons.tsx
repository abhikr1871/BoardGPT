import { useState, useRef } from 'react';

/**
 * Vertical floating icon strip (Phase 4 UI/UX). Pins to the right edge of the
 * viewport, vertically centered, and exposes quick toggles for the overlay's
 * feature panels. Each button is a 32px glassmorphic circle; an `active` map
 * highlights currently-enabled features.
 */

export type SidebarFeature = 'openings' | 'arrows' | 'coach' | 'eval' | 'settings';

interface Props {
  onToggle: (feature: SidebarFeature) => void;
  active?: Record<string, boolean>;
}

const ITEMS: { feature: SidebarFeature | 'website'; icon: string; label: string }[] = [
  { feature: 'openings', icon: '📖', label: 'Openings' },
  { feature: 'arrows', icon: '🎯', label: 'Board arrows' },
  { feature: 'coach', icon: '🧠', label: 'AI coach' },
  { feature: 'eval', icon: '📊', label: 'Evaluation' },
  { feature: 'settings', icon: '🔧', label: 'Settings' },
  { feature: 'website', icon: '🌐', label: 'Dashboard / Website' },
];

export function SidebarIcons({ onToggle, active }: Props) {
  const [hovered, setHovered] = useState<SidebarFeature | 'website' | null>(null);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragRef = useRef({ startX: 0, startY: 0, lastX: 0, lastY: 0 });

  const onPointerDown = (e: React.PointerEvent) => {
    // Only initiate drag from the container or handle, not the buttons
    if ((e.target as HTMLElement).tagName === 'BUTTON') return;
    setIsDragging(true);
    dragRef.current = { startX: e.clientX, startY: e.clientY, lastX: pos.x, lastY: pos.y };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!isDragging) return;
    const dx = e.clientX - dragRef.current.startX;
    const dy = e.clientY - dragRef.current.startY;
    setPos({ x: dragRef.current.lastX + dx, y: dragRef.current.lastY + dy });
  };

  const onPointerUp = (e: React.PointerEvent) => {
    setIsDragging(false);
    e.currentTarget.releasePointerCapture(e.pointerId);
  };

  return (
    <div
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      style={{
        position: 'fixed',
        right: 8 - pos.x, // Subtract x because it's anchored to right
        top: `calc(50% + ${pos.y}px)`,
        transform: 'translateY(-50%)',
        zIndex: 2147483647,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        padding: 6,
        paddingTop: 16, // Extra padding for drag handle
        borderRadius: 22,
        fontFamily: 'sans-serif',
        background: 'linear-gradient(160deg, rgba(15,25,35,0.8) 0%, rgba(17,24,39,0.8) 100%)',
        backdropFilter: 'blur(14px)',
        WebkitBackdropFilter: 'blur(14px)',
        border: '1px solid rgba(255,255,255,0.08)',
        boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
        cursor: isDragging ? 'grabbing' : 'grab',
        touchAction: 'none', // Prevent scrolling on touch
      }}
    >
      {/* Drag Handle UI */}
      <div style={{ position: 'absolute', top: 6, left: 0, right: 0, height: 4, display: 'flex', justifyContent: 'center', gap: 2 }}>
        <div style={{ width: 4, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.2)' }} />
        <div style={{ width: 4, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.2)' }} />
        <div style={{ width: 4, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.2)' }} />
      </div>
      {ITEMS.map(({ feature, icon, label }) => {
        const isActive = !!active?.[feature];
        const isHover = hovered === feature;
        return (
          <button
            key={feature}
            title={label}
            aria-label={label}
            onClick={() => {
              if (feature === 'website') {
                window.open(chrome.runtime.getURL('src/dashboard/index.html'), '_blank');
              } else {
                onToggle(feature as SidebarFeature);
              }
            }}
            onMouseEnter={() => setHovered(feature)}
            onMouseLeave={() => setHovered(null)}
            style={{
              width: 32,
              height: 32,
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 15,
              lineHeight: 1,
              cursor: 'pointer',
              padding: 0,
              transition: 'all 0.18s',
              background: isActive
                ? 'linear-gradient(135deg,#16a34a,#22c55e)'
                : isHover
                  ? 'rgba(34,197,94,0.15)'
                  : 'rgba(255,255,255,0.05)',
              border: isActive
                ? '1px solid rgba(34,197,94,0.6)'
                : '1px solid rgba(255,255,255,0.08)',
              boxShadow: isActive ? '0 2px 10px rgba(34,197,94,0.35)' : 'none',
            }}
          >
            {icon}
          </button>
        );
      })}
    </div>
  );
}
