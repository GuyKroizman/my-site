import { Link } from 'react-router-dom'
import { useState, useRef, useEffect, useCallback } from 'react'

export default function WorkTools() {
  const [isPlaying, setIsPlaying] = useState(false)
  const [volume, setVolume] = useState(0.5)
  const [elapsedTime, setElapsedTime] = useState(0)
  const audioContextRef = useRef<AudioContext | null>(null)
  const noiseNodeRef = useRef<AudioBufferSourceNode | null>(null)
  const gainNodeRef = useRef<GainNode | null>(null)
  const animationFrameRef = useRef<number | null>(null)
  const timerIntervalRef = useRef<number | null>(null)

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

    // Create gain node for volume control
    const gainNode = audioContext.createGain()
    gainNode.gain.value = volume
    gainNode.connect(audioContext.destination)
    gainNodeRef.current = gainNode

    // Create buffer with brown noise
    const buffer = audioContext.createBuffer(1, bufferLength, sampleRate)
    const channelData = buffer.getChannelData(0)
    const noise = generateBrownNoise(bufferLength, sampleRate)
    channelData.set(noise)

    // Create and start the source
    const source = audioContext.createBufferSource()
    source.buffer = buffer
    source.loop = true
    source.connect(gainNode)
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
    if (gainNodeRef.current) {
      gainNodeRef.current.gain.value = newVolume
    }
  }

  const increaseVolume = useCallback(() => {
    setVolume((prevVolume) => {
      const newVolume = Math.min(1, prevVolume + 0.05)
      if (gainNodeRef.current) {
        gainNodeRef.current.gain.value = newVolume
      }
      return newVolume
    })
  }, [])

  const decreaseVolume = useCallback(() => {
    setVolume((prevVolume) => {
      const newVolume = Math.max(0, prevVolume - 0.05)
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

              {/* Volume Control */}
              <div className="w-full max-w-xs">
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

          {/* Future Tools Placeholder */}
          <div className="bg-gray-800 rounded-lg p-8 shadow-lg opacity-50">
            <h2 className="text-2xl md:text-3xl font-semibold mb-4 text-center text-gray-500">
              More Tools Coming Soon
            </h2>
            <p className="text-gray-400 text-center">
              Pomodoro timer and other productivity tools will be added here
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
