import { useEffect } from 'react';
import { engine } from '../audio/engine';
import { clearResume, saveResume } from '../lib/resume';
import { trackKey } from '../lib/types';
import { usePlayer } from '../store/player';
import { useSettings } from '../store/settings';

/** Запоминает трек и позицию, чтобы после перезапуска Frost продолжить с того же места. */
export function useResumePoint() {
  useEffect(() => {
    const save = () => {
      if (!useSettings.getState().resumePlayback) return;
      const { current, loaded } = usePlayer.getState();
      // Пока трек не загружен, позиция движка нулевая: не затираем сохранённое место
      if (!current || !loaded) return;
      saveResume(trackKey(current), engine.currentTime);
    };
    const timer = window.setInterval(() => {
      if (usePlayer.getState().isPlaying) save();
    }, 5000);
    const offPlayer = usePlayer.subscribe((s, prev) => {
      if (prev.isPlaying && !s.isPlaying) save();
    });
    const offSettings = useSettings.subscribe((s, prev) => {
      if (prev.resumePlayback && !s.resumePlayback) clearResume();
    });
    window.addEventListener('pagehide', save);
    document.addEventListener('visibilitychange', save);
    return () => {
      window.clearInterval(timer);
      offPlayer();
      offSettings();
      window.removeEventListener('pagehide', save);
      document.removeEventListener('visibilitychange', save);
    };
  }, []);
}
