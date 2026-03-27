import { useEffect, useMemo, useState } from "react";

const BASE_DELAY_MS = 900;

export interface PlaybackController {
  readonly currentStep: number;
  readonly totalSteps: number;
  readonly isPlaying: boolean;
  readonly speed: number;
  readonly setCurrentStep: (step: number) => void;
  readonly setIsPlaying: (playing: boolean) => void;
  readonly setSpeed: (speed: number) => void;
  readonly next: () => void;
  readonly previous: () => void;
  readonly restart: () => void;
}

export function usePlayback(totalSteps: number): PlaybackController {
  const [currentStep, setCurrentStepRaw] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);

  useEffect(() => {
    setCurrentStepRaw(0);
    setIsPlaying(false);
  }, [totalSteps]);

  useEffect(() => {
    if (!isPlaying || totalSteps <= 1) {
      return;
    }
    if (currentStep >= totalSteps - 1) {
      setIsPlaying(false);
      return;
    }

    const delay = Math.max(80, Math.round(BASE_DELAY_MS / Math.max(speed, 0.1)));
    const timer = window.setTimeout(() => {
      setCurrentStepRaw((prev) => Math.min(prev + 1, totalSteps - 1));
    }, delay);

    return () => {
      window.clearTimeout(timer);
    };
  }, [currentStep, isPlaying, speed, totalSteps]);

  const setCurrentStep = (step: number): void => {
    if (totalSteps <= 0) {
      setCurrentStepRaw(0);
      return;
    }
    setCurrentStepRaw(Math.max(0, Math.min(step, totalSteps - 1)));
  };

  const next = (): void => {
    setCurrentStepRaw((prev) => Math.min(prev + 1, Math.max(0, totalSteps - 1)));
  };

  const previous = (): void => {
    setCurrentStepRaw((prev) => Math.max(0, prev - 1));
  };

  const restart = (): void => {
    setCurrentStepRaw(0);
    setIsPlaying(false);
  };

  return useMemo(
    () => ({
      currentStep,
      totalSteps,
      isPlaying,
      speed,
      setCurrentStep,
      setIsPlaying,
      setSpeed,
      next,
      previous,
      restart
    }),
    [currentStep, totalSteps, isPlaying, speed]
  );
}
