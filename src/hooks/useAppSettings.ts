import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  getAppSettings,
  type AppSettings,
  type LyricsLanguage,
} from '../services/appSettings';
import { buildLanguageMatrixContext, getWheelLanguages } from '../services/languageMatrix';
import { applyColorTheme } from '../utils/applyColorTheme';

export function useAppSettings() {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [appSettings, setAppSettings] = useState<AppSettings>(() => getAppSettings());

  const lyricsLanguage = appSettings.lyricsLanguage;

  const wheelLanguages = useMemo(
    () => getWheelLanguages(appSettings.learningTargetLanguages),
    [appSettings.learningTargetLanguages],
  );

  const languageMatrixContext = useMemo(
    () => buildLanguageMatrixContext(appSettings),
    [appSettings],
  );

  useEffect(() => {
    const settings = getAppSettings();
    setAppSettings(settings);
    applyColorTheme(settings.colorTheme);
  }, []);

  const handleSettingsChange = useCallback((next: AppSettings) => {
    setAppSettings(next);
    applyColorTheme(next.colorTheme);
  }, []);

  const setLyricsLanguage = useCallback(
    (lang: LyricsLanguage) => {
      handleSettingsChange({ ...appSettings, lyricsLanguage: lang });
    },
    [appSettings, handleSettingsChange],
  );

  return {
    appSettings,
    setAppSettings,
    settingsOpen,
    setSettingsOpen,
    lyricsLanguage,
    wheelLanguages,
    languageMatrixContext,
    handleSettingsChange,
    setLyricsLanguage,
  };
}

export type UseAppSettingsReturn = ReturnType<typeof useAppSettings>;
