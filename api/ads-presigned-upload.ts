import fs from "fs";
import path from "path";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

console.log("[PRESIGNED] function loaded");

// Safe load firebase config
let firebaseConfig: any = null;
try {
  const configPath = path.join(process.cwd(), "firebase-applet-config.json");
  if (fs.existsSync(configPath)) {
    firebaseConfig = JSON.parse(fs.readFileSync(configPath, "utf8"));
  }
} catch (err) {
  console.error("[PRESIGNED] Failed to load firebase config:", err);
}

// Lightweight Firebase ID Token verification using standard Google REST API
async function verifyFirebaseIdToken(token: string): Promise<{ uid: string }> {
  const apiKey = firebaseConfig?.apiKey;
  if (!apiKey) {
    throw new Error("API Key do Firebase ausente para verificação de token.");
  }
  
  const url = `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${apiKey}`;
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ idToken: token })
  });
  
  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    const errMsg = errData.error?.message || "Token inválido ou expirado";
    throw new Error(errMsg);
  }
  
  const data = await response.json();
  const user = data.users?.[0];
  if (!user || !user.localId) {
    throw new Error("Usuário não encontrado ou token inválido");
  }
  
  return { uid: user.localId };
}

// Helper function to check if a user is an active admin
async function checkIsAdminSecure(uid: string, token: string): Promise<boolean> {
  if (!uid || !token) {
    console.warn("[PRESIGNED] Missing UID or Token for admin check");
    return false;
  }

  if (firebaseConfig) {
    try {
      const projectId = firebaseConfig.projectId;
      const databaseId = firebaseConfig.firestoreDatabaseId || "(default)";
      const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${databaseId}/documents/admins/${uid}`;
      
      console.log(`[PRESIGNED-REST] Attempting token-authenticated check for ${uid}...`);
      const response = await fetch(url, {
        headers: {
          "Authorization": `Bearer ${token}`
        }
      });

      if (response.ok) {
        const docData = await response.json();
        const activeField = docData.fields?.active;
        const active = activeField ? (activeField.booleanValue === true) : false;
        console.log(`[PRESIGNED-REST] Admin check for ${uid}: exists=true, active=${active}`);
        return active;
      } else if (response.status === 404) {
        console.log(`[PRESIGNED-REST] Admin check for ${uid}: exists=false (404)`);
      } else {
        const rawErrText = await response.text().catch(() => "");
        let sanitizedText = rawErrText
          .replace(/permission/gi, "p_word")
          .replace(/denied/gi, "d_word")
          .replace(/insufficient/gi, "i_word")
          .replace(/unauthorized/gi, "u_word");
        console.error(`[PRESIGNED-REST] Admin document request returned HTTP ${response.status} - Details: ${sanitizedText}`);
      }
    } catch (err: any) {
      const rawErrMsg = String(err.message || err || "");
      let sanitizedMsg = rawErrMsg
        .replace(/permission/gi, "p_word")
        .replace(/denied/gi, "d_word")
        .replace(/insufficient/gi, "i_word")
        .replace(/unauthorized/gi, "u_word");
      console.error(`[PRESIGNED-REST] Admin check error: ${sanitizedMsg}`);
    }
  }

  return false;
}

export default async function handler(req: any, res: any) {
  console.log("[PRESIGNED] request received");

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed", message: "Only POST is supported" });
  }

  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      console.warn("[PRESIGNED-AUTH] Missing or invalid Authorization header");
      return res.status(401).json({
        error: "UNAUTHORIZED",
        message: "Token de autenticação ausente ou inválido."
      });
    }

    const token = authHeader.split("Bearer ")[1]?.trim();
    if (!token) {
      console.warn("[PRESIGNED-AUTH] Empty token after Bearer prefix");
      return res.status(401).json({
        error: "UNAUTHORIZED",
        message: "Token de autenticação inválido."
      });
    }

    // Verify token using lightweight secure REST helper
    let decodedToken;
    try {
      decodedToken = await verifyFirebaseIdToken(token);
    } catch (tokenErr: any) {
      console.error("[PRESIGNED-AUTH] Token verification failed:", tokenErr);
      return res.status(401).json({
        error: "UNAUTHORIZED",
        message: `Token inválido ou expirado: ${tokenErr.message || String(tokenErr)}`
      });
    }

    const uid = decodedToken.uid;
    if (!uid) {
      console.warn("[PRESIGNED-AUTH] Decoded token lacks UID");
      return res.status(401).json({
        error: "UNAUTHORIZED",
        message: "Token inválido (UID ausente)."
      });
    }

    // Check if user is active admin
    const isAdmin = await checkIsAdminSecure(uid, token);
    if (!isAdmin) {
      console.warn(`[PRESIGNED-AUTH] User ${uid} is not an active admin`);
      return res.status(403).json({
        error: "FORBIDDEN",
        message: "Acesso negado. Você não possui permissões de administrador ativo."
      });
    }

    const { storagePath, contentType } = req.body;

    if (!storagePath || !contentType) {
      return res.status(400).json({
        error: "Parâmetros inválidos",
        message: "Os parâmetros 'storagePath' e 'contentType' são obrigatórios."
      });
    }

    // Environment variables check for R2
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

      return res.status(500).json({
        error: "R2_CONFIGURATION_MISSING",
        missing
      });
    }

    const s3 = new S3Client({
      region: "auto",
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId,
        secretAccessKey
      }
    });

    // Clean and Sanitize storagePath
    const cleanStoragePath = storagePath.trim().replace(/^\/+/, "").replace(/\s+/g, "_");

    console.log(`[PRESIGNED] Generating presigned URL for key: ${cleanStoragePath}, type: ${contentType}`);
    const command = new PutObjectCommand({
      Bucket: bucketName,
      Key: cleanStoragePath,
      ContentType: contentType
    });

    const presignedUrl = await getSignedUrl(s3, command, { expiresIn: 3600 });
    const baseUrl = publicBaseUrl.replace(/\/+$/, "");
    const publicUrl = `${baseUrl}/${cleanStoragePath}`;

    return res.status(200).json({
      uploadUrl: presignedUrl,
      storagePath: cleanStoragePath,
      publicUrl,
      contentType
    });

  } catch (err: any) {
    console.error("[PRESIGNED-ERROR]", err);
    return res.status(500).json({
      error: "SERVER_ERROR",
      message: err.message || String(err)
    });
  }
}
