import { Link } from 'react-router-dom'
import { useState, useRef, useEffect, useCallback } from 'react'

// Load from localStorage with fallback
const loadFromStorage = (key: string, defaultValue: number): number => {
  if (typeof window === 'undefined') return defaultValue
  const stored = localStorage.getItem(key)
  if (stored === null) return defaultValue
  const parsed = parseFloat(stored)
  return isNaN(parsed) ? defaultValue : parsed
}

// Save to localStorage
const saveToStorage = (key: string, value: number) => {
  if (typeof window !== 'undefined') {
    localStorage.setItem(key, value.toString())
  }
}

type PomodoroSession = 'work' | 'shortBreak' | 'longBreak'

export default function WorkTools() {
  // Load initial values from localStorage
  const [isPlaying, setIsPlaying] = useState(false)
  const [volume, setVolume] = useState(() => loadFromStorage('workTools-volume', 0.5))
  const [frequencyCutoff, setFrequencyCutoff] = useState(() => loadFromStorage('workTools-frequency', 1000))
  const [elapsedTime, setElapsedTime] = useState(0)
  const audioContextRef = useRef<AudioContext | null>(null)
  const noiseNodeRef = useRef<AudioBufferSourceNode | null>(null)
  const gainNodeRef = useRef<GainNode | null>(null)
  const filterNodeRef = useRef<BiquadFilterNode | null>(null)
  const animationFrameRef = useRef<number | null>(null)
  const timerIntervalRef = useRef<number | null>(null)

  // Pomodoro timer state
  const [pomodoroWorkDuration, setPomodoroWorkDuration] = useState(() => loadFromStorage('pomodoro-work', 25))
  const [pomodoroShortBreak, setPomodoroShortBreak] = useState(() => loadFromStorage('pomodoro-shortBreak', 5))
  const [pomodoroLongBreak, setPomodoroLongBreak] = useState(() => loadFromStorage('pomodoro-longBreak', 15))
  const [pomodoroSession, setPomodoroSession] = useState<PomodoroSession>('work')
  const [pomodoroTimeRemaining, setPomodoroTimeRemaining] = useState(25 * 60) // in seconds
  const [pomodoroIsRunning, setPomodoroIsRunning] = useState(false)
  const [pomodoroCompletedSessions, setPomodoroCompletedSessions] = useState(0)
  const pomodoroIntervalRef = useRef<number | null>(null)

  // Generate brown noise buffer
  const generateBrownNoise = (length: number, sampleRate: number): Float32Array => {
    const buffer = new Float32Array(length)
    let lastValue = 0

    for (let i = 0; i < length; i++) {
      // Generate white noise
      const white = Math.random() * 2 - 1
      // Integrate to get brown noise (running average with damping)
      lastValue = (lastValue + white * 0.02) * 0.98
      buffer[i] = lastValue * 3.5 // Scale to prevent clipping
    }

    return buffer
  }

  const formatTime = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    const secs = Math.floor(seconds % 60)

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`
  }

  const formatPomodoroTime = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  // Pomodoro timer functions
  const getSessionDuration = (session: PomodoroSession): number => {
    switch (session) {
      case 'work':
        return pomodoroWorkDuration * 60
      case 'shortBreak':
        return pomodoroShortBreak * 60
      case 'longBreak':
        return pomodoroLongBreak * 60
    }
  }

  const playNotificationSound = () => {
    // Create a simple beep sound using Web Audio API
    if (audioContextRef.current) {
      const audioContext = audioContextRef.current
      const oscillator = audioContext.createOscillator()
      const gainNode = audioContext.createGain()

      oscillator.connect(gainNode)
      gainNode.connect(audioContext.destination)

      oscillator.frequency.value = 800
      oscillator.type = 'sine'

      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime)
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5)

      oscillator.start(audioContext.currentTime)
      oscillator.stop(audioContext.currentTime + 0.5)
    }
  }

  const startPomodoro = () => {
    setPomodoroIsRunning(true)
  }

  const pausePomodoro = () => {
    setPomodoroIsRunning(false)
  }

  const resetPomodoro = () => {
    setPomodoroIsRunning(false)
    setPomodoroTimeRemaining(getSessionDuration(pomodoroSession))
  }

  const switchPomodoroSession = (session: PomodoroSession) => {
    setPomodoroIsRunning(false)
    setPomodoroSession(session)
    setPomodoroTimeRemaining(getSessionDuration(session))
  }

  // Pomodoro timer countdown effect
  useEffect(() => {
    if (pomodoroIsRunning && pomodoroTimeRemaining > 0) {
      pomodoroIntervalRef.current = window.setInterval(() => {
        setPomodoroTimeRemaining((prev) => {
          if (prev <= 1) {
            return 0
          }
          return prev - 1
        })
      }, 1000)
    } else {
      if (pomodoroIntervalRef.current) {
        clearInterval(pomodoroIntervalRef.current)
        pomodoroIntervalRef.current = null
      }
    }

    return () => {
      if (pomodoroIntervalRef.current) {
        clearInterval(pomodoroIntervalRef.current)
        pomodoroIntervalRef.current = null
      }
    }
  }, [pomodoroIsRunning, pomodoroTimeRemaining])

  // Handle timer completion
  useEffect(() => {
    if (pomodoroTimeRemaining === 0 && !pomodoroIsRunning) {
      playNotificationSound()
      
      // Show browser notification if permission granted
      if ('Notification' in window && Notification.permission === 'granted') {
        const sessionName = pomodoroSession === 'work' ? 'Work' : pomodoroSession === 'shortBreak' ? 'Short Break' : 'Long Break'
        new Notification(`Pomodoro ${sessionName} Complete!`, {
          body: `Time to ${pomodoroSession === 'work' ? 'take a break' : 'get back to work'}!`,
          icon: '/vite.svg',
        })
      }

      // Auto-switch to next session
      if (pomodoroSession === 'work') {
        const completed = pomodoroCompletedSessions + 1
        setPomodoroCompletedSessions(completed)
        
        // Every 4 work sessions, take a long break
        setTimeout(() => {
          if (completed % 4 === 0) {
            setPomodoroSession('longBreak')
            setPomodoroTimeRemaining(pomodoroLongBreak * 60)
          } else {
            setPomodoroSession('shortBreak')
            setPomodoroTimeRemaining(pomodoroShortBreak * 60)
          }
        }, 1000)
      } else {
        // Break finished, go back to work
        setTimeout(() => {
          setPomodoroSession('work')
          setPomodoroTimeRemaining(pomodoroWorkDuration * 60)
        }, 1000)
      }
    }
  }, [pomodoroTimeRemaining, pomodoroIsRunning, pomodoroSession, pomodoroCompletedSessions, pomodoroWorkDuration, pomodoroShortBreak, pomodoroLongBreak])

  // Request notification permission on mount
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission()
    }
  }, [])

  // Update timer when session changes
  useEffect(() => {
    if (!pomodoroIsRunning) {
      setPomodoroTimeRemaining(getSessionDuration(pomodoroSession))
    }
  }, [pomodoroSession, pomodoroWorkDuration, pomodoroShortBreak, pomodoroLongBreak])

  const startBrownNoise = () => {
    if (audioContextRef.current?.state === 'suspended') {
      audioContextRef.current.resume()
    }

    if (!audioContextRef.current) {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext
      audioContextRef.current = new AudioContextClass()
    }

    const audioContext = audioContextRef.current
    const sampleRate = audioContext.sampleRate
    const bufferLength = sampleRate * 2 // 2 seconds of audio

    // Create low-pass filter
    const filterNode = audioContext.createBiquadFilter()
    filterNode.type = 'lowpass'
    filterNode.frequency.value = frequencyCutoff
    filterNode.Q.value = 1
    filterNodeRef.current = filterNode

    // Create gain node for volume control
    const gainNode = audioContext.createGain()
    gainNode.gain.value = volume
    gainNodeRef.current = gainNode

    // Connect: source -> filter -> gain -> destination
    filterNode.connect(gainNode)
    gainNode.connect(audioContext.destination)

    // Create buffer with brown noise
    const buffer = audioContext.createBuffer(1, bufferLength, sampleRate)
    const channelData = buffer.getChannelData(0)
    const noise = generateBrownNoise(bufferLength, sampleRate)
    channelData.set(noise)

    // Create and start the source
    const source = audioContext.createBufferSource()
    source.buffer = buffer
    source.loop = true
    source.connect(filterNode)
    source.start(0)
    noiseNodeRef.current = source

    setIsPlaying(true)
    setElapsedTime(0) // Reset timer when starting
  }

  const stopBrownNoise = () => {
    if (noiseNodeRef.current) {
      noiseNodeRef.current.stop()
      noiseNodeRef.current.disconnect()
      noiseNodeRef.current = null
    }
    if (filterNodeRef.current) {
      filterNodeRef.current.disconnect()
      filterNodeRef.current = null
    }
    setIsPlaying(false)
    setElapsedTime(0) // Reset timer when stopping
  }

  const toggleNoise = useCallback(() => {
    // Check if noise is currently playing by checking if node exists
    if (noiseNodeRef.current) {
      stopBrownNoise()
    } else {
      startBrownNoise()
    }
  }, [])

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVolume = parseFloat(e.target.value)
    setVolume(newVolume)
    saveToStorage('workTools-volume', newVolume)
    if (gainNodeRef.current) {
      gainNodeRef.current.gain.value = newVolume
    }
  }

  const handleFrequencyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newFrequency = parseFloat(e.target.value)
    setFrequencyCutoff(newFrequency)
    saveToStorage('workTools-frequency', newFrequency)
    if (filterNodeRef.current) {
      filterNodeRef.current.frequency.value = newFrequency
    }
  }

  const increaseVolume = useCallback(() => {
    setVolume((prevVolume) => {
      const newVolume = Math.min(1, prevVolume + 0.05)
      saveToStorage('workTools-volume', newVolume)
      if (gainNodeRef.current) {
        gainNodeRef.current.gain.value = newVolume
      }
      return newVolume
    })
  }, [])

  const decreaseVolume = useCallback(() => {
    setVolume((prevVolume) => {
      const newVolume = Math.max(0, prevVolume - 0.05)
      saveToStorage('workTools-volume', newVolume)
      if (gainNodeRef.current) {
        gainNodeRef.current.gain.value = newVolume
      }
      return newVolume
    })
  }, [])

  // Timer effect - updates elapsed time while playing
  useEffect(() => {
    if (isPlaying) {
      timerIntervalRef.current = window.setInterval(() => {
        setElapsedTime((prev) => prev + 1)
      }, 1000)
    } else {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current)
        timerIntervalRef.current = null
      }
    }

    return () => {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current)
        timerIntervalRef.current = null
      }
    }
  }, [isPlaying])

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger shortcuts when user is typing in an input field
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        (e.target as HTMLElement).isContentEditable
      ) {
        return
      }

      switch (e.key) {
        case ' ':
          e.preventDefault() // Prevent page scroll
          toggleNoise()
          break
        case 'ArrowUp':
          e.preventDefault() // Prevent page scroll
          increaseVolume()
          break
        case 'ArrowDown':
          e.preventDefault() // Prevent page scroll
          decreaseVolume()
          break
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [toggleNoise, increaseVolume, decreaseVolume])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopBrownNoise()
      if (audioContextRef.current) {
        audioContextRef.current.close()
        audioContextRef.current = null
      }
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current)
        timerIntervalRef.current = null
      }
      if (pomodoroIntervalRef.current) {
        clearInterval(pomodoroIntervalRef.current)
        pomodoroIntervalRef.current = null
      }
    }
  }, [])

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <Link
            to="/"
            className="text-xl text-blue-400 underline hover:text-blue-300 transition-colors"
          >
            ← Back to Menu
          </Link>
        </div>

        <h1 className="text-4xl md:text-6xl font-bold text-center mb-12">
          Work Tools
        </h1>

        <div className="max-w-2xl mx-auto space-y-8">
          {/* Brown Noise Section */}
          <div className="bg-gray-800 rounded-lg p-8 shadow-lg">
            <h2 className="text-2xl md:text-3xl font-semibold mb-6 text-center">
              Brown Noise
            </h2>
            <p className="text-gray-300 mb-2 text-center">
              Mask outside noise and improve focus with brown noise
            </p>
            <p className="text-gray-500 mb-6 text-center text-sm">
              Keyboard shortcuts: Space to play/pause • ↑/↓ to adjust volume
            </p>

            <div className="flex flex-col items-center space-y-6">
              {/* Play/Pause Button */}
              <button
                onClick={toggleNoise}
                className={`
                  w-24 h-24 rounded-full text-4xl font-bold
                  transition-all duration-200 transform hover:scale-105
                  focus:outline-none focus:ring-4 focus:ring-blue-500 focus:ring-opacity-50
                  ${isPlaying
                    ? 'bg-red-600 hover:bg-red-700 text-white'
                    : 'bg-green-600 hover:bg-green-700 text-white'
                  }
                `}
                aria-label={isPlaying ? 'Stop brown noise' : 'Play brown noise'}
              >
                {isPlaying ? '⏸' : '▶'}
              </button>

              {/* Sound Controls */}
              <div className="w-full max-w-2xl space-y-6">
                {/* Volume Control */}
                <div className="w-full">
                  <label htmlFor="volume" className="block text-sm text-gray-400 mb-2 text-center">
                    Volume
                  </label>
                  <input
                    id="volume"
                    type="range"
                    min="0"
                    max="1"
                    step="0.01"
                    value={volume}
                    onChange={handleVolumeChange}
                    className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                  />
                  <div className="flex justify-between text-xs text-gray-500 mt-1">
                    <span>0%</span>
                    <span>{Math.round(volume * 100)}%</span>
                    <span>100%</span>
                  </div>
                </div>

                {/* Frequency Control */}
                <div className="w-full">
                  <label htmlFor="frequency" className="block text-sm text-gray-400 mb-2 text-center">
                    Frequency Cutoff
                  </label>
                  <input
                    id="frequency"
                    type="range"
                    min="200"
                    max="5000"
                    step="10"
                    value={frequencyCutoff}
                    onChange={handleFrequencyChange}
                    className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                  />
                  <div className="flex justify-between text-xs text-gray-500 mt-1">
                    <span>200 Hz</span>
                    <span>{Math.round(frequencyCutoff)} Hz</span>
                    <span>5000 Hz</span>
                  </div>
                </div>
              </div>

              {/* Status Indicator and Timer */}
              {isPlaying && (
                <div className="flex flex-col items-center space-y-2">
                  <div className="flex items-center space-x-2 text-green-400">
                    <div className="w-3 h-3 bg-green-400 rounded-full animate-pulse"></div>
                    <span className="text-sm">Playing</span>
                  </div>
                  <div className="text-2xl md:text-3xl font-mono font-semibold text-gray-300">
                    {formatTime(elapsedTime)}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Pomodoro Timer Section */}
          <div className="bg-gray-800 rounded-lg p-8 shadow-lg">
            <h2 className="text-2xl md:text-3xl font-semibold mb-6 text-center">
              Pomodoro Timer
            </h2>

            {/* Session Selector */}
            <div className="flex justify-center gap-4 mb-6">
              <button
                onClick={() => switchPomodoroSession('work')}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  pomodoroSession === 'work'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                Work
              </button>
              <button
                onClick={() => switchPomodoroSession('shortBreak')}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  pomodoroSession === 'shortBreak'
                    ? 'bg-green-600 text-white'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                Short Break
              </button>
              <button
                onClick={() => switchPomodoroSession('longBreak')}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  pomodoroSession === 'longBreak'
                    ? 'bg-purple-600 text-white'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                Long Break
              </button>
            </div>

            {/* Timer Display */}
            <div className="flex flex-col items-center mb-6">
              <div className="text-6xl md:text-8xl font-mono font-bold mb-4 text-center">
                {formatPomodoroTime(pomodoroTimeRemaining)}
              </div>
              
              {/* Progress Bar */}
              <div className="w-full max-w-md h-2 bg-gray-700 rounded-full mb-4">
                <div
                  className={`h-full rounded-full transition-all duration-1000 ${
                    pomodoroSession === 'work'
                      ? 'bg-blue-600'
                      : pomodoroSession === 'shortBreak'
                      ? 'bg-green-600'
                      : 'bg-purple-600'
                  }`}
                  style={{
                    width: `${((getSessionDuration(pomodoroSession) - pomodoroTimeRemaining) / getSessionDuration(pomodoroSession)) * 100}%`,
                  }}
                />
              </div>

              {/* Session Info */}
              <div className="text-sm text-gray-400 mb-4">
                {pomodoroSession === 'work' && 'Focus time'}
                {pomodoroSession === 'shortBreak' && 'Take a short break'}
                {pomodoroSession === 'longBreak' && 'Take a long break'}
                {pomodoroCompletedSessions > 0 && (
                  <span className="ml-2">• {pomodoroCompletedSessions} session{pomodoroCompletedSessions !== 1 ? 's' : ''} completed</span>
                )}
              </div>

              {/* Control Buttons */}
              <div className="flex gap-4">
                {!pomodoroIsRunning ? (
                  <button
                    onClick={startPomodoro}
                    className="px-6 py-3 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-lg transition-colors"
                  >
                    Start
                  </button>
                ) : (
                  <button
                    onClick={pausePomodoro}
                    className="px-6 py-3 bg-yellow-600 hover:bg-yellow-700 text-white font-semibold rounded-lg transition-colors"
                  >
                    Pause
                  </button>
                )}
                <button
                  onClick={resetPomodoro}
                  className="px-6 py-3 bg-gray-700 hover:bg-gray-600 text-white font-semibold rounded-lg transition-colors"
                >
                  Reset
                </button>
              </div>
            </div>

            {/* Settings */}
            <div className="mt-8 pt-6 border-t border-gray-700">
              <h3 className="text-lg font-semibold mb-4 text-center">Settings</h3>
              <div className="space-y-4">
                <div>
                  <label htmlFor="work-duration" className="block text-sm text-gray-400 mb-2">
                    Work Duration (minutes)
                  </label>
                  <input
                    id="work-duration"
                    type="number"
                    min="1"
                    max="60"
                    value={pomodoroWorkDuration}
                    onChange={(e) => {
                      const value = Math.max(1, Math.min(60, parseInt(e.target.value) || 25))
                      setPomodoroWorkDuration(value)
                      saveToStorage('pomodoro-work', value)
                      if (pomodoroSession === 'work' && !pomodoroIsRunning) {
                        setPomodoroTimeRemaining(value * 60)
                      }
                    }}
                    className="w-full px-4 py-2 bg-gray-700 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label htmlFor="short-break-duration" className="block text-sm text-gray-400 mb-2">
                    Short Break (minutes)
                  </label>
                  <input
                    id="short-break-duration"
                    type="number"
                    min="1"
                    max="30"
                    value={pomodoroShortBreak}
                    onChange={(e) => {
                      const value = Math.max(1, Math.min(30, parseInt(e.target.value) || 5))
                      setPomodoroShortBreak(value)
                      saveToStorage('pomodoro-shortBreak', value)
                      if (pomodoroSession === 'shortBreak' && !pomodoroIsRunning) {
                        setPomodoroTimeRemaining(value * 60)
                      }
                    }}
                    className="w-full px-4 py-2 bg-gray-700 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label htmlFor="long-break-duration" className="block text-sm text-gray-400 mb-2">
                    Long Break (minutes)
                  </label>
                  <input
                    id="long-break-duration"
                    type="number"
                    min="1"
                    max="60"
                    value={pomodoroLongBreak}
                    onChange={(e) => {
                      const value = Math.max(1, Math.min(60, parseInt(e.target.value) || 15))
                      setPomodoroLongBreak(value)
                      saveToStorage('pomodoro-longBreak', value)
                      if (pomodoroSession === 'longBreak' && !pomodoroIsRunning) {
                        setPomodoroTimeRemaining(value * 60)
                      }
                    }}
                    className="w-full px-4 py-2 bg-gray-700 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
