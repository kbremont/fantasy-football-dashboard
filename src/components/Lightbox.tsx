import { useEffect, useCallback, useRef, useState } from 'react'
import { X, ChevronLeft, ChevronRight, Play, Pause, Volume2, VolumeX, Download } from 'lucide-react'
import { cn } from '@/lib/utils'
import { type MediaItem } from '@/lib/storage'

interface LightboxProps {
  media: MediaItem[]
  selectedIndex: number
  onClose: () => void
  onNavigate: (index: number) => void
}

export function Lightbox({ media, selectedIndex, onClose, onNavigate }: LightboxProps) {
  const [isPlaying, setIsPlaying] = useState(false)
  const [isMuted, setIsMuted] = useState(true)
  const [showControls, setShowControls] = useState(true)
  const [imageLoaded, setImageLoaded] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)
  const filmstripRef = useRef<HTMLDivElement>(null)
  const controlsTimeoutRef = useRef<ReturnType<typeof setTimeout>>()
  const containerRef = useRef<HTMLDivElement>(null)

  const currentItem = media[selectedIndex]
  const hasNext = selectedIndex < media.length - 1
  const hasPrev = selectedIndex > 0

  // Navigate to next/prev
  const goNext = useCallback(() => {
    if (hasNext) {
      setImageLoaded(false)
      onNavigate(selectedIndex + 1)
    }
  }, [hasNext, selectedIndex, onNavigate])

  const goPrev = useCallback(() => {
    if (hasPrev) {
      setImageLoaded(false)
      onNavigate(selectedIndex - 1)
    }
  }, [hasPrev, selectedIndex, onNavigate])

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'Escape':
          onClose()
          break
        case 'ArrowRight':
          goNext()
          break
        case 'ArrowLeft':
          goPrev()
          break
        case ' ':
          e.preventDefault()
          if (currentItem?.isVideo) {
            togglePlayPause()
          }
          break
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [goNext, goPrev, onClose, currentItem])

  // Scroll filmstrip to center current item
  useEffect(() => {
    if (filmstripRef.current) {
      const container = filmstripRef.current
      const activeThumb = container.children[selectedIndex] as HTMLElement
      if (activeThumb) {
        const scrollLeft = activeThumb.offsetLeft - container.offsetWidth / 2 + activeThumb.offsetWidth / 2
        container.scrollTo({ left: scrollLeft, behavior: 'smooth' })
      }
    }
  }, [selectedIndex])

  // Reset video state on item change
  useEffect(() => {
    setIsPlaying(false)
    if (videoRef.current) {
      videoRef.current.currentTime = 0
    }
  }, [selectedIndex])

  // Auto-hide controls
  const resetControlsTimeout = useCallback(() => {
    setShowControls(true)
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current)
    }
    controlsTimeoutRef.current = setTimeout(() => {
      if (isPlaying) {
        setShowControls(false)
      }
    }, 3000)
  }, [isPlaying])

  useEffect(() => {
    resetControlsTimeout()
    return () => {
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current)
      }
    }
  }, [resetControlsTimeout])

  // Video controls
  const togglePlayPause = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause()
      } else {
        videoRef.current.play()
      }
      setIsPlaying(!isPlaying)
    }
  }

  const toggleMute = () => {
    if (videoRef.current) {
      videoRef.current.muted = !isMuted
      setIsMuted(!isMuted)
    }
  }

  // Download current media
  const downloadMedia = async () => {
    if (!currentItem) return

    try {
      const response = await fetch(currentItem.url)
      const blob = await response.blob()
      const blobUrl = URL.createObjectURL(blob)

      const link = document.createElement('a')
      link.href = blobUrl
      link.download = currentItem.name
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(blobUrl)
    } catch (error) {
      console.error('Download failed:', error)
    }
  }

  // Handle click outside
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === containerRef.current) {
      onClose()
    }
  }

  // Lock body scroll
  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = ''
    }
  }, [])

  return (
    <div
      className="fixed inset-0 z-50 animate-in fade-in duration-300"
      onMouseMove={resetControlsTimeout}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/95 backdrop-blur-xl" />

      {/* Subtle gradient overlay for depth */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-transparent to-black/80 pointer-events-none" />

      {/* Main container */}
      <div
        ref={containerRef}
        className="absolute inset-0 flex items-center justify-center p-4 pb-28"
        onClick={handleBackdropClick}
      >
        {/* Download button */}
        <button
          onClick={downloadMedia}
          className={cn(
            'absolute top-4 right-20 z-20',
            'w-12 h-12 rounded-full',
            'bg-white/10 backdrop-blur-md border border-white/10',
            'flex items-center justify-center',
            'text-white/70 hover:text-white hover:bg-white/20',
            'transition-all duration-300',
            showControls ? 'opacity-100' : 'opacity-0'
          )}
        >
          <Download className="w-5 h-5" />
        </button>

        {/* Close button */}
        <button
          onClick={onClose}
          className={cn(
            'absolute top-4 right-4 z-20',
            'w-12 h-12 rounded-full',
            'bg-white/10 backdrop-blur-md border border-white/10',
            'flex items-center justify-center',
            'text-white/70 hover:text-white hover:bg-white/20',
            'transition-all duration-300',
            showControls ? 'opacity-100' : 'opacity-0'
          )}
        >
          <X className="w-6 h-6" />
        </button>

        {/* Counter */}
        <div
          className={cn(
            'absolute top-4 left-4 z-20',
            'px-4 py-2 rounded-lg',
            'bg-white/10 backdrop-blur-md border border-white/10',
            'transition-opacity duration-300',
            showControls ? 'opacity-100' : 'opacity-0'
          )}
        >
          <span className="font-display text-xl tracking-wider text-white">
            {selectedIndex + 1}
          </span>
          <span className="text-white/50 mx-2">/</span>
          <span className="text-white/50">{media.length}</span>
        </div>

        {/* Navigation arrows */}
        <button
          onClick={goPrev}
          disabled={!hasPrev}
          className={cn(
            'absolute left-4 z-20',
            'w-14 h-14 rounded-full',
            'bg-white/10 backdrop-blur-md border border-white/10',
            'flex items-center justify-center',
            'transition-all duration-300',
            hasPrev
              ? 'text-white/70 hover:text-white hover:bg-white/20 hover:scale-110'
              : 'text-white/20 cursor-not-allowed',
            showControls ? 'opacity-100' : 'opacity-0'
          )}
        >
          <ChevronLeft className="w-8 h-8" />
        </button>

        <button
          onClick={goNext}
          disabled={!hasNext}
          className={cn(
            'absolute right-4 z-20',
            'w-14 h-14 rounded-full',
            'bg-white/10 backdrop-blur-md border border-white/10',
            'flex items-center justify-center',
            'transition-all duration-300',
            hasNext
              ? 'text-white/70 hover:text-white hover:bg-white/20 hover:scale-110'
              : 'text-white/20 cursor-not-allowed',
            showControls ? 'opacity-100' : 'opacity-0'
          )}
        >
          <ChevronRight className="w-8 h-8" />
        </button>

        {/* Media display */}
        <div className="relative max-w-7xl max-h-full w-full h-full flex items-center justify-center">
          {currentItem?.isVideo ? (
            <div className="relative group">
              <video
                ref={videoRef}
                src={currentItem.url}
                className="max-w-full max-h-[calc(100vh-12rem)] rounded-lg shadow-2xl"
                muted={isMuted}
                playsInline
                loop
                onClick={togglePlayPause}
                onPlay={() => setIsPlaying(true)}
                onPause={() => setIsPlaying(false)}
              />

              {/* Video controls overlay */}
              <div
                className={cn(
                  'absolute inset-0 flex items-center justify-center',
                  'transition-opacity duration-300',
                  isPlaying && !showControls ? 'opacity-0' : 'opacity-100'
                )}
              >
                <button
                  onClick={togglePlayPause}
                  className={cn(
                    'w-20 h-20 rounded-full',
                    'bg-black/50 backdrop-blur-md',
                    'flex items-center justify-center',
                    'border border-white/20',
                    'transition-all duration-300',
                    'hover:scale-110 hover:bg-primary hover:border-primary'
                  )}
                >
                  {isPlaying ? (
                    <Pause className="w-10 h-10 text-white" />
                  ) : (
                    <Play className="w-10 h-10 text-white ml-1" />
                  )}
                </button>
              </div>

              {/* Volume control */}
              <button
                onClick={toggleMute}
                className={cn(
                  'absolute bottom-4 right-4',
                  'w-10 h-10 rounded-full',
                  'bg-black/50 backdrop-blur-md border border-white/20',
                  'flex items-center justify-center',
                  'text-white/70 hover:text-white',
                  'transition-all duration-300',
                  showControls ? 'opacity-100' : 'opacity-0'
                )}
              >
                {isMuted ? (
                  <VolumeX className="w-5 h-5" />
                ) : (
                  <Volume2 className="w-5 h-5" />
                )}
              </button>
            </div>
          ) : (
            <div className="relative">
              {/* Loading state */}
              {!imageLoaded && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-12 h-12 rounded-full border-2 border-white/20 border-t-primary animate-spin" />
                </div>
              )}
              <img
                src={currentItem?.url}
                alt={currentItem?.name}
                className={cn(
                  'max-w-full max-h-[calc(100vh-12rem)] rounded-lg shadow-2xl',
                  'transition-opacity duration-500',
                  imageLoaded ? 'opacity-100' : 'opacity-0'
                )}
                onLoad={() => setImageLoaded(true)}
              />
            </div>
          )}
        </div>
      </div>

      {/* Filmstrip */}
      <div
        className={cn(
          'absolute bottom-0 left-0 right-0 z-10',
          'bg-gradient-to-t from-black via-black/90 to-transparent',
          'pt-8 pb-4 px-4',
          'transition-opacity duration-300',
          showControls ? 'opacity-100' : 'opacity-0'
        )}
      >
        <div
          ref={filmstripRef}
          className="flex gap-2 overflow-x-auto scrollbar-hide py-2 px-[calc(50%-48px)]"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          {media.map((item, index) => (
            <button
              key={item.name}
              onClick={() => {
                setImageLoaded(false)
                onNavigate(index)
              }}
              className={cn(
                'flex-shrink-0 w-20 h-14 rounded-md overflow-hidden',
                'transition-all duration-300',
                'border-2',
                index === selectedIndex
                  ? 'border-primary scale-110 shadow-lg shadow-primary/30'
                  : 'border-transparent opacity-50 hover:opacity-80 hover:border-white/30'
              )}
            >
              {item.isVideo ? (
                <div className="relative w-full h-full bg-secondary/50">
                  <video
                    src={item.url}
                    className="w-full h-full object-cover"
                    muted
                    preload="metadata"
                  />
                  <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                    <Play className="w-4 h-4 text-white" />
                  </div>
                </div>
              ) : (
                <img
                  src={item.url}
                  alt={item.name}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
              )}
            </button>
          ))}
        </div>

        {/* Gradient fades for filmstrip edges */}
        <div className="absolute left-0 top-8 bottom-4 w-20 bg-gradient-to-r from-black to-transparent pointer-events-none" />
        <div className="absolute right-0 top-8 bottom-4 w-20 bg-gradient-to-l from-black to-transparent pointer-events-none" />
      </div>
    </div>
  )
}
