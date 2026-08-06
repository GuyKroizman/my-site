import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { projects, type Project } from '../arcade/cabinetData'
import { isMobileBrowser } from '../../utils/runtime'

const marginDoodle = `
  __...--~~
 (    meow!
  ~~--...__
`

const cornerDoodle = `
  _
 (\\
 ( ^)
c(")(")
`

const footerDoodle = `
    *
   ***
  *****
    |
  ~~~|~~~`

const displayOrder = ['hoot', 'racing', 'the-mask', 'snake-bitter', 'rogue0', 'tiny-shooter', 'floaty', 'gmtk-2026']

const constructionIds = new Set(['rogue0', 'tiny-shooter', 'floaty', 'gmtk-2026'])
const desktopOnlyIds = new Set(['rogue0', 'hoot'])

function orderedProjects(): Project[] {
  const map = new Map(projects.map((p) => [p.id, p]))
  return displayOrder.map((id) => map.get(id)!).filter(Boolean)
}

export default function Menu() {
  const navigate = useNavigate()
  const [activeId, setActiveId] = useState<string | null>(null)
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    setIsMobile(isMobileBrowser())
  }, [])

  return (
    <div className="notebook">
      {/* Red margin line */}
      <div className="notebook-margin" />

      {/* Margin doodles */}
      <pre className="doodle doodle-top">{marginDoodle}</pre>
      <pre className="doodle doodle-bot">{cornerDoodle}</pre>

      {/* Name tag */}
      <div className="name-tag">
        <span className="name-tag-text">Hi! My name is</span>
        <span className="name-tag-name">GUY</span>
        <svg className="name-tag-underline" width="120" height="8" viewBox="0 0 120 8">
          <path d="M5,4 Q30,0 60,4 Q90,8 115,4" stroke="#ff6b6b" strokeWidth="2.5" fill="none" strokeLinecap="round"/>
        </svg>
        <span className="name-tag-sub">welcome to my page :)</span>
      </div>

      {/* Project list */}
      <div className="notebook-list">
        {orderedProjects().map((project) => {
          const desktopOnly = isMobile && desktopOnlyIds.has(project.id)
          const construction = constructionIds.has(project.id)

          return (
            <button
              key={project.id}
              className={`notebook-entry ${activeId === project.id ? 'entry-open' : ''}`}
              style={{ '--entry-color': project.color } as React.CSSProperties}
              onClick={() => navigate(project.path)}
              onMouseEnter={() => setActiveId(project.id)}
              onMouseLeave={() => setActiveId(null)}
            >
              <span className="entry-bullet" style={{ color: project.color }}>✦</span>
              <span className="entry-emoji">{project.emoji}</span>
              <span className="entry-title">
                {project.title}
                {construction && <span className="entry-badge badge-wip">wip</span>}
                {desktopOnly && <span className="entry-badge badge-dt">desktop</span>}
              </span>
              <span className="entry-arrow">→</span>
            </button>
          )
        })}
      </div>

      {/* Footer doodle */}
      <pre className="doodle doodle-foot">{footerDoodle}</pre>
    </div>
  )
}
