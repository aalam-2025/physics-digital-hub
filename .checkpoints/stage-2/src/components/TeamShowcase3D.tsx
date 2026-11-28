import type { CSSProperties, ReactNode } from 'react';
import type { MemberDesignation } from '../lib/teamRoster';

export function TeamShowcaseAtmosphere() {
  return (
    <div className="team-showcase-atmosphere" aria-hidden="true">
      <div className="team-atmosphere-glow team-atmosphere-glow-solar" />
      <div className="team-atmosphere-glow team-atmosphere-glow-cobalt" />
      <svg
        className="team-solar-reticle"
        viewBox="0 0 1200 720"
        fill="none"
        preserveAspectRatio="xMidYMid slice"
      >
        <g className="reticle-azimuth-ring" stroke="rgba(116, 206, 255, 0.14)" strokeWidth="1">
          <circle cx="600" cy="360" r="305" strokeDasharray="3 11" />
          <circle cx="600" cy="360" r="245" strokeOpacity="0.65" />
        </g>
        <g className="reticle-elevation-ring" stroke="rgba(255, 196, 106, 0.16)" strokeWidth="1">
          <ellipse cx="600" cy="360" rx="440" ry="155" transform="rotate(-14 600 360)" strokeDasharray="6 14" />
          <ellipse cx="600" cy="360" rx="390" ry="135" transform="rotate(18 600 360)" strokeOpacity="0.5" />
        </g>
        <g stroke="rgba(128, 212, 255, 0.15)" strokeWidth="1">
          <path d="M135 360H250M950 360H1065" />
          <path d="M600 54V112M600 608V666" />
        </g>
      </svg>
    </div>
  );
}

function TechLeaderEmblem() {
  return (
    <svg className="tag-3d-emblem" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <circle cx="8" cy="8" r="5.5" stroke="currentColor" strokeWidth="1.2" strokeOpacity="0.72" />
      <path d="M8 1.5V4M8 12V14.5M1.5 8H4M12 8H14.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
      <rect x="6.2" y="6.2" width="3.6" height="3.6" transform="rotate(45 8 8)" fill="currentColor" />
    </svg>
  );
}

function ProjectLeaderEmblem() {
  return (
    <svg className="tag-3d-emblem" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M8 1.4L9.75 6.25L14.6 8L9.75 9.75L8 14.6L6.25 9.75L1.4 8L6.25 6.25L8 1.4Z"
        fill="currentColor"
      />
      <circle cx="8" cy="8" r="6.4" stroke="currentColor" strokeWidth="0.9" strokeOpacity="0.5" strokeDasharray="2 2.5" />
    </svg>
  );
}

export function DesignationTag3D({ designation }: { designation: MemberDesignation }) {
  const tagStyle = {
    '--tag-entrance-delay': `${designation.entranceDelayMs}ms`,
    '--tag-float-duration': `${designation.floatDurationSec}s`,
    '--tag-float-delay': `${designation.floatDelaySec}s`,
  } as CSSProperties;

  return (
    <div
      className={`designation-tag-3d is-${designation.kind} is-${designation.accentVariant}`}
      style={tagStyle}
      data-testid={`designation-tag-${designation.kind}`}
    >
      <div className="tag-3d-entrance">
        <div className="tag-3d-float">
          <span className="tag-3d-extrusion" aria-hidden="true" />
          <span className="tag-3d-rim" aria-hidden="true" />
          <span className="tag-3d-face">
            {designation.kind === 'project-leader' ? <ProjectLeaderEmblem /> : <TechLeaderEmblem />}
            <span className="tag-3d-label">{designation.label}</span>
          </span>
        </div>
      </div>
    </div>
  );
}

export function DimensionalMemberName({
  nameText,
  revealDelayMs,
  children,
}: {
  nameText: string;
  revealDelayMs: number;
  children: ReactNode;
}) {
  const style = {
    '--name-reveal-delay': `${revealDelayMs}ms`,
  } as CSSProperties;

  return (
    <span className="member-name-3d" style={style}>
      <span className="member-name-3d-depth" aria-hidden="true">
        {nameText}
      </span>
      <span className="member-name-3d-face">{children}</span>
    </span>
  );
}
