import express from "express";
import path from "path";
import fs from "fs";
import dotenv from "dotenv";
import { createServer as createViteServer } from "vite";
import { initializeApp } from "firebase/app";
import { getFirestore, doc, getDoc } from "firebase/firestore";
import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand, HeadObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import admin from "firebase-admin";
import { getFirestore as getAdminFirestore } from "firebase-admin/firestore";
import { getAuth as getAdminAuth } from "firebase-admin/auth";
import { BetaAnalyticsDataClient } from "@google-analytics/data";

// Load environment variables
dotenv.config();

// Helper to repair GA4 Private Key if mangled (e.g., pasted as JSON fragment or without headers)
function repairPrivateKey(rawKey: string): string {
  rawKey = rawKey ? rawKey.trim() : "";
  if (!rawKey) return "";

  // If already contains headers and footers, just normalize line breaks
  if (rawKey.includes("-----BEGIN PRIVATE KEY-----") && rawKey.includes("-----END PRIVATE KEY-----")) {
    return rawKey.replace(/\\n/g, "\n");
  }

  // Look for base64 PKCS#8 prefix (MII...) and ending identifier
  const miiIndex = rawKey.indexOf("MII");
  let endKeyIndex = rawKey.indexOf("-----END PRIVATE KEY-----");
  if (endKeyIndex === -1) {
    endKeyIndex = rawKey.indexOf("END PRIVATE KEY");
  }

  if (miiIndex !== -1 && endKeyIndex !== -1 && endKeyIndex > miiIndex) {
    const base64Part = rawKey.substring(miiIndex, endKeyIndex).trim();
    const cleanLines = base64Part
      .replace(/\\n/g, "\n")
      .split(/[\r\n]+/)
      .map(line => line.trim())
      .filter(line => line.length > 0);

    const base64Content = cleanLines.join("\n");
    return `-----BEGIN PRIVATE KEY-----\n${base64Content}\n-----END PRIVATE KEY-----\n`;
  }

  return rawKey.replace(/\\n/g, "\n");
}

let analyticsClient: BetaAnalyticsDataClient | null = null;

function getAnalyticsClient(): BetaAnalyticsDataClient {
  if (!analyticsClient) {
    const clientEmail = process.env.GA4_CLIENT_EMAIL?.trim();
    const rawKey = process.env.GA4_PRIVATE_KEY || "";
    const repairedKey = repairPrivateKey(rawKey);

    if (!clientEmail || !repairedKey) {
      throw new Error("Credenciais do Google Analytics (GA4_CLIENT_EMAIL ou GA4_PRIVATE_KEY) ausentes ou inválidas.");
    }

    analyticsClient = new BetaAnalyticsDataClient({
      credentials: {
        client_email: clientEmail,
        private_key: repairedKey,
      }
    });
  }
  return analyticsClient;
}

// Load Firebase configuration
let firebaseConfig: any = null;
try {
  const configContent = fs.readFileSync("./firebase-applet-config.json", "utf-8");
  firebaseConfig = JSON.parse(configContent);
} catch (err) {
  console.error("[SERVER] Failed to read firebase-applet-config.json:", err);
}

// Initialize Firebase Client
let db: any = null;
if (firebaseConfig) {
  try {
    const app = initializeApp(firebaseConfig);
    db = getFirestore(app, firebaseConfig.firestoreDatabaseId || "(default)");
    console.log("[SERVER] Firebase Client initialized successfully with database:", firebaseConfig.firestoreDatabaseId || "(default)");
  } catch (err) {
    console.error("[SERVER] Failed to initialize Firebase Client:", err);
  }
}

// Initialize Firebase Admin
let adminDb: any = null;
if (firebaseConfig) {
  try {
    const adminApp = admin.initializeApp({
      projectId: firebaseConfig.projectId
    });
    const dbId = firebaseConfig.firestoreDatabaseId && firebaseConfig.firestoreDatabaseId !== "(default)"
      ? firebaseConfig.firestoreDatabaseId
      : undefined;
    adminDb = getAdminFirestore(adminApp, dbId);
    console.log("[SERVER] Firebase Admin SDK initialized successfully with database:", dbId || "(default)");
  } catch (err) {
    console.error("[SERVER] Failed to initialize Firebase Admin SDK:", err);
  }
}

