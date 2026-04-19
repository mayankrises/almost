"use client";

import { useState, useRef, useCallback } from "react";

export type GazePoint = { x: number; y: number };

export type CalibrationBox = {
  left: number;
  right: number;
  top: number;
  bottom: number;
};

const STEPS = ["CENTER", "LEFT", "RIGHT", "TOP", "BOTTOM"] as const;
export type CalibrationStep = (typeof STEPS)[number];

export function useGazeCalibration(gazeRef: React.RefObject<GazePoint | null>) {
  const [stepIndex, setStepIndex] = useState(0);
  const [isCalibrating, setIsCalibrating] = useState(false);
  const [isCalibrated, setIsCalibrated] = useState(false);
  const [calibrationBox, setCalibrationBox] = useState<CalibrationBox | null>(null);

  const samplesRef = useRef<GazePoint[][]>([]);

  // 🔁 Collect samples for one step using requestAnimationFrame
  const collectSamples = useCallback(async () => {
    return new Promise<GazePoint[]>((resolve) => {
      const samples: GazePoint[] = [];
      const start = Date.now();
      const DURATION = 1200; // ms per step

      const loop = () => {
        const gaze = gazeRef.current;
        if (gaze) {
          samples.push({ ...gaze });
        }

        if (Date.now() - start < DURATION) {
          requestAnimationFrame(loop);
        } else {
          resolve(samples);
        }
      };

      loop();
    });
  }, [gazeRef]);

  // 📊 Average samples for a point
  const average = (points: GazePoint[]): GazePoint => {
    if (points.length === 0) return { x: 0, y: 0 };
    const x = points.reduce((s, p) => s + p.x, 0) / points.length;
    const y = points.reduce((s, p) => s + p.y, 0) / points.length;
    return { x, y };
  };

  // 🎯 Run full calibration sequence
  const startCalibration = useCallback(async () => {
    setIsCalibrating(true);
    setIsCalibrated(false);
    samplesRef.current = [];

    for (let i = 0; i < STEPS.length; i++) {
        setStepIndex(i);
        // Visual prep time
        await new Promise((r) => setTimeout(r, 800));
        
        const stepSamples = await collectSamples();
        samplesRef.current.push(stepSamples);
    }

    // Process all steps
    const averaged = samplesRef.current.map(average);
    
    // We expect order: CENTER, LEFT, RIGHT, TOP, BOTTOM
    // Normalize based on these observations
    const xs = averaged.map(p => p.x);
    const ys = averaged.map(p => p.y);

    const paddingX = 0.12; 
    const paddingY = 0.08;

    const box: CalibrationBox = {
      left: Math.min(...xs) - paddingX,
      right: Math.max(...xs) + paddingX,
      top: Math.min(...ys) - paddingY,
      bottom: Math.max(...ys) + paddingY,
    };

    setCalibrationBox(box);
    setIsCalibrated(true);
    setIsCalibrating(false);
    setStepIndex(0);
    
    console.log("[Calibration] ✅ Box established:", box);
  }, [collectSamples]);

  return {
    step: STEPS[stepIndex],
    stepIndex,
    totalSteps: STEPS.length,
    isCalibrating,
    isCalibrated,
    calibrationBox,
    startCalibration,
  };
}
