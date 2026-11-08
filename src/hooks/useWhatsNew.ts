import { useEffect } from 'react';
import { APP_VERSION } from '../lib/version';
import { shouldShowWhatsNew, WHATS_NEW } from '../lib/whatsNew';
import { useSettings } from '../store/settings';
import { useUi } from '../store/ui';

/** Один раз после обновления показывает окно «Что нового». Свежей установке не показывает. */
export function useWhatsNew() {
  useEffect(() => {
    const { lastSeenVersion, onboardingDone, update } = useSettings.getState();
    if (lastSeenVersion === APP_VERSION) return;
    if (!shouldShowWhatsNew(lastSeenVersion, APP_VERSION, onboardingDone)) {
      update({ lastSeenVersion: APP_VERSION });
      return;
    }
    // Небольшая пауза: окно не должно появляться поверх заставки и первой отрисовки
    const timer = window.setTimeout(() => {
      useSettings.getState().update({ lastSeenVersion: APP_VERSION });
      useUi.getState().openModal({ kind: 'whats-new', version: WHATS_NEW.version, items: WHATS_NEW.items });
    }, 1200);
    return () => window.clearTimeout(timer);
  }, []);
}