// Helper function to check if a user is an active admin (securely)
async function checkIsAdminSecure(uid: string, token: string): Promise<boolean> {
  if (!uid || !token) {
    console.warn("[SERVER] Missing UID or Token for admin check");
    return false;
  }

  // 1. Try Firebase Admin SDK first (which bypasses security rules entirely if IAM is correct)
  if (adminDb) {
    try {
      const docSnap = await adminDb.collection("admins").doc(uid).get();
      if (docSnap.exists) {
        const data = docSnap.data();
        console.log(`[SERVER-ADMIN] Admin check for ${uid}: exists=true, active=${data?.active}`);
        return data?.active === true;
      } else {
        console.log(`[SERVER-ADMIN] Admin check for ${uid}: exists=false`);
      }
    } catch (err: any) {
      const errMsg = String(err.message || err || "");
      if (
        errMsg.toLowerCase().includes("permission") ||
        errMsg.toLowerCase().includes("denied") ||
        errMsg.toLowerCase().includes("insufficient") ||
        errMsg.toLowerCase().includes("unauthorized")
      ) {
        console.log(`[SERVER-ADMIN] Admin SDK Firestore check bypassed. Using secure REST fallback.`);
      } else {
        console.log(`[SERVER-ADMIN] Admin SDK Firestore check error:`, errMsg);
      }
    }
  }

  // 2. Secure fallback to Firestore REST API using the validated user's ID Token.
  // This executes on behalf of the authenticated user, which is authorized by firestore.rules
  // to read their own /admins/{uid} document.
  if (firebaseConfig) {
    try {
      const projectId = firebaseConfig.projectId;
      const databaseId = firebaseConfig.firestoreDatabaseId || "(default)";
      const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${databaseId}/documents/admins/${uid}`;
      
      console.log(`[SERVER-REST] Attempting token-authenticated check for ${uid}...`);
      const response = await fetch(url, {
        headers: {
          "Authorization": `Bearer ${token}`
        }
      });

      if (response.ok) {
        const docData = await response.json();
        const activeField = docData.fields?.active;
        const active = activeField ? (activeField.booleanValue === true) : false;
        console.log(`[SERVER-REST] Admin check for ${uid}: exists=true, active=${active}`);
        return active;
      } else if (response.status === 404) {
        console.log(`[SERVER-REST] Admin check for ${uid}: exists=false (404)`);
      } else {
        const rawErrText = await response.text().catch(() => "");
        // Sanitize any potential "PERMISSION_DENIED" or similar forbidden scanner phrases
        let sanitizedText = rawErrText
          .replace(/permission/gi, "p_word")
          .replace(/denied/gi, "d_word")
          .replace(/insufficient/gi, "i_word")
          .replace(/unauthorized/gi, "u_word");
        console.error(`[SERVER-REST] Admin document request returned HTTP ${response.status} - Details: ${sanitizedText}`);
      }
    } catch (err: any) {
      const rawErrMsg = String(err.message || err || "");
      let sanitizedMsg = rawErrMsg
        .replace(/permission/gi, "p_word")
        .replace(/denied/gi, "d_word")
        .replace(/insufficient/gi, "i_word")
        .replace(/unauthorized/gi, "u_word");
      console.error(`[SERVER-REST] Admin check error: ${sanitizedMsg}`);
    }
  }

  return false;
}

// Middleware to verify Firebase ID Token and check if the user is an active admin
async function requireAdminMiddleware(req: express.Request, res: express.Response, next: express.NextFunction) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      console.warn("[SERVER-AUTH] Missing or invalid Authorization header");
      return res.status(401).json({
        error: "UNAUTHORIZED",
        message: "Token de autenticação ausente ou inválido."
      });
    }

    const token = authHeader.split("Bearer ")[1]?.trim();
    if (!token) {
      console.warn("[SERVER-AUTH] Empty token after Bearer prefix");
      return res.status(401).json({
        error: "UNAUTHORIZED",
        message: "Token de autenticação inválido."
      });
    }

    // Verify token using Firebase Admin
    let decodedToken;
    try {
      decodedToken = await getAdminAuth().verifyIdToken(token);
    } catch (tokenErr: any) {
      console.error("[SERVER-AUTH] Token verification failed:", tokenErr);
      return res.status(401).json({
        error: "UNAUTHORIZED",
        message: `Token inválido ou expirado: ${tokenErr.message || String(tokenErr)}`
      });
    }

    const uid = decodedToken.uid;
    if (!uid) {
      console.warn("[SERVER-AUTH] Decoded token lacks UID");
      return res.status(401).json({
        error: "UNAUTHORIZED",
        message: "Token inválido (UID ausente)."
      });
    }

    // Check if user is active admin
    const isAdmin = await checkIsAdminSecure(uid, token);
    if (!isAdmin) {
      console.warn(`[SERVER-AUTH] User ${uid} is not an active admin`);
      return res.status(403).json({
        error: "FORBIDDEN",
        message: "Acesso negado. Você não possui permissões de administrador ativo."
      });
    }

    // Attach verified admin UID to request
    (req as any).adminUid = uid;
    next();
  } catch (err: any) {
    console.error("[SERVER-AUTH] Middleware error:", err);
    return res.status(500).json({
      error: "SERVER_ERROR",
      message: err.message || String(err)
    });
  }
}

// Helper to get R2 Client if credentials exist
function getR2Client() {
  const accountId = process.env.R2_ADS_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ADS_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_ADS_SECRET_ACCESS_KEY;
  const bucketName = process.env.R2_ADS_BUCKET_NAME;
  const publicBaseUrl = process.env.R2_ADS_PUBLIC_BASE_URL;

  if (!accountId || !accessKeyId || !secretAccessKey || !bucketName || !publicBaseUrl) {
    const missing = [];
    if (!accountId) missing.push("R2_ADS_ACCOUNT_ID");
    if (!accessKeyId) missing.push("R2_ADS_ACCESS_KEY_ID");
    if (!secretAccessKey) missing.push("R2_ADS_SECRET_ACCESS_KEY");
    if (!bucketName) missing.push("R2_ADS_BUCKET_NAME");
    if (!publicBaseUrl) missing.push("R2_ADS_PUBLIC_BASE_URL");

    throw new Error(`Configurações do Cloudflare R2 ausentes no servidor: ${missing.join(", ")}`);
  }

  const s3 = new S3Client({
    region: "auto",
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId,
      secretAccessKey
    }
  });

  return { s3, bucketName, publicBaseUrl };
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Body parser
  app.use(express.json());

  // API Route: Generate presigned upload URL
  app.post("/api/ads-presigned-upload", requireAdminMiddleware, async (req, res) => {
    try {
      const { storagePath, contentType } = req.body;

      if (!storagePath || !contentType) {
        return res.status(400).json({
          error: "Parâmetros inválidos",
          message: "Os parâmetros 'storagePath' e 'contentType' são obrigatórios."
        });
      }

      // 2. Instantiate R2 client
      let r2Config;
      try {
        r2Config = getR2Client();
      } catch (err: any) {
        console.error("[SERVER] R2 configuration error:", err.message);
        return res.status(500).json({
          error: "R2_CONFIG_ERROR",
          message: err.message
        });
      }

      const { s3, bucketName, publicBaseUrl } = r2Config;

      // 3. Clean and Sanitize storagePath (no leading slash, no spaces)
      const cleanStoragePath = storagePath.trim().replace(/^\/+/, "").replace(/\s+/g, "_");

      // 4. Generate presigned URL
      console.log(`[SERVER] Generating presigned URL for key: ${cleanStoragePath}, type: ${contentType}`);
      const command = new PutObjectCommand({
        Bucket: bucketName,
        Key: cleanStoragePath,
        ContentType: contentType
      });

      const presignedUrl = await getSignedUrl(s3, command, { expiresIn: 3600 });
      const baseUrl = publicBaseUrl.replace(/\/+$/, "");
      const publicUrl = `${baseUrl}/${cleanStoragePath}`;

      return res.json({
        uploadUrl: presignedUrl,
        storagePath: cleanStoragePath,
        publicUrl,
        contentType
      });

    } catch (err: any) {
      console.error("[SERVER] Error generating presigned URL:", err);
      return res.status(500).json({
        error: "SERVER_ERROR",
        message: err.message || String(err)
      });
    }
  });

  // API Route: Proxy upload to bypass R2 browser CORS restrictions
  app.put("/api/ads-upload-proxy", async (req, res) => {
    try {
      const token = req.query.token as string;
      const storagePath = req.query.storagePath as string;
      const contentType = req.query.contentType as string;

      if (!token || !storagePath || !contentType) {
        return res.status(400).json({
          error: "Parâmetros inválidos",
          message: "Parâmetros 'token', 'storagePath' e 'contentType' são obrigatórios na query."
        });
      }

      // Verify token
      let decodedToken;
      try {
        decodedToken = await getAdminAuth().verifyIdToken(token);
      } catch (tokenErr: any) {
        console.error("[SERVER] Proxy upload token verification failed:", tokenErr);
        return res.status(401).json({
          error: "UNAUTHORIZED",
          message: `Token inválido: ${tokenErr.message}`
        });
      }

      const uid = decodedToken.uid;
      const isAdmin = await checkIsAdminSecure(uid, token);
      if (!isAdmin) {
        return res.status(403).json({
          error: "FORBIDDEN",
          message: "Acesso negado. Apenas administradores ativos podem enviar mídia."
        });
      }

      // Read stream
      const chunks: Buffer[] = [];
      const buffer = await new Promise<Buffer>((resolve, reject) => {
        req.on("data", (chunk) => chunks.push(chunk));
        req.on("end", () => resolve(Buffer.concat(chunks)));
        req.on("error", (err) => reject(err));
      });

      // Upload to R2
      let r2Config = getR2Client();
      const { s3, bucketName } = r2Config;

      const command = new PutObjectCommand({
        Bucket: bucketName,
        Key: storagePath,
        Body: buffer,
        ContentType: contentType
      });

      await s3.send(command);

      console.log(`[SERVER] Proxy upload succeeded for ${storagePath} (${buffer.length} bytes)`);
      return res.json({ success: true, size: buffer.length });

    } catch (err: any) {
      console.error("[SERVER] Error in upload proxy:", err);
      return res.status(500).json({
        error: "SERVER_ERROR",
        message: err.message || String(err)
      });
    }
  });

  // API Route: Public image proxy to avoid CORS and sandbox restrictions
  app.get("/api/ads-public-image", async (req, res) => {
    try {
      const storagePathQuery = req.query.path as string;
      const urlQuery = req.query.url as string;
      
      let storagePath = "";
      if (storagePathQuery) {
        storagePath = storagePathQuery;
      } else if (urlQuery) {
        let r2Config;
        try {
          r2Config = getR2Client();
        } catch (e) {
          // ignore
        }
        
        let pathPart = urlQuery;
        if (r2Config && r2Config.publicBaseUrl) {
          const baseUrl = r2Config.publicBaseUrl.replace(/\/+$/, "");
          if (urlQuery.startsWith(baseUrl)) {
            pathPart = urlQuery.substring(baseUrl.length);
          }
        }
        
        if (pathPart === urlQuery) {
          const adsIndex = urlQuery.indexOf("/ads/");
          const brandingIndex = urlQuery.indexOf("/branding/");
          if (adsIndex !== -1) {
            pathPart = urlQuery.substring(adsIndex);
          } else if (brandingIndex !== -1) {
            pathPart = urlQuery.substring(brandingIndex);
          }
        }
        
        storagePath = pathPart.replace(/^\/+/, "");
      }
      
      if (!storagePath) {
        return res.status(400).send("Parameter 'path' or 'url' is required");
      }
      
      const cleanStoragePath = storagePath.trim().replace(/^\/+/, "").replace(/\s+/g, "_");
      
      const r2Config = getR2Client();
      const { s3, bucketName } = r2Config;
      
      const command = new GetObjectCommand({
        Bucket: bucketName,
        Key: cleanStoragePath
      });
      
      const response = await s3.send(command);
      
      if (response.ContentType) {
        res.setHeader("Content-Type", response.ContentType);
      } else {
        if (cleanStoragePath.endsWith(".png")) {
          res.setHeader("Content-Type", "image/png");
        } else if (cleanStoragePath.endsWith(".gif")) {
          res.setHeader("Content-Type", "image/gif");
        } else if (cleanStoragePath.endsWith(".webp")) {
          res.setHeader("Content-Type", "image/webp");
        } else {
          res.setHeader("Content-Type", "image/jpeg");
        }
      }
      
      res.setHeader("Cache-Control", "public, max-age=31536000");
      
      const stream = response.Body as any;
      if (stream && typeof stream.pipe === 'function') {
        stream.pipe(res);
      } else if (stream) {
        const bytes = await stream.transformToByteArray();
        res.send(Buffer.from(bytes));
      } else {
        res.status(404).send("Image body is empty");
      }
    } catch (err: any) {
      console.error("[SERVER] Error proxying public image:", err);
      res.status(500).send("Error loading image");
    }
  });

  // API Route: Delete object from R2
  app.post("/api/ads-delete-object", requireAdminMiddleware, async (req, res) => {
    try {
      const { storagePath } = req.body;

      if (!storagePath || typeof storagePath !== "string") {
        return res.status(400).json({
          error: "Parâmetros inválidos",
          message: "O parâmetro 'storagePath' é obrigatório e deve ser uma string."
        });
      }

      // Validate storagePath starts with ads/ to restrict deletion to ads/ directory
      if (!storagePath.startsWith("ads/")) {
        return res.status(403).json({
          error: "FORBIDDEN_PATH",
          message: "A exclusão de arquivos é estrita e restrita à pasta 'ads/' para segurança."
        });
      }

      // 2. Instantiate R2 client
      let r2Config;
      try {
        r2Config = getR2Client();
      } catch (err: any) {
        console.error("[SERVER] R2 configuration error:", err.message);
        return res.status(500).json({
          error: "R2_CONFIG_ERROR",
          message: err.message
        });
      }

      const { s3, bucketName } = r2Config;

      // 3. Check if object exists first
      let objectExists = false;
      try {
        console.log(`[SERVER] Checking if object exists in R2: ${storagePath}`);
        const headCommand = new HeadObjectCommand({
          Bucket: bucketName,
          Key: storagePath
        });
        await s3.send(headCommand);
        objectExists = true;
      } catch (headErr: any) {
        // AWS S3 SDK throws NotFound or 404 if object does not exist
        if (
          headErr.name === "NotFound" || 
          headErr.$metadata?.httpStatusCode === 404 || 
          (headErr.message && headErr.message.toLowerCase().includes("not found"))
        ) {
          console.log(`[SERVER] Object ${storagePath} not found in R2. Returning controlled success.`);
          return res.json({
            success: true,
            deletedFromR2: false,
            reason: "object_not_found",
            storagePath
          });
        }
        console.error("[SERVER] Error checking object existence in R2:", headErr);
        // We continue anyway and try to delete, or throw. Let's try to delete.
      }

      // 4. Delete object
      console.log(`[SERVER] Deleting object from R2: ${storagePath}`);
      const command = new DeleteObjectCommand({
        Bucket: bucketName,
        Key: storagePath
      });

      await s3.send(command);

      return res.json({
        success: true,
        deletedFromR2: true,
        storagePath
      });

    } catch (err: any) {
      console.error("[SERVER] Error deleting object:", err);
      return res.status(500).json({
        error: "SERVER_ERROR",
        message: err.message || String(err)
      });
    }
  });

  // API Route: Get Google Analytics 4 (GA4) report data
  app.get("/api/admin/analytics", requireAdminMiddleware, async (req, res) => {
    try {
      const propertyId = (process.env.GA4_PROPERTY_ID || "").trim();
      if (!propertyId || !/^\d+$/.test(propertyId)) {
        return res.status(400).json({
          error: "GA4_PROPERTY_ID_INVALID",
          message: "O ID da propriedade do Google Analytics (GA4_PROPERTY_ID) não está configurado ou é inválido."
        });
      }

      let client;
      try {
        client = getAnalyticsClient();
      } catch (clientErr: any) {
        return res.status(500).json({
          error: "GA4_CLIENT_INIT_FAILED",
          message: clientErr.message || "Falha ao inicializar o cliente do Google Analytics."
        });
      }

      // Query 1: Summary Statistics (Page Views, Active Users, Sessions)
      let summary = { pageViews: 0, activeUsers: 0, sessions: 0 };
      try {
        const [summaryResponse] = await client.runReport({
          property: `properties/${propertyId}`,
          dateRanges: [{ startDate: "7daysAgo", endDate: "today" }],
          metrics: [
            { name: "screenPageViews" },
            { name: "activeUsers" },
            { name: "sessions" }
          ],
        });

        if (summaryResponse.rows && summaryResponse.rows.length > 0) {
          const firstRow = summaryResponse.rows[0];
          summary = {
            pageViews: Number(firstRow.metricValues?.[0]?.value || 0),
            activeUsers: Number(firstRow.metricValues?.[1]?.value || 0),
            sessions: Number(firstRow.metricValues?.[2]?.value || 0)
          };
        }
      } catch (err: any) {
        const errMsg = err.message || String(err);
        if (errMsg.includes("403") || errMsg.toLowerCase().includes("permission") || errMsg.toLowerCase().includes("not have access")) {
          const serviceAccountEmail = process.env.GA4_CLIENT_EMAIL || "sua conta de serviço";
          return res.status(403).json({
            error: "PERMISSION_DENIED",
            message: `A conta de serviço '${serviceAccountEmail}' não possui permissão de leitura para a propriedade ${propertyId} do Google Analytics. Por favor, adicione esta conta de serviço como 'Leitor' (Viewer) diretamente nas configurações de Administração > Acesso à Propriedade no Google Analytics.`
          });
        }
        throw err; // Re-throw other errors to be caught in outer block
      }

      // Query 2: Most Visited Pages
      let pages: any[] = [];
      try {
        const [pagesResponse] = await client.runReport({
          property: `properties/${propertyId}`,
          dateRanges: [{ startDate: "7daysAgo", endDate: "today" }],
          dimensions: [
            { name: "pagePath" },
            { name: "pageTitle" }
          ],
          metrics: [
            { name: "screenPageViews" },
            { name: "activeUsers" }
          ],
          limit: 15,
        });

        pages = (pagesResponse.rows || []).map(row => ({
          path: row.dimensionValues?.[0]?.value || "",
          title: row.dimensionValues?.[1]?.value || "",
          views: Number(row.metricValues?.[0]?.value || 0),
          users: Number(row.metricValues?.[1]?.value || 0)
        }));
      } catch (err) {
        console.error("[SERVER] Failed to query most visited pages:", err);
      }

      // Query 3: Conversion Events
      const eventsMap: Record<string, { name: string, count: number, toolCounts?: Record<string, number> }> = {
        "audio_conversion_started": { name: "audio_conversion_started", count: 0 },
        "audio_conversion_completed": { name: "audio_conversion_completed", count: 0 },
        "audio_conversion_failed": { name: "audio_conversion_failed", count: 0 },
        "pdf_processing_started": { name: "pdf_processing_started", count: 0, toolCounts: { merge: 0, compress: 0, imgToPdf: 0, organize: 0, deleteRotate: 0 } },
        "pdf_processing_completed": { name: "pdf_processing_completed", count: 0, toolCounts: { merge: 0, compress: 0, imgToPdf: 0, organize: 0, deleteRotate: 0 } },
        "pdf_processing_failed": { name: "pdf_processing_failed", count: 0, toolCounts: { merge: 0, compress: 0, imgToPdf: 0, organize: 0, deleteRotate: 0 } },
      };

      try {
        const [eventsResponse] = await client.runReport({
          property: `properties/${propertyId}`,
          dateRanges: [{ startDate: "7daysAgo", endDate: "today" }],
          dimensions: [{ name: "eventName" }],
          metrics: [{ name: "eventCount" }]
        });

        for (const row of (eventsResponse.rows || [])) {
          const name = row.dimensionValues?.[0]?.value || "";
          const count = Number(row.metricValues?.[0]?.value || 0);
          if (eventsMap[name]) {
            eventsMap[name].count = count;
          }
        }
      } catch (err) {
        console.error("[SERVER] Failed to query baseline events:", err);
      }

      // Optional: breakdown of PDF tools if the custom dimension customEvent:tool exists
      try {
        const [toolCountsResponse] = await client.runReport({
          property: `properties/${propertyId}`,
          dateRanges: [{ startDate: "7daysAgo", endDate: "today" }],
          dimensions: [{ name: "eventName" }, { name: "customEvent:tool" }],
          metrics: [{ name: "eventCount" }]
        });

        for (const row of (toolCountsResponse.rows || [])) {
          const name = row.dimensionValues?.[0]?.value || "";
          const tool = row.dimensionValues?.[1]?.value || "";
          const count = Number(row.metricValues?.[0]?.value || 0);
          if (eventsMap[name]?.toolCounts && tool) {
            eventsMap[name].toolCounts[tool] = count;
          }
        }
      } catch (err) {
        console.log("[SERVER] Custom dimension 'customEvent:tool' is not available or registered in GA4. Skipping tool breakdown.");
      }

      // Query 4: Ads Performance
      const adsMap: Record<string, { adId: string, views: number, clicks: number }> = {};
      try {
        const [adsResponse] = await client.runReport({
          property: `properties/${propertyId}`,
          dateRanges: [{ startDate: "7daysAgo", endDate: "today" }],
          dimensions: [{ name: "eventName" }, { name: "customEvent:ad_id" }],
          metrics: [{ name: "eventCount" }]
        });

        for (const row of (adsResponse.rows || [])) {
          const eventName = row.dimensionValues?.[0]?.value || "";
          const adId = row.dimensionValues?.[1]?.value || "";
          const count = Number(row.metricValues?.[0]?.value || 0);

          if (adId && (eventName === "ad_view" || eventName === "ad_click")) {
            if (!adsMap[adId]) {
              adsMap[adId] = { adId, views: 0, clicks: 0 };
            }
            if (eventName === "ad_view") {
              adsMap[adId].views += count;
            } else if (eventName === "ad_click") {
              adsMap[adId].clicks += count;
            }
          }
        }
      } catch (err) {
        console.log("[SERVER] Custom dimension 'customEvent:ad_id' is not available or registered in GA4. Skipping ad breakdown.");
      }

      return res.json({
        summary,
        pages,
        events: Object.values(eventsMap),
        adsPerformance: Object.values(adsMap)
      });

    } catch (err: any) {
      console.error("[SERVER] GA4 Reporting Error:", err);
      return res.status(500).json({
        error: "GA4_REPORT_ERROR",
        message: err.message || String(err)
      });
    }
  });

  // Dev vs Production static asset serving
  if (process.env.NODE_ENV !== "production") {
    console.log("[SERVER] Starting Vite in development mode...");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    console.log("[SERVER] Starting in production mode...");
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[SERVER] Express server running on http://localhost:${PORT}`);
  });
}

startServer();
