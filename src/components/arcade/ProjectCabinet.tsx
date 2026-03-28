import { Project, Availability } from './cabinetData'

interface ProjectCabinetProps {
  project: Project
  isMobile: boolean
  isIPhone: boolean
  onClick: () => void
}

function getAvailabilityLabel(availability: Availability, isMobile: boolean, isIPhone: boolean): string | null {
  switch (availability) {
    case 'desktop':
      return isMobile ? 'Desktop Only' : null
    case 'mobile':
      return !isMobile ? 'Mobile Only' : null
    case 'mobile-no-iphone':
      if (!isMobile) return 'Mobile Only'
      if (isIPhone) return 'Not on iPhone'
      return null
    case 'vr':
      return isMobile ? 'VR Headset Required' : null
    default:
      return null
  }
}

function isDisabled(availability: Availability, isMobile: boolean, isIPhone: boolean): boolean {
  switch (availability) {
    case 'desktop':
      return isMobile
    case 'mobile':
      return !isMobile
    case 'mobile-no-iphone':
      return !isMobile || isIPhone
    case 'vr':
      return isMobile
    default:
      return false
  }
}

export default function ProjectCabinet({ project, isMobile, isIPhone, onClick }: ProjectCabinetProps) {
  const disabled = isDisabled(project.availability, isMobile, isIPhone)
  const label = getAvailabilityLabel(project.availability, isMobile, isIPhone)

  return (
    <div
      className={`arcade-cabinet ${disabled ? 'arcade-cabinet-disabled' : ''}`}
      style={{
        '--cabinet-color': project.color,
      } as React.CSSProperties}
      onClick={disabled ? undefined : onClick}
    >
      {project.badge && (
        <div className="arcade-cabinet-badge">{project.badge}</div>
      )}
      <div className="arcade-cabinet-emoji">
        {project.iconImage ? (
          <div style={{
            width: '2.5rem',
            height: '2.5rem',
            backgroundImage: `url(${project.iconImage})`,
            backgroundSize: '200% 200%',
            backgroundPosition: '0% 100%',
            borderRadius: '4px',
            margin: '0 auto',
          }} />
        ) : (
          project.emoji
        )}
      </div>
      <div className="arcade-cabinet-title">{project.title}</div>
      <div className="arcade-cabinet-subtitle">{project.subtitle}</div>
      <div className="arcade-cabinet-description"
        {...(project.id === 'snake-bitter' ? { dir: 'rtl' } : {})}
      >
        {project.description}
      </div>
      {label ? (
        <div className="arcade-cabinet-unavailable">{label}</div>
      ) : (
        <div
          className="arcade-cabinet-button"
          style={{ backgroundColor: project.color }}
        >
          {project.id === 'snake-bitter' ? 'Read Story' : project.id === 'floaty' ? 'Enter VR' : 'Play Game'}
        </div>
      )}
    </div>
  )
}
