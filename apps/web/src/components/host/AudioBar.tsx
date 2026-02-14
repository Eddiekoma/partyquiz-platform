/**
 * AudioBar – Host-side audio control bar
 *
 * A compact sticky bar that shows the current audio target, playback status,
 * and provides controls for play/pause, volume, and switching audio target.
 *
 * Communicates with the server AudioController via WebSocket.
 */

"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import type { Socket } from "socket.io-client";
import {
  AudioWSEvent,
  AudioTargetKind,
} from "@partyquiz/shared";
import {
  Volume2,
  VolumeX,
  Play,
  Pause,
  Monitor,
  Laptop,
  Speaker,
  ChevronDown,
  Music,
  Wifi,
  WifiOff,
} from "lucide-react";

interface AudioBarProps {
  sessionCode: string;
  socket: Socket | null;
  className?: string;
}

interface AudioStatus {
  isPlaying: boolean;
  trackUri: string | null;
  trackId: string | null;
  trackName: string | null;
  artistName: string | null;
  albumArt: string | null;
  positionMs: number;
  durationMs: number;
  reason: string | null;
}

interface TargetInfo {
  kind: string;
  deviceId: string | null;
  deviceName: string | null;
  status: string;
  version: number;
}

const TARGET_LABELS: Record<string, { label: string; icon: typeof Monitor }> = {
  [AudioTargetKind.DISPLAY]: { label: "Display", icon: Monitor },
  [AudioTargetKind.HOST]: { label: "Host", icon: Laptop },
  [AudioTargetKind.CONNECT_DEVICE]: { label: "Spotify Device", icon: Speaker },
  [AudioTargetKind.NONE]: { label: "None", icon: WifiOff },
};

