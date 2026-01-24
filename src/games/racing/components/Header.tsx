import { Link } from 'react-router-dom'

interface HeaderProps {
  hideHeader: boolean
}

export function Header({ hideHeader }: HeaderProps) {
  if (hideHeader) return null

  return (
    <div className="flex justify-between items-center p-4 bg-gray-800 text-white flex-shrink-0 z-30">
      <h1 className="text-2xl font-bold">Racing Game</h1>
      <Link to="/" className="text-xl text-blue-400 underline hover:text-blue-300">
        Back to Menu
      </Link>
    </div>
  )
}
