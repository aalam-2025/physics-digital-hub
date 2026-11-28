import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { ArrowRight } from 'lucide-react';
import {
  computeGuidancePlacement,
  detectGuidanceInputMode,
  getWelcomeGuidanceMessage,
  rectsIntersect,
  type GuidanceInputMode,
  type GuidancePlacementResult,
  type LayoutRect,
} from '../lib/welcomeGuidance';

function toLayoutRect(rect: DOMRect): LayoutRect {
  return {
    left: rect.left,
    top: rect.top,
    right: rect.right,
    bottom: rect.bottom,
    width: rect.width,
    height: rect.height,
  };
}

export interface WelcomeTeamButton3DProps {
  onActivate: () => void;
  disabled?: boolean;
  buttonRef?: React.RefObject<HTMLButtonElement | null>;
}

export function WelcomeTeamButton3D({
  onActivate,
  disabled = false,
  buttonRef,
}: WelcomeTeamButton3DProps) {
  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        className="intro-continue meet-team-3d-btn"
        disabled={disabled}
        aria-describedby="welcome-team-cta-desc"
        onClick={onActivate}
      >
        <span className="meet-team-extrude" aria-hidden="true" />
        <span className="meet-team-rim" aria-hidden="true" />
        <span className="meet-team-surface" aria-hidden="true">
          <span className="meet-team-sheen" />
          <span className="meet-team-corners" />
        </span>
        <span className="meet-team-content">
          <svg
            className="meet-team-reticle"
            viewBox="0 0 18 18"
            fill="none"
            aria-hidden="true"
          >
            <circle cx="9" cy="9" r="6.25" stroke="currentColor" strokeOpacity="0.6" strokeWidth="1.15" />
            <path d="M9 1.5V4.2M9 13.8V16.5M1.5 9H4.2M13.8 9H16.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
            <circle cx="9" cy="9" r="2.1" fill="currentColor" />
          </svg>
          <span className="meet-team-label">MEET THE TEAM</span>
          <span className="meet-team-arrow" aria-hidden="true">
            <ArrowRight size={15} />
          </span>
        </span>
      </button>
      <span id="welcome-team-cta-desc" className="sr-only">
        Manually advance to the eight-member team showcase and project explanation video.
      </span>
    </>
  );
}

export interface WelcomeGuidanceCloudProps {
  visible: boolean;
  dismissed: boolean;
  ctaZoneRef: React.RefObject<HTMLDivElement | null>;
  buttonRef: React.RefObject<HTMLButtonElement | null>;
}

