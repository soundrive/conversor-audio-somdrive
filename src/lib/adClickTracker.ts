import React from "react";
import { Ad } from "../types";
import { trackEvent } from "./gtag";

// In-memory timestamps map to prevent technical double-clicks within 1 second for LGPD compliance & protection
const lastClickTimestamps = new Map<string, number>();

export function handleAdClick(
  ad: Ad,
  position?: string,
  event?: React.SyntheticEvent,
  isAdminPreview: boolean = false
): void {
  if (event) {
    event.stopPropagation();
  }

  const destinationUrl = ad.destinationUrl || "";
  const pos = position || ad.position || "unknown";

  // Ignore preview/demo ads or admin preview mode from click tracking
  if (isAdminPreview || !ad.id || ad.id === "preview" || ad.id === "demo") {
    if (destinationUrl && destinationUrl !== "#") {
      window.open(destinationUrl, "_blank", "noopener,noreferrer");
    }
    return;
  }

  // De-bounce lock: prevent duplicate click recordings within 1000ms (1 second)
  const now = Date.now();
  const lastTime = lastClickTimestamps.get(ad.id) || 0;
  const isDuplicateInstantClick = now - lastTime < 1000;
  
  if (!isDuplicateInstantClick) {
    lastClickTimestamps.set(ad.id, now);

    // Track real click to server via navigator.sendBeacon with fallback to fetch keepalive
    const payload = {
      adId: ad.id,
      position: pos,
      destinationUrl
    };

    let beaconSent = false;
    if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
      try {
        const blob = new Blob([JSON.stringify(payload)], { type: "application/json" });
        beaconSent = navigator.sendBeacon("/api/ads-track-click", blob);
      } catch (err) {
        beaconSent = false;
      }
    }

    if (!beaconSent && typeof fetch !== "undefined") {
      fetch("/api/ads-track-click", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        keepalive: true
      }).catch((err) => {
        console.warn("[ADS TRACK] Fetch fallback failed:", err);
      });
    }

    // GA4 Analytics event
    trackEvent("ad_click", {
      ad_id: ad.id,
      ad_position: pos,
      destination_url: destinationUrl
    });
  }

  // Open destination link safely without blocking user navigation
  if (destinationUrl && destinationUrl !== "#") {
    // If event originated from an <a> tag, default browser navigation handles opening link.
    // If triggered from card div / button / image click handler, navigate via window.open.
    if (event) {
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === "A" || target.closest("a"))) {
        return;
      }
    }
    window.open(destinationUrl, "_blank", "noopener,noreferrer");
  }
}
