/**
 * Google Analytics 4 (GA4) Integration Utilities
 */

declare global {
  interface Window {
    dataLayer: any[];
    gtag: (...args: any[]) => void;
  }
}

export const GA_MEASUREMENT_ID = (import.meta as any).env.VITE_GA_MEASUREMENT_ID || "";

/**
 * Dynamically loads the GA4 script tag and initializes gtag.
 * Configures default consent settings and disables automatic page view tracking.
 */
export function initGA() {
  if (!GA_MEASUREMENT_ID) {
    console.log("[GA4] VITE_GA_MEASUREMENT_ID not configured. GA4 tracking is disabled.");
    return;
  }

  // Avoid double injection
  if (window.gtag) {
    return;
  }

  try {
    // 1. Create the Google Tag Manager script element
    const script = document.createElement("script");
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`;
    document.head.appendChild(script);

    // 2. Setup standard window properties
    window.dataLayer = window.dataLayer || [];
    window.gtag = function () {
      window.dataLayer.push(arguments);
    };

    // 3. Set up default consent settings (denied by default, unless already stored as granted)
    const savedConsent = localStorage.getItem("somdrive_ga_consent");
    const defaultConsent = savedConsent === "granted" ? "granted" : "denied";

    window.gtag("consent", "default", {
      analytics_storage: defaultConsent,
      ad_storage: defaultConsent,
      ad_user_data: defaultConsent,
      ad_personalization: defaultConsent,
    });

    // 4. Initialize gtag configuration
    window.gtag("js", new Date());

    // Disable automatic page view tracking (we do this manually to support SPA routing properly)
    window.gtag("config", GA_MEASUREMENT_ID, {
      send_page_view: false,
    });

    console.log(`[GA4] Successfully initialized GA4 with measurement ID: ${GA_MEASUREMENT_ID} (Consent default: ${defaultConsent})`);
  } catch (err) {
    console.error("[GA4] Failed to initialize Google Analytics:", err);
  }
}

/**
 * Updates the user's consent choice and saves it to localStorage.
 */
export function updateGAConsent(status: "granted" | "denied") {
  localStorage.setItem("somdrive_ga_consent", status);
  if (window.gtag) {
    try {
      window.gtag("consent", "update", {
        analytics_storage: status,
        ad_storage: status,
        ad_user_data: status,
        ad_personalization: status,
      });
      console.log(`[GA4] Consent state updated to: ${status}`);
    } catch (err) {
      console.error("[GA4] Failed to update GA4 consent state:", err);
    }
  }
}

/**
 * Manually registers a page view in Google Analytics.
 */
export function trackPageView(title: string, path: string) {
  if (!GA_MEASUREMENT_ID || !window.gtag) {
    return;
  }

  try {
    window.gtag("event", "page_view", {
      page_title: title,
      page_location: `${window.location.origin}${path}`,
      page_path: path,
    });
    console.log(`[GA4] Tracked Page View: ${path} (${title})`);
  } catch (err) {
    console.error("[GA4] Error tracking page view:", err);
  }
}

/**
 * Sends a custom GA4 event, cleansing any potentially sensitive input arguments.
 */
export function trackEvent(eventName: string, params: Record<string, any> = {}) {
  if (!GA_MEASUREMENT_ID || !window.gtag) {
    return;
  }

  try {
    // Scrub potential personally identifiable info (PII) before sending
    const cleanParams: Record<string, any> = {};
    const sensitiveKeywords = [
      "name", "email", "file", "filename", "fileName", "file_name", 
      "content", "audio", "pdf", "ip", "token", "uid", "user", 
      "username", "password", "key", "secret", "auth"
    ];

    for (const [key, value] of Object.entries(params)) {
      const isSensitive = sensitiveKeywords.some((keyword) =>
        key.toLowerCase().includes(keyword)
      );

      if (!isSensitive) {
        cleanParams[key] = value;
      }
    }

    window.gtag("event", eventName, cleanParams);
    console.log(`[GA4] Tracked Event "${eventName}":`, cleanParams);
  } catch (err) {
    console.error(`[GA4] Error tracking event "${eventName}":`, err);
  }
}
