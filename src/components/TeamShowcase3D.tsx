import type { CSSProperties, ReactNode } from 'react';
import type { MemberRevealConcept, MemberRevealPhase } from '../lib/memberCinematicDirector';
import type { IdentityVariant, MemberDesignation } from '../lib/teamRoster';

export function TeamShowcaseAtmosphere({
  activeConcept = null,
  sequenceComplete = true,
}: {
  activeConcept?: MemberRevealConcept | null;
  sequenceComplete?: boolean;
}) {
  const stageClass = [
    'team-showcase-atmosphere',
    activeConcept ? `is-concept-${activeConcept}` : '',
    sequenceComplete ? 'is-complete' : 'is-choreographing',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={stageClass} aria-hidden="true">
      <div className="team-atmosphere-glow team-atmosphere-glow-solar" />
      <div className="team-atmosphere-glow team-atmosphere-glow-cobalt" />
      <div className="team-stage-spotlight" />
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

export function DesignationTag3D({
  designation,
  revealConcept,
  visible = true,
}: {
  designation: MemberDesignation;
  revealConcept?: MemberRevealConcept;
  visible?: boolean;
}) {
  if (!visible) return null;

  const tagStyle = {
    '--tag-entrance-delay': '0ms',
    '--tag-float-duration': `${designation.floatDurationSec}s`,
    '--tag-float-delay': `${designation.floatDelaySec}s`,
  } as CSSProperties;

  const conceptClass = revealConcept ? `tag-concept-${revealConcept}` : '';

  return (
    <div
      className={`designation-tag-3d is-${designation.kind} is-${designation.accentVariant} ${conceptClass}`.trim()}
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

export function CardPrecisionAccents({ variant }: { variant: IdentityVariant }) {
  return (
    <svg
      className={`credit-precision-svg is-${variant}`}
      viewBox="0 0 360 156"
      fill="none"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      {variant === 'aman-tech-crown' && (
        <g stroke="currentColor">
          <path d="M12 28V12H28" strokeWidth="1.3" strokeOpacity="0.65" />
          <path d="M348 128V144H332" strokeWidth="1.3" strokeOpacity="0.65" />
          <path d="M12 136V144H22M338 12H348V20" strokeWidth="1" strokeOpacity="0.32" />
          <path d="M62 12H206" strokeWidth="1" strokeOpacity="0.38" strokeDasharray="18 6 2 6" />
          <circle cx="308" cy="116" r="24" strokeWidth="0.8" strokeOpacity="0.14" strokeDasharray="3 5" />
          <path d="M308 86V146M278 116H338" strokeWidth="0.7" strokeOpacity="0.12" />
        </g>
      )}
      {variant === 'abhirup-project-crown' && (
        <g stroke="currentColor">
          <path d="M12 30V12H30" strokeWidth="1.4" strokeOpacity="0.78" />
          <path d="M348 30V12H330" strokeWidth="1.4" strokeOpacity="0.46" />
          <path d="M12 126V144H30" strokeWidth="1.4" strokeOpacity="0.46" />
          <path d="M348 126V144H330" strokeWidth="1.4" strokeOpacity="0.78" />
          <path d="M96 144C144 134 216 134 264 144" strokeWidth="1" strokeOpacity="0.24" />
          <circle cx="180" cy="78" r="56" strokeWidth="0.8" strokeOpacity="0.11" strokeDasharray="2 7" />
        </g>
      )}
      {variant === 'anik-tech-crown' && (
        <g stroke="currentColor">
          <path d="M12 28V12H28" strokeWidth="1.3" strokeOpacity="0.65" />
          <path d="M348 128V144H332" strokeWidth="1.3" strokeOpacity="0.65" />
          <path d="M12 136V144H22M338 12H348V20" strokeWidth="1" strokeOpacity="0.32" />
          <path d="M276 144L332 104" strokeWidth="0.9" strokeOpacity="0.18" />
          <ellipse cx="302" cy="114" rx="28" ry="15" transform="rotate(-18 302 114)" strokeWidth="0.8" strokeOpacity="0.16" />
        </g>
      )}
      {variant === 'standard-platinum' && (
        <g stroke="currentColor">
          <path d="M12 24V12H24" strokeWidth="1.1" strokeOpacity="0.42" />
          <path d="M348 132V144H336" strokeWidth="1.1" strokeOpacity="0.42" />
        </g>
      )}
    </svg>
  );
}

/**
 * Individual card cinematic stage layer providing unique reveal choreography
 * per member without covering nameplate legibility or interrupting settled cards.
 */
export function MemberCinematicIntroStage({
  concept,
  phase,
}: {
  concept: MemberRevealConcept;
  phase: MemberRevealPhase;
}) {
  if (phase === 'waiting') return null;

  return (
    <div
      className={`member-cinematic-fx fx-concept-${concept} phase-${phase}`}
      aria-hidden="true"
    >
      {concept === 'solar-tech-awakening' && (
        <>
          <span className="fx-aman-sweep" />
          <svg className="fx-stage-svg fx-aman-svg" viewBox="0 0 360 156" fill="none" preserveAspectRatio="none">
            <path className="aman-grid-line" d="M18 24H342M18 132H342" stroke="#62ddff" strokeOpacity="0.38" strokeWidth="1" strokeDasharray="324" />
            <path className="aman-grid-vert" d="M46 14V142M314 14V142" stroke="#53c8ff" strokeOpacity="0.28" strokeWidth="1" strokeDasharray="128" />
            <g className="aman-azimuth-reticle" stroke="#85ebff">
              <circle cx="304" cy="96" r="24" strokeWidth="1.1" strokeOpacity="0.62" strokeDasharray="5 4" />
              <circle cx="304" cy="96" r="14" strokeWidth="0.9" strokeOpacity="0.45" />
              <path d="M304 66V126M274 96H334" strokeWidth="0.9" strokeOpacity="0.52" />
            </g>
          </svg>
        </>
      )}

      {concept === 'golden-solar-crown' && (
        <>
          <span className="fx-abhirup-bloom" />
          <span className="fx-abhirup-sweep" />
          <svg className="fx-stage-svg fx-abhirup-svg" viewBox="0 0 360 156" fill="none" preserveAspectRatio="none">
            <g className="abhirup-rays" stroke="#ffd884" strokeLinecap="round">
              <path d="M180 78L94 20M180 78L266 20M180 78L52 78M180 78L308 78M180 78L108 136M180 78L252 136" strokeWidth="1" strokeOpacity="0.34" />
            </g>
            <path className="abhirup-meridian-arc" d="M68 122C118 42 242 42 292 122" stroke="#ffe19e" strokeWidth="1.2" strokeOpacity="0.55" strokeDasharray="280" />
            <path className="abhirup-meridian-inner" d="M108 130C144 68 216 68 252 130" stroke="#ffb84d" strokeWidth="1" strokeOpacity="0.48" strokeDasharray="180" />
            <g className="abhirup-crown-brackets" stroke="#ffe8b8" strokeWidth="1.4">
              <path d="M22 44V16H52M338 44V16H308" strokeOpacity="0.72" />
              <path d="M22 112V140H52M338 112V140H308" strokeOpacity="0.72" />
            </g>
          </svg>
        </>
      )}

      {concept === 'orbital-emergence' && (
        <>
          <span className="fx-anik-sweep" />
          <svg className="fx-stage-svg fx-anik-svg" viewBox="0 0 360 156" fill="none" preserveAspectRatio="none">
            <ellipse
              className="anik-orbit-path-a"
              cx="180"
              cy="78"
              rx="156"
              ry="58"
              transform="rotate(-11 180 78)"
              stroke="#79dcff"
              strokeWidth="1.15"
              strokeOpacity="0.48"
              strokeDasharray="680"
            />
            <ellipse
              className="anik-orbit-path-b"
              cx="180"
              cy="78"
              rx="142"
              ry="48"
              transform="rotate(14 180 78)"
              stroke="#dbeeff"
              strokeWidth="0.95"
              strokeOpacity="0.34"
              strokeDasharray="620"
            />
            <circle className="anik-orbit-node" cx="322" cy="52" r="3" fill="#8beeff" />
            <circle className="anik-orbit-node-b" cx="44" cy="108" r="2.4" fill="#e6f5ff" />
          </svg>
        </>
      )}

      {concept === 'platinum-spotlight' && (
        <span className="fx-saheb-spotlight" />
      )}

      {concept === 'chrome-light-trail' && (
        <span className="fx-sandipan-chrome-trail" />
      )}

      {concept === 'floating-platinum' && (
        <span className="fx-ananya-mist" />
      )}

      {concept === 'radiant-precision' && (
        <>
          <span className="fx-neha-radial" />
          <svg className="fx-stage-svg fx-neha-svg" viewBox="0 0 240 120" fill="none" preserveAspectRatio="none">
            <path d="M24 20H78M162 100H216" stroke="#d8eeff" strokeWidth="1" strokeOpacity="0.45" />
          </svg>
        </>
      )}

      {concept === 'particle-finale' && (
        <>
          <span className="fx-khushi-ribbon" />
          <span className="fx-khushi-motes">
            <i />
            <i />
            <i />
            <i />
            <i />
          </span>
        </>
      )}
    </div>
  );
}

export function DimensionalMemberName({
  nameText,
  revealDelayMs,
  concept,
  phase = 'settled',
  children,
}: {
  nameText: string;
  revealDelayMs: number;
  concept?: MemberRevealConcept;
  phase?: MemberRevealPhase;
  children: ReactNode;
}) {
  const style = {
    '--name-reveal-delay': `${revealDelayMs}ms`,
  } as CSSProperties;

  const conceptClass = concept ? `name-concept-${concept} phase-${phase}` : '';

  return (
    <span className={`member-name-3d ${conceptClass}`.trim()} style={style}>
      <span className="member-name-3d-shadow" aria-hidden="true">
        {nameText}
      </span>
      <span className="member-name-3d-extrude-back" aria-hidden="true">
        {nameText}
      </span>
      <span className="member-name-3d-extrude-mid" aria-hidden="true">
        {nameText}
      </span>
      <span className="member-name-3d-face">{children}</span>
    </span>
  );
}
