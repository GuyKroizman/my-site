import { Link } from 'react-router-dom'
import { useState, useEffect } from 'react'

function App() {
  const [isMobile, setIsMobile] = useState(false)
  const [isIPhone, setIsIPhone] = useState(false)

  useEffect(() => {
    const ua = navigator.userAgent
    setIsMobile(/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua))
    setIsIPhone(/iPhone|iPad|iPod/i.test(ua))
  }, [])
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <header className="text-center mb-12">
            <h1 className="text-5xl font-bold text-gray-800 mb-4">
              Welcome to My Site
            </h1>
            <p className="text-xl text-gray-600">
              Below are some things I did
            </p>
          </header>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {/* Snake Bitter Story */}
            <div className="bg-white rounded-lg shadow-lg p-6 hover:shadow-xl transition-shadow">
              <div className="text-center mb-4">
                <div className="text-4xl mb-2">🐍</div>
                <h2 className="text-2xl font-semibold text-gray-800">נושך הנחשים</h2>
                <p className="text-gray-600 mt-2">סיפור ילדים</p>
              </div>
              <p dir="rtl" className="text-gray-700 mb-4 text-sm">
                סיפור ילדים שנכתב במשך כמה ארוחות ערב עם הילדים.
              </p>
              <Link
                to="/snake-bitter"
                className="block w-full text-center bg-amber-500 hover:bg-amber-600 text-white font-semibold py-2 px-4 rounded transition-colors"
              >
                Read Story
              </Link>
            </div>

            {/* Rogue0 Game */}
            <div className="bg-white rounded-lg shadow-lg p-6 hover:shadow-xl transition-shadow">
              <div className="text-center mb-4">
                <div className="text-4xl mb-2">⚔️</div>
                <h2 className="text-2xl font-semibold text-gray-800">Rogue0</h2>
                <p className="text-gray-600 mt-2">Dungeon Adventure</p>
              </div>
              <p className="text-gray-700 mb-4 text-sm">
                Work in progress. Nothing t see here yet.
              </p>
              <Link
                to="/rogue0"
                className="block w-full text-center bg-red-500 hover:bg-red-600 text-white font-semibold py-2 px-4 rounded transition-colors"
              >
                Play Game
              </Link>
            </div>

            {/* Hoot Game */}
            <div className="bg-white rounded-lg shadow-lg p-6 hover:shadow-xl transition-shadow">
              <div className="text-center mb-4">
                <div className="text-4xl mb-2">🎯</div>
                <h2 className="text-2xl font-semibold text-gray-800">Hoot</h2>
                <p className="text-gray-600 mt-2">Cute 2d survival game</p>
              </div>
              <p className="text-gray-700 mb-4 text-sm">
                Desktop game with 3 Stages and a bose fight.
              </p>
              <Link
                to="/hoot"
                className="block w-full text-center bg-blue-500 hover:bg-blue-600 text-white font-semibold py-2 px-4 rounded transition-colors"
              >
                Play Game
              </Link>
            </div>

            {/* Work Tools */}
            <div className="bg-white rounded-lg shadow-lg p-6 hover:shadow-xl transition-shadow">
              <div className="text-center mb-4">
                <div className="text-4xl mb-2">🎧</div>
                <h2 className="text-2xl font-semibold text-gray-800">Work Tools</h2>
                <p className="text-gray-600 mt-2">Focus & Productivity</p>
              </div>
              <p className="text-gray-700 mb-4 text-sm">
                Brown noise generator and productivity tools for focused work.
              </p>
              <Link
                to="/work-tools"
                className="block w-full text-center bg-purple-500 hover:bg-purple-600 text-white font-semibold py-2 px-4 rounded transition-colors"
              >
                Open Tools
              </Link>
            </div>

            {/* Racing Game */}
            <div className="bg-white rounded-lg shadow-lg p-6 hover:shadow-xl transition-shadow">
              <div className="text-center mb-4">
                <div className="text-4xl mb-2">🏎️</div>
                <h2 className="text-2xl font-semibold text-gray-800">Racing Game</h2>
                <p className="text-gray-600 mt-2">3D Polygon Racing</p>
              </div>
              <p className="text-gray-700 mb-4 text-sm">
                Race against AI opponents on a 3D track. Use arrow keys to control your car.
              </p>
              <Link
                to="/racing-game"
                className="block w-full text-center bg-orange-500 hover:bg-orange-600 text-white font-semibold py-2 px-4 rounded transition-colors"
              >
                Play Game
              </Link>
            </div>

            {/* The Mask - mobile only; disabled on desktop and on iPhone (Safari/iOS limits) */}
            <div className={`bg-white rounded-lg shadow-lg p-6 transition-shadow ${!isMobile || isIPhone ? 'opacity-75' : 'hover:shadow-xl'}`}>
              <div className="text-center mb-4">
                <div className="text-4xl mb-2">🎭</div>
                <h2 className="text-2xl font-semibold text-gray-800">The Mask</h2>
                <p className="text-gray-600 mt-2">3D Top-Down Shooter</p>
              </div>
              <p className="text-gray-700 mb-4 text-sm">
                3D arena with physics. Move with arrows/WASD, shoot with Space. Boxes react to hits.
              </p>
              {!isMobile ? (
                <div className="block w-full text-center bg-gray-400 text-white font-semibold py-2 px-4 rounded cursor-not-allowed">
                  Mobile only
                </div>
              ) : isIPhone ? (
                <>
                  <p className="text-amber-700 text-sm mb-3 font-medium">
                    Not available on iPhone. Apple restricts advanced web tech (e.g. WebGL) on iOS to favor native apps and tighter security, so this game doesn’t run well in Safari. Use an Android phone for the best experience.
                  </p>
                  <div className="block w-full text-center bg-gray-400 text-white font-semibold py-2 px-4 rounded cursor-not-allowed">
                    Unavailable on this device
                  </div>
                </>
              ) : (
                <Link
                  to="/the-mask"
                  className="block w-full text-center bg-teal-500 hover:bg-teal-600 text-white font-semibold py-2 px-4 rounded transition-colors"
                >
                  Play Game
                </Link>
              )}
            </div>

            {/* Floaty McHandface - VR Game */}
            <div className={`bg-white rounded-lg shadow-lg p-6 transition-shadow ${isMobile ? 'opacity-60' : 'hover:shadow-xl'}`}>
              <div className="text-center mb-4">
                <div className="text-4xl mb-2">🥽</div>
                <h2 className="text-2xl font-semibold text-gray-800">Floaty McHandface</h2>
                <p className="text-gray-600 mt-2">VR Experience</p>
              </div>
              <p className="text-gray-700 mb-4 text-sm">
                VR room with floating hands. Put on your headset and push yourself around with your palms!
              </p>
              {isMobile ? (
                <div className="block w-full text-center bg-gray-400 text-white font-semibold py-2 px-4 rounded cursor-not-allowed">
                  VR Headset Required
                </div>
              ) : (
                <Link
                  to="/floaty-mchandface"
                  className="block w-full text-center bg-pink-500 hover:bg-pink-600 text-white font-semibold py-2 px-4 rounded transition-colors"
                >
                  Enter VR
                </Link>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default App
