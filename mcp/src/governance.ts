import { createHash } from "node:crypto";
import type { ExternalActionsMode, RuntimeControl, RuntimeMode } from "./domain.js";

export function getRuntimeControl(): RuntimeControl {
  if (process.env.MUSIC_OS_RUNTIME_MODE && !["PAUSED", "SUPERVISED", "ACTIVE"].includes(process.env.MUSIC_OS_RUNTIME_MODE)) throw new Error("Invalid runtime mode.");
  if (process.env.MUSIC_OS_EXTERNAL_ACTIONS && !["BLOCKED", "APPROVAL_ONLY", "ALLOWED"].includes(process.env.MUSIC_OS_EXTERNAL_ACTIONS)) throw new Error("Invalid external action policy.");
  return {
    mode: (process.env.MUSIC_OS_RUNTIME_MODE ?? "SUPERVISED") as RuntimeMode,
    externalActions: (process.env.MUSIC_OS_EXTERNAL_ACTIONS ?? "APPROVAL_ONLY") as ExternalActionsMode,
  };
}

export function assertInternalWriteAllowed(): void {
  if (getRuntimeControl().mode === "PAUSED") {
    throw new Error("Music OS runtime is PAUSED. Writes are disabled.");
  }
}

export function assertExternalActionMayBeStaged(): void {
  const control = getRuntimeControl();
  if (control.mode === "PAUSED" || control.externalActions === "BLOCKED") {
    throw new Error("External actions are blocked by runtime control.");
  }
}

export function actionFingerprint(parts: Record<string, unknown>): string {
  const canonical = JSON.stringify(
    Object.keys(parts).sort().reduce<Record<string, unknown>>((acc, key) => {
      acc[key] = parts[key];
      return acc;
    }, {}),
  );
  return createHash("sha256").update(canonical).digest("hex");
}