export function AudioBar({ sessionCode, socket, className = "" }: AudioBarProps) {
  const [target, setTarget] = useState<TargetInfo>({
    kind: AudioTargetKind.NONE,
    deviceId: null,
    deviceName: null,
    status: "idle",
    version: 0,
  });
  const [audio, setAudio] = useState<AudioStatus>({
    isPlaying: false,
    trackUri: null,
    trackId: null,
    trackName: null,
    artistName: null,
    albumArt: null,
    positionMs: 0,
    durationMs: 0,
    reason: null,
  });
  const [volume, setVolume] = useState(80);
  const [showTargetPicker, setShowTargetPicker] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);

  // Listen for server events
  useEffect(() => {
    if (!socket) return;

    const handleTargetChanged = (data: TargetInfo) => {
      setTarget(data);
      setIsConnected(data.kind !== AudioTargetKind.NONE);
    };

    const handleStatus = (data: AudioStatus) => {
      setAudio((prev) => ({ ...prev, ...data }));
    };

    const handlePlayTrack = (data: {
      trackId: string;
      trackUri?: string;
      trackName?: string;
      artistName?: string;
      albumArt?: string;
      positionMs?: number;
      durationMs?: number;
      reason?: string;
    }) => {
      setAudio({
        isPlaying: true,
        trackUri: data.trackUri ?? (data.trackId ? `spotify:track:${data.trackId}` : null),
        trackId: data.trackId,
        trackName: data.trackName ?? null,
        artistName: data.artistName ?? null,
        albumArt: data.albumArt ?? null,
        positionMs: data.positionMs ?? 0,
        durationMs: data.durationMs ?? 0,
        reason: data.reason ?? null,
      });
    };

    const handlePause = () => {
      setAudio((prev) => ({ ...prev, isPlaying: false }));
    };

    const handleError = (data: { code: string; message: string }) => {
      console.warn("[AudioBar] Error:", data.code, data.message);
    };

    socket.on(AudioWSEvent.AUDIO_TARGET_CHANGED, handleTargetChanged);
    socket.on(AudioWSEvent.AUDIO_STATUS, handleStatus);
    socket.on(AudioWSEvent.AUDIO_PLAY_TRACK, handlePlayTrack);
    socket.on(AudioWSEvent.AUDIO_PAUSE, handlePause);
    socket.on(AudioWSEvent.AUDIO_ERROR, handleError);

    // Request current state
    socket.emit(AudioWSEvent.GET_AUDIO_TARGET, { sessionCode });

    return () => {
      socket.off(AudioWSEvent.AUDIO_TARGET_CHANGED, handleTargetChanged);
      socket.off(AudioWSEvent.AUDIO_STATUS, handleStatus);
      socket.off(AudioWSEvent.AUDIO_PLAY_TRACK, handlePlayTrack);
      socket.off(AudioWSEvent.AUDIO_PAUSE, handlePause);
      socket.off(AudioWSEvent.AUDIO_ERROR, handleError);
    };
  }, [socket, sessionCode]);

  // Close picker when clicking outside
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setShowTargetPicker(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // Send commands
  const sendCommand = useCallback(
    (action: string, extra?: Record<string, unknown>) => {
      if (!socket) return;
      socket.emit(AudioWSEvent.AUDIO_COMMAND, {
        sessionCode,
        action,
        ...extra,
      });
    },
    [socket, sessionCode]
  );

  /**
   * Strakke play/pause state machine:
   * 1. isPlaying          → pause
   * 2. !playing + trackUri → resume (Spotify hervat op zelfde plek)
   * 3. !playing + !trackUri → restartLast (herstart laatst gespeelde track)
   * 4. niks               → knop is disabled (zie render)
   */
  const togglePlay = useCallback(() => {
    if (audio.isPlaying) {
      sendCommand("pause");
    } else if (audio.trackUri) {
      // We have a known track URI → resume it
      sendCommand("resume", { reason: "AUDIOBAR" });
    } else {
      // No current track → try to restart the last played track
      sendCommand("restartLast", { reason: "AUDIOBAR" });
    }
  }, [audio.isPlaying, audio.trackUri, sendCommand]);

  const changeVolume = useCallback(
    (newVol: number) => {
      setVolume(newVol);
      // Server expects volume as 0..1, slider is 0..100
      sendCommand("volume", { volume: newVol / 100 });
    },
    [sendCommand]
  );

  const setAudioTarget = useCallback(
    (kind: string) => {
      if (!socket) return;
      socket.emit(AudioWSEvent.SET_AUDIO_TARGET, {
        sessionCode,
        kind,
        force: true,
      });
      setShowTargetPicker(false);
    },
    [socket, sessionCode]
  );

  const targetInfo = TARGET_LABELS[target.kind] || TARGET_LABELS[AudioTargetKind.NONE];
  const TargetIcon = targetInfo.icon;

  // Don't show bar if no session
  if (!socket) return null;

  return (
    <div
      className={`flex items-center gap-3 rounded-lg border border-white/10 bg-gray-900/90 
        backdrop-blur-sm px-3 py-2 text-sm text-white shadow-lg ${className}`}
    >
      {/* Spotify icon + connection status */}
      <div className="flex items-center gap-1.5">
        <Music className="h-4 w-4 text-green-400" />
        {isConnected ? (
          <Wifi className="h-3 w-3 text-green-400" />
        ) : (
          <WifiOff className="h-3 w-3 text-gray-500" />
        )}
      </div>

      {/* Track info (compact) */}
      {audio.trackName && (
        <div className="flex items-center gap-2 min-w-0 max-w-[200px]">
          {audio.albumArt && (
            <img
              src={audio.albumArt}
              alt=""
              className="h-7 w-7 rounded-sm flex-shrink-0"
            />
          )}
          <div className="min-w-0 truncate">
            <span className="text-xs font-medium truncate block">
              {audio.trackName}
            </span>
            {audio.artistName && (
              <span className="text-[10px] text-gray-400 truncate block">
                {audio.artistName}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Play / Pause */}
      <button
        onClick={togglePlay}
        disabled={!isConnected}
        className="flex items-center justify-center h-7 w-7 rounded-full 
          bg-white/10 hover:bg-white/20 disabled:opacity-30 disabled:cursor-not-allowed
          transition-colors"
        title={audio.isPlaying ? "Pause" : "Play"}
      >
        {audio.isPlaying ? (
          <Pause className="h-3.5 w-3.5" />
        ) : (
          <Play className="h-3.5 w-3.5 ml-0.5" />
        )}
      </button>

      {/* Volume */}
      <div className="flex items-center gap-1">
        <button
          onClick={() => changeVolume(volume > 0 ? 0 : 80)}
          className="text-gray-400 hover:text-white transition-colors"
          title={volume > 0 ? "Mute" : "Unmute"}
        >
          {volume > 0 ? (
            <Volume2 className="h-3.5 w-3.5" />
          ) : (
            <VolumeX className="h-3.5 w-3.5" />
          )}
        </button>
        <input
          type="range"
          min={0}
          max={100}
          value={volume}
          onChange={(e) => changeVolume(Number(e.target.value))}
          className="w-16 h-1 accent-green-400 cursor-pointer"
          title={`Volume: ${volume}%`}
        />
      </div>

      {/* Audio target picker */}
      <div className="relative" ref={pickerRef}>
        <button
          onClick={() => setShowTargetPicker(!showTargetPicker)}
          className="flex items-center gap-1 px-2 py-1 rounded bg-white/10 
            hover:bg-white/20 transition-colors text-xs"
          title={`Audio playing on: ${targetInfo.label}`}
        >
          <TargetIcon className="h-3 w-3" />
          <span className="hidden sm:inline">{targetInfo.label}</span>
          <ChevronDown className="h-3 w-3" />
        </button>

        {showTargetPicker && (
          <div
            className="absolute bottom-full right-0 mb-1 w-44 rounded-lg 
              border border-white/10 bg-gray-800 shadow-xl py-1 z-50"
          >
            <div className="px-3 py-1.5 text-[10px] uppercase text-gray-500 font-semibold">
              Play audio on
            </div>
            {[
              AudioTargetKind.DISPLAY,
              AudioTargetKind.HOST,
              AudioTargetKind.NONE,
            ].map((k) => {
              const info = TARGET_LABELS[k];
              const Icon = info.icon;
              const isActive = target.kind === k;
              return (
                <button
                  key={k}
                  onClick={() => setAudioTarget(k)}
                  className={`flex items-center gap-2 w-full px-3 py-1.5 text-left text-xs
                    hover:bg-white/10 transition-colors
                    ${isActive ? "text-green-400" : "text-gray-300"}`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  <span>{info.label}</span>
                  {isActive && (
                    <span className="ml-auto text-[10px] text-green-400">●</span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default AudioBar;
