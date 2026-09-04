"use client";

/**
 * Mobile PWA Haptic Feedback Utility
 * Trigger subtle vibrations for touch interactions when available on device.
 */
export function triggerHaptic(type: "light" | "medium" | "heavy" | "success" | "warning" = "light") {
  if (typeof window === "undefined" || !("navigator" in window) || !navigator.vibrate) {
    return;
  }

  try {
    switch (type) {
      case "light":
        navigator.vibrate(12);
        break;
      case "medium":
        navigator.vibrate(25);
        break;
      case "heavy":
        navigator.vibrate(45);
        break;
      case "success":
        navigator.vibrate([15, 50, 25]);
        break;
      case "warning":
        navigator.vibrate([40, 60, 40]);
        break;
      default:
        navigator.vibrate(15);
    }
  } catch {
    // Ignore if user has disabled vibration or browser blocks it
  }
}
