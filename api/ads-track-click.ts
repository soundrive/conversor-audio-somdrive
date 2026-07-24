import fs from "fs";
import path from "path";
import { initializeApp, getApps } from "firebase/app";
import { getFirestore, doc, updateDoc, setDoc, increment } from "firebase/firestore/lite";

// Load Firebase configuration safely
let firebaseConfig: any = null;
try {
  const configPath = path.join(process.cwd(), "firebase-applet-config.json");
  if (fs.existsSync(configPath)) {
    firebaseConfig = JSON.parse(fs.readFileSync(configPath, "utf8"));
  }
} catch (err) {
  console.error("[ADS_TRACK_CLICK] Failed to read firebase-applet-config.json:", err);
}

// Initialize Firebase App if not already initialized
function getDb() {
  if (!firebaseConfig || !firebaseConfig.apiKey) {
    throw new Error("Firebase configuration unavailable");
  }

  const app = getApps().length === 0 ? initializeApp({
    apiKey: firebaseConfig.apiKey,
    authDomain: firebaseConfig.authDomain,
    projectId: firebaseConfig.projectId,
    storageBucket: firebaseConfig.storageBucket,
    messagingSenderId: firebaseConfig.messagingSenderId,
    appId: firebaseConfig.appId
  }) : getApps()[0];

  return getFirestore(app, firebaseConfig.firestoreDatabaseId || "(default)");
}

export default async function handler(req: any, res: any) {
  // 1. Method check
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    if (res.status) {
      return res.status(405).json({ error: "METHOD_NOT_ALLOWED", message: "Somente o método POST é permitido." });
    }
    return;
  }

  // Set CORS headers
  if (res.setHeader) {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  }

  try {
    // 2. Parse payload safely (supports req.body object or JSON string from sendBeacon)
    let body: any = req.body;
    if (typeof body === "string") {
      try {
        body = JSON.parse(body);
      } catch (e) {
        return res.status(400).json({ error: "INVALID_JSON", message: "Formato JSON inválido." });
      }
    }

    if (!body || typeof body !== "object") {
      return res.status(400).json({ error: "BAD_REQUEST", message: "Payload ausente ou inválido." });
    }

    const { adId, position, destinationUrl } = body;

    // 3. Validations
    // adId: required, string, safe characters (alphanumeric, dashes, underscores)
    if (!adId || typeof adId !== "string" || adId.trim().length === 0 || adId.length > 128) {
      return res.status(400).json({ error: "INVALID_AD_ID", message: "ID do anúncio inválido." });
    }

    const cleanAdId = adId.trim();
    if (!/^[a-zA-Z0-9_\-]+$/.test(cleanAdId)) {
      return res.status(400).json({ error: "UNSAFE_AD_ID", message: "ID do anúncio possui caracteres não permitidos." });
    }

    // position: valid string
    const cleanPosition = typeof position === "string" ? position.trim().slice(0, 64) : "unknown";

    // destinationUrl: optional or string, must start with http:// or https:// (no javascript: or script paths)
    if (destinationUrl) {
      if (typeof destinationUrl !== "string" || destinationUrl.length > 2048) {
        return res.status(400).json({ error: "INVALID_DESTINATION_URL", message: "URL de destino inválida." });
      }

      const lowerUrl = destinationUrl.trim().toLowerCase();
      if (!lowerUrl.startsWith("http://") && !lowerUrl.startsWith("https://")) {
        return res.status(400).json({ error: "UNSAFE_DESTINATION_URL", message: "URL de destino deve iniciar com http:// ou https://" });
      }
    }

    // 4. Update Firestore atomically
    const db = getDb();
    const nowIso = new Date().toISOString();
    const todayStr = nowIso.split("T")[0]; // YYYY-MM-DD
    const statDocId = `${cleanAdId}_${todayStr}`;

    // Update ad document
    const adRef = doc(db, "ads", cleanAdId);
    try {
      await updateDoc(adRef, {
        clickCount: increment(1),
        lastClickedAt: nowIso
      });
    } catch (err: any) {
      // If document didn't have clickCount field initially or updateDoc failed, setDoc merge
      try {
        await setDoc(adRef, {
          clickCount: increment(1),
          lastClickedAt: nowIso
        }, { merge: true });
      } catch (innerErr) {
        console.warn("[ADS_TRACK_CLICK] Non-critical warning updating ad click count:", innerErr);
      }
    }

    // Update daily stats document ad_click_stats/{adId_YYYY-MM-DD}
    try {
      const statRef = doc(db, "ad_click_stats", statDocId);
      await setDoc(statRef, {
        adId: cleanAdId,
        date: todayStr,
        clickCount: increment(1),
        position: cleanPosition,
        updatedAt: nowIso
      }, { merge: true });
    } catch (statErr) {
      console.warn("[ADS_TRACK_CLICK] Non-critical warning updating ad_click_stats:", statErr);
    }

    return res.status(200).json({
      success: true,
      adId: cleanAdId,
      clickCountRecorded: true,
      timestamp: nowIso
    });

  } catch (err: any) {
    console.error("[ADS_TRACK_CLICK] Error recording click:", err);
    return res.status(500).json({
      error: "SERVER_ERROR",
      message: err.message || "Erro interno ao registrar clique."
    });
  }
}
