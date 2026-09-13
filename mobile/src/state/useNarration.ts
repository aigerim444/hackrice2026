import { useAudioPlayer, useAudioPlayerStatus, setAudioModeAsync } from 'expo-audio';
import * as Speech from 'expo-speech';
import { useCallback, useEffect, useRef, useState } from 'react';

import { hasElevenLabs, speak } from '../data/elevenlabs/speech';
import { devWarn, hasGemini } from '../data/gemini/geminiClient';
import { fallbackScript, wrappedScript } from '../data/gemini/wrappedScript';
import type { WrappedStats } from '../domain/wrapped';

/**
 * Narration for Semester Wrapped.
 *
 * Three tiers, each a step down rather than an error:
 *
 *   1. Gemini writes the lines, ElevenLabs speaks them.
 *   2. No Gemini → the written fallback script, still spoken by ElevenLabs.
 *   3. No ElevenLabs → `expo-speech`, the device's own voice. Free, offline,
 *      and honestly fine.
 *   4. Nothing at all → silent cards, exactly as Wrapped was before.
 *
 * The screen doesn't need to know which tier it got. It asks to play card N and
 * finds out whether audio is happening from `speaking`.
 *
 * Lines are generated once for the whole deck rather than per card, because the
 * model writes a better card 7 when it has just written cards 1 through 6 — and
 * because seven small requests is seven chances for the network to spoil a demo.
 */

export type NarrationSource = 'elevenlabs' | 'device' | 'none';

export interface Narration {
  /** Play the line for this card. No-op when there's nothing to say. */
  playCard: (index: number) => void;
  stop: () => void;
  /** True while audio is actually coming out. */
  speaking: boolean;
  /** True while the script and first clips are being prepared. */
  preparing: boolean;
  /** Which tier ended up running, so the UI can be honest about it. */
  source: NarrationSource;
  /** Whether the user has narration switched on at all. */
  enabled: boolean;
  toggle: () => void;
}

export function useNarration(stats: WrappedStats | null): Narration {
  const [enabled, setEnabled] = useState(false);
  const [lines, setLines] = useState<string[] | null>(null);
  const [preparing, setPreparing] = useState(false);
  const [source, setSource] = useState<NarrationSource>('none');
  const [deviceSpeaking, setDeviceSpeaking] = useState(false);

  const player = useAudioPlayer();
  const status = useAudioPlayerStatus(player);

  /** Card index → local mp3 URI. Populated lazily, kept for the session. */
  const clips = useRef<Map<number, string>>(new Map());
  /** Guards against a card change landing after its clip finally resolves. */
  const wanted = useRef<number | null>(null);

  // Play through the earpiece-bypassing route and keep going in silent mode —
  // a muted phone is the normal state of a phone, and a silent Wrapped would
  // just look broken.
  useEffect(() => {
    void setAudioModeAsync({ playsInSilentMode: true }).catch(() => {
      /* Not fatal: audio may simply be quieter than intended. */
    });
  }, []);

  /**
   * Write the script once, the first time narration is switched on.
   *
   * Deliberately not on mount: generating costs a Gemini call and ElevenLabs
   * characters, and most people opening Wrapped never turn the sound on.
   */
  useEffect(() => {
    if (!enabled || !stats || lines) return;
    let cancelled = false;
    setPreparing(true);

    (async () => {
      let script: string[];
      try {
        script = hasGemini() ? await wrappedScript(stats) : fallbackScript(stats);
      } catch (error) {
        devWarn('[wrapped] Gemini script failed, using the written one:', error);
        script = fallbackScript(stats);
      }
      if (cancelled) return;

      setLines(script);
      setSource(hasElevenLabs() ? 'elevenlabs' : 'device');
      setPreparing(false);

      // Warm the first two clips so card 1 starts promptly and card 2 is ready
      // by the time anyone taps through to it.
      if (hasElevenLabs()) {
        for (const index of [0, 1]) {
          try {
            const uri = await speak(script[index]);
            if (cancelled) return;
            clips.current.set(index, uri);
          } catch (error) {
            devWarn('[wrapped] prefetch failed, will fall back per card:', error);
            break;
          }
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [enabled, stats, lines]);

  const stop = useCallback(() => {
    wanted.current = null;
    try {
      player.pause();
    } catch {
      /* Player may already be torn down. */
    }
    void Speech.stop().catch(() => {});
    setDeviceSpeaking(false);
  }, [player]);

  /** The device voice: the free tier of the free tier. */
  const speakOnDevice = useCallback((text: string) => {
    setDeviceSpeaking(true);
    Speech.speak(text, {
      rate: 0.98,
      onDone: () => setDeviceSpeaking(false),
      onStopped: () => setDeviceSpeaking(false),
      onError: () => setDeviceSpeaking(false),
    });
  }, []);

  const playCard = useCallback(
    (index: number) => {
      if (!enabled || !lines?.[index]) return;
      const text = lines[index];

      stop();
      wanted.current = index;

      if (!hasElevenLabs()) {
        speakOnDevice(text);
        return;
      }

      const cached = clips.current.get(index);
      if (cached) {
        player.replace({ uri: cached });
        player.play();
        return;
      }

      // Not warmed yet: fetch it, but only play if this card is still the one
      // on screen by the time it arrives.
      void (async () => {
        try {
          const uri = await speak(text);
          clips.current.set(index, uri);
          if (wanted.current !== index) return;
          player.replace({ uri });
          player.play();
        } catch (error) {
          devWarn('[wrapped] ElevenLabs failed for this card, using the device voice:', error);
          if (wanted.current !== index) return;
          setSource('device');
          speakOnDevice(text);
        }
      })();
    },
    [enabled, lines, player, speakOnDevice, stop],
  );

  const toggle = useCallback(() => {
    setEnabled((on) => {
      if (on) stop();
      return !on;
    });
  }, [stop]);

  // Stop the audio when the screen goes away, or it keeps talking over the app.
  useEffect(() => () => {
    void Speech.stop().catch(() => {});
  }, []);

  return {
    playCard,
    stop,
    speaking: (status.playing && !status.didJustFinish) || deviceSpeaking,
    preparing,
    source: enabled ? source : 'none',
    enabled,
    toggle,
  };
}
