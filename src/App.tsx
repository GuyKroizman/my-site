import { Link } from 'react-router-dom'

function App() {
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
          </div>
        </div>
      </div>
    </div>
  )
}

export default App
