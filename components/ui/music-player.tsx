'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { Play, Pause, SkipForward, SkipBack, Volume2, VolumeX, Music } from 'lucide-react';

export function MusicPlayer() {
  const { data: session } = useSession();
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const [files, setFiles] = useState<string[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.5);
  const [isMuted, setIsMuted] = useState(false);
  const [isMinimized, setIsMinimized] = useState(true);
  const [isLoaded, setIsLoaded] = useState(false);

  const isUser = session?.user?.role === 'USER';

  // Fetch music list (only for USER role)
  useEffect(() => {
    if (!isUser) return;
    fetch('/api/music')
      .then(res => res.json())
      .then(data => {
        if (data.files?.length > 0) {
          setFiles(data.files);
          setIsLoaded(true);
        }
      })
      .catch(() => {});
  }, [isUser]);

  const currentFile = files[currentIndex];

  const playTrack = useCallback((index: number) => {
    if (!audioRef.current || files.length === 0) return;
    const newIndex = ((index % files.length) + files.length) % files.length;
    setCurrentIndex(newIndex);
    audioRef.current.src = `/api/music/${encodeURIComponent(files[newIndex])}`;
    audioRef.current.load();
    audioRef.current.play().then(() => setIsPlaying(true)).catch(() => {});
  }, [files]);

  const togglePlay = useCallback(() => {
    if (!audioRef.current) return;
    if (files.length === 0) return;

    if (!audioRef.current.src || audioRef.current.src === window.location.href) {
      playTrack(0);
      return;
    }

    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play().then(() => setIsPlaying(true)).catch(() => {});
    }
  }, [isPlaying, files, playTrack]);

  const nextTrack = useCallback(() => {
    playTrack(currentIndex + 1);
  }, [currentIndex, playTrack]);

  const prevTrack = useCallback(() => {
    playTrack(currentIndex - 1);
  }, [currentIndex, playTrack]);

  const handleTimeUpdate = useCallback(() => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
    }
  }, []);

  const handleLoadedMetadata = useCallback(() => {
    if (audioRef.current) {
      setDuration(audioRef.current.duration);
    }
  }, []);

  const handleEnded = useCallback(() => {
    playTrack(currentIndex + 1);
  }, [currentIndex, playTrack]);

  const handleSeek = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value);
    if (audioRef.current) {
      audioRef.current.currentTime = time;
      setCurrentTime(time);
    }
  }, []);

  const handleVolumeChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const vol = parseFloat(e.target.value);
    setVolume(vol);
    if (audioRef.current) {
      audioRef.current.volume = vol;
    }
    setIsMuted(vol === 0);
  }, []);

  const toggleMute = useCallback(() => {
    if (audioRef.current) {
      if (isMuted) {
        audioRef.current.volume = volume || 0.5;
        setIsMuted(false);
      } else {
        audioRef.current.volume = 0;
        setIsMuted(true);
      }
    }
  }, [isMuted, volume]);

  const formatTime = (seconds: number) => {
    if (!seconds || !isFinite(seconds)) return '0:00';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const getDisplayName = (filename: string) => {
    return filename.replace(/\.[^/.]+$/, '');
  };

  // Don't render if not USER role or no music files
  if (!isUser || !isLoaded || files.length === 0) {
    return null;
  }

  return (
    <>
      <audio
        ref={audioRef}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={handleEnded}
        preload="metadata"
      />

      {/* Minimized: small floating button */}
      {isMinimized ? (
        <button
          dir="ltr"
          onClick={() => setIsMinimized(false)}
          className={`fixed bottom-4 left-4 z-50 flex items-center gap-2 rounded-full px-4 py-2.5 shadow-lg transition-all hover:scale-105 ${
            isPlaying
              ? 'bg-blue-600 text-white animate-pulse'
              : 'bg-white text-gray-700 border border-gray-200'
          }`}
        >
          <Music size={18} />
          {isPlaying && (
            <span className="text-xs font-medium max-w-[120px] truncate">
              {getDisplayName(currentFile)}
            </span>
          )}
        </button>
      ) : (
        /* Expanded Player Bar */
        <div dir="ltr" className="fixed bottom-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-sm border-t border-gray-200 shadow-2xl lg:ml-60">
          <div className="max-w-screen-xl mx-auto px-4 py-2">
            {/* Progress bar */}
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[10px] text-gray-400 font-mono w-8 text-center">
                {formatTime(currentTime)}
              </span>
              <input
                type="range"
                min={0}
                max={duration || 0}
                value={currentTime}
                onChange={handleSeek}
                className="flex-1 h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600
                  [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-blue-600"
              />
              <span className="text-[10px] text-gray-400 font-mono w-8 text-center">
                {formatTime(duration)}
              </span>
            </div>

            {/* Controls */}
            <div className="flex items-center justify-between">
              {/* Track info */}
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <div className="flex-shrink-0 w-8 h-8 rounded bg-blue-100 flex items-center justify-center">
                  <Music size={16} className="text-blue-600" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-800 truncate max-w-[200px]">
                    {currentFile ? getDisplayName(currentFile) : 'انتخاب نشده'}
                  </p>
                  <p className="text-[10px] text-gray-400">
                    {currentIndex + 1} از {files.length}
                  </p>
                </div>
              </div>

              {/* Play controls */}
              <div className="flex items-center gap-1">
                <button
                  onClick={prevTrack}
                  className="p-2 rounded-full text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-colors"
                >
                  <SkipBack size={18} />
                </button>
                <button
                  onClick={togglePlay}
                  className="p-2.5 rounded-full bg-blue-600 text-white hover:bg-blue-700 transition-colors shadow-md"
                >
                  {isPlaying ? <Pause size={20} /> : <Play size={20} className="ml-0.5" />}
                </button>
                <button
                  onClick={nextTrack}
                  className="p-2 rounded-full text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-colors"
                >
                  <SkipForward size={18} />
                </button>
              </div>

              {/* Volume + minimize */}
              <div className="flex items-center gap-2 flex-1 justify-end">
                <div className="hidden sm:flex items-center gap-1">
                  <button onClick={toggleMute} className="p-1 text-gray-400 hover:text-gray-600">
                    {isMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
                  </button>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.05}
                    value={isMuted ? 0 : volume}
                    onChange={handleVolumeChange}
                    className="w-16 h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600
                      [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-2.5 [&::-webkit-slider-thumb]:h-2.5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-blue-600"
                  />
                </div>
                <button
                  onClick={() => setIsMinimized(true)}
                  className="p-1.5 rounded text-gray-400 hover:bg-gray-100 hover:text-gray-600 text-xs"
                  title="کوچک کردن"
                >
                  ✕
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