export function WelcomeGuidanceCloud({
  visible,
  dismissed,
  ctaZoneRef,
  buttonRef,
}: WelcomeGuidanceCloudProps) {
  const cloudSlotRef = useRef<HTMLDivElement>(null);
  const cloudRef = useRef<HTMLDivElement>(null);
  const [inputMode, setInputMode] = useState<GuidanceInputMode>(() =>
    typeof window !== 'undefined'
      ? detectGuidanceInputMode(
          window.matchMedia('(pointer: coarse)').matches,
          window.innerWidth,
        )
      : 'desktop',
  );

  const [layout, setLayout] = useState<GuidancePlacementResult>(() => {
    const initialWidth = typeof window !== 'undefined' ? window.innerWidth : 1440;
    const initialHeight = typeof window !== 'undefined' ? window.innerHeight : 900;
    return {
      placement: initialWidth >= 980 ? 'right' : 'below',
      maxWidth: initialWidth >= 980 ? 316 : 330,
      compact: initialWidth <= 420 || initialHeight <= 700,
    };
  });

  const [safeOffset, setSafeOffset] = useState({ x: 0, y: 0 });
  const [pointerShiftX, setPointerShiftX] = useState<number>(36);

  useEffect(() => {
    const coarseMedia = window.matchMedia('(pointer: coarse)');
    const syncInputMode = () => {
      setInputMode(detectGuidanceInputMode(coarseMedia.matches, window.innerWidth));
    };
    syncInputMode();
    coarseMedia.addEventListener('change', syncInputMode);
    window.addEventListener('resize', syncInputMode, { passive: true });
    return () => {
      coarseMedia.removeEventListener('change', syncInputMode);
      window.removeEventListener('resize', syncInputMode);
    };
  }, []);

  useLayoutEffect(() => {
    const measureAndGuard = () => {
      const zone = ctaZoneRef.current;
      const btn = buttonRef.current;
      if (!zone || !btn) return;

      const copyEl = zone.closest('.welcome-copy');
      const artEl = document.querySelector('.welcome-screen .welcome-art');
      const footerEl = document.querySelector('.welcome-screen .intro-bottom');
      const copyRect = copyEl ? toLayoutRect(copyEl.getBoundingClientRect()) : toLayoutRect(zone.getBoundingClientRect());
      const buttonRect = toLayoutRect(btn.getBoundingClientRect());
      const artRect = artEl ? toLayoutRect(artEl.getBoundingClientRect()) : null;
      const footerRect = footerEl ? toLayoutRect(footerEl.getBoundingClientRect()) : null;

      const nextLayout = computeGuidancePlacement({
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight,
        copyRect,
        buttonRect,
        artRect,
        footerRect,
      });

      setLayout((prev) =>
        prev.placement === nextLayout.placement &&
        prev.maxWidth === nextLayout.maxWidth &&
        prev.compact === nextLayout.compact
          ? prev
          : nextLayout,
      );

      // Compute directional pointer alignment toward button center when stacked vertically
      const slotEl = cloudSlotRef.current;
      if (slotEl) {
        const slotRect = slotEl.getBoundingClientRect();
        const btnCenterX = buttonRect.left + buttonRect.width * 0.5;
        const relX = Math.max(24, Math.min(Math.max(24, slotRect.width - 28), btnCenterX - slotRect.left));
        setPointerShiftX(Math.round(relX));
      }

      // Real collision audit on the rendered cloud vs Solar Tracker, footer, and button
      const cloudEl = cloudRef.current;
      if (visible && cloudEl) {
        const cloudRect = toLayoutRect(cloudEl.getBoundingClientRect());
        let adjustX = 0;
        let adjustY = 0;
        if (nextLayout.placement === 'right' && artRect && rectsIntersect(cloudRect, artRect, 14)) {
          adjustX = Math.round(artRect.left - 18 - cloudRect.right);
        }
        if (footerRect && rectsIntersect(cloudRect, footerRect, 8)) {
          adjustY = Math.round(footerRect.top - 10 - cloudRect.bottom);
        }
        setSafeOffset((prev) =>
          prev.x === adjustX && prev.y === adjustY ? prev : { x: adjustX, y: adjustY },
        );
      } else {
        setSafeOffset((prev) => (prev.x === 0 && prev.y === 0 ? prev : { x: 0, y: 0 }));
      }
    };

    measureAndGuard();
    const resizeObserver = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measureAndGuard) : null;
    if (ctaZoneRef.current) resizeObserver?.observe(ctaZoneRef.current);
    const artEl = document.querySelector('.welcome-screen .welcome-art');
    if (artEl) resizeObserver?.observe(artEl);
    window.addEventListener('resize', measureAndGuard, { passive: true });
    return () => {
      resizeObserver?.disconnect();
      window.removeEventListener('resize', measureAndGuard);
    };
  }, [ctaZoneRef, buttonRef, visible, inputMode]);

  const message = getWelcomeGuidanceMessage(inputMode);
  const highlightWord = inputMode === 'touch' ? 'Tap' : 'Click';
  const [prefix, suffix] = message.split('MEET THE TEAM');

  const slotStyle = {
    '--guidance-max-w': `${layout.maxWidth}px`,
    '--guidance-pointer-x': `${pointerShiftX}px`,
    '--guidance-offset-x': `${safeOffset.x}px`,
    '--guidance-offset-y': `${safeOffset.y}px`,
  } as CSSProperties;

  return (
    <div
      ref={cloudSlotRef}
      className={`welcome-guidance-slot is-${layout.placement} ${layout.compact ? 'is-compact' : ''} ${visible && !dismissed ? 'is-visible' : ''}`.trim()}
      style={slotStyle}
      data-placement={layout.placement}
      data-input-mode={inputMode}
    >
      {visible && !dismissed && (
        <div
          ref={cloudRef}
          className={`welcome-guidance-cloud is-${layout.placement}`}
          role="note"
          aria-label={message}
          data-testid="welcome-guidance-cloud"
          data-placement={layout.placement}
          data-input-mode={inputMode}
        >
          <div className="guidance-cloud-float">
            <span className="guidance-cloud-extrude" aria-hidden="true" />
            <span className="guidance-cloud-pointer" aria-hidden="true" />
            <div className="guidance-cloud-glass">
              <span className="guidance-cloud-specular" aria-hidden="true" />
              <div className="guidance-cloud-body">
                <span className="guidance-cloud-glyph" aria-hidden="true">
                  <svg viewBox="0 0 16 16" fill="none">
                    <path d="M8 1.5L9.5 6.5L14.5 8L9.5 9.5L8 14.5L6.5 9.5L1.5 8L6.5 6.5L8 1.5Z" fill="currentColor" />
                  </svg>
                </span>
                <p className="guidance-cloud-text" data-action-verb={highlightWord}>
                  {prefix}
                  <strong>MEET THE TEAM</strong>
                  {suffix}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
