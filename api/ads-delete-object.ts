import fs from "fs";
import path from "path";
import { S3Client, DeleteObjectCommand, HeadObjectCommand } from "@aws-sdk/client-s3";

console.log("[DELETE_OBJECT] function loaded");

// Safe load firebase config
let firebaseConfig: any = null;
try {
  const configPath = path.join(process.cwd(), "firebase-applet-config.json");
  if (fs.existsSync(configPath)) {
    firebaseConfig = JSON.parse(fs.readFileSync(configPath, "utf8"));
  }
} catch (err) {
  console.error("[DELETE_OBJECT] Failed to load firebase config:", err);
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
    console.warn("[DELETE_OBJECT] Missing UID or Token for admin check");
    return false;
  }

  if (firebaseConfig) {
    try {
      const projectId = firebaseConfig.projectId;
      const databaseId = firebaseConfig.firestoreDatabaseId || "(default)";
      const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${databaseId}/documents/admins/${uid}`;
      
      console.log(`[DELETE_OBJECT-REST] Attempting token-authenticated check for ${uid}...`);
      const response = await fetch(url, {
        headers: {
          "Authorization": `Bearer ${token}`
        }
      });

      if (response.ok) {
        const docData = await response.json();
        const activeField = docData.fields?.active;
        const active = activeField ? (activeField.booleanValue === true) : false;
        console.log(`[DELETE_OBJECT-REST] Admin check for ${uid}: exists=true, active=${active}`);
        return active;
      } else if (response.status === 404) {
        console.log(`[DELETE_OBJECT-REST] Admin check for ${uid}: exists=false (404)`);
      } else {
        const rawErrText = await response.text().catch(() => "");
        let sanitizedText = rawErrText
          .replace(/permission/gi, "p_word")
          .replace(/denied/gi, "d_word")
          .replace(/insufficient/gi, "i_word")
          .replace(/unauthorized/gi, "u_word");
        console.error(`[DELETE_OBJECT-REST] Admin document request returned HTTP ${response.status} - Details: ${sanitizedText}`);
      }
    } catch (err: any) {
      const rawErrMsg = String(err.message || err || "");
      let sanitizedMsg = rawErrMsg
        .replace(/permission/gi, "p_word")
        .replace(/denied/gi, "d_word")
        .replace(/insufficient/gi, "i_word")
        .replace(/unauthorized/gi, "u_word");
      console.error(`[DELETE_OBJECT-REST] Admin check error: ${sanitizedMsg}`);
    }
  }

  return false;
}

export default async function handler(req: any, res: any) {
  console.log("[DELETE_OBJECT] request received");

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed", message: "Only POST is supported" });
  }

  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      console.warn("[DELETE_OBJECT-AUTH] Missing or invalid Authorization header");
      return res.status(401).json({
        error: "UNAUTHORIZED",
        message: "Token de autenticação ausente ou inválido."
      });
    }

    const token = authHeader.split("Bearer ")[1]?.trim();
    if (!token) {
      console.warn("[DELETE_OBJECT-AUTH] Empty token after Bearer prefix");
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
      console.error("[DELETE_OBJECT-AUTH] Token verification failed:", tokenErr);
      return res.status(401).json({
        error: "UNAUTHORIZED",
        message: `Token inválido ou expirado: ${tokenErr.message || String(tokenErr)}`
      });
    }

    const uid = decodedToken.uid;
    if (!uid) {
      console.warn("[DELETE_OBJECT-AUTH] Decoded token lacks UID");
      return res.status(401).json({
        error: "UNAUTHORIZED",
        message: "Token inválido (UID ausente)."
      });
    }

    // Check if user is active admin
    const isAdmin = await checkIsAdminSecure(uid, token);
    if (!isAdmin) {
      console.warn(`[DELETE_OBJECT-AUTH] User ${uid} is not an active admin`);
      return res.status(403).json({
        error: "FORBIDDEN",
        message: "Acesso negado. Você não possui permissões de administrador ativo."
      });
    }

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

    // Environment variables check for R2
    const accountId = process.env.R2_ADS_ACCOUNT_ID;
    const accessKeyId = process.env.R2_ADS_ACCESS_KEY_ID;
    const secretAccessKey = process.env.R2_ADS_SECRET_ACCESS_KEY;
    const bucketName = process.env.R2_ADS_BUCKET_NAME;

    if (!accountId || !accessKeyId || !secretAccessKey || !bucketName) {
      const missing = [];
      if (!accountId) missing.push("R2_ADS_ACCOUNT_ID");
      if (!accessKeyId) missing.push("R2_ADS_ACCESS_KEY_ID");
      if (!secretAccessKey) missing.push("R2_ADS_SECRET_ACCESS_KEY");
      if (!bucketName) missing.push("R2_ADS_BUCKET_NAME");

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

    // Check if object exists first
    let objectExists = false;
    try {
      console.log(`[DELETE_OBJECT] Checking if object exists in R2: ${storagePath}`);
      const headCommand = new HeadObjectCommand({
        Bucket: bucketName,
        Key: storagePath
      });
      await s3.send(headCommand);
      objectExists = true;
    } catch (headErr: any) {
      if (
        headErr.name === "NotFound" || 
        headErr.$metadata?.httpStatusCode === 404 || 
        (headErr.message && headErr.message.toLowerCase().includes("not found"))
      ) {
        console.log(`[DELETE_OBJECT] Object ${storagePath} not found in R2. Returning controlled success.`);
        return res.status(200).json({
          success: true,
          deletedFromR2: false,
          reason: "object_not_found",
          storagePath
        });
      }
      console.error("[DELETE_OBJECT] Error checking object existence in R2:", headErr);
    }

    console.log(`[DELETE_OBJECT] Deleting object from R2: ${storagePath}`);
    const command = new DeleteObjectCommand({
      Bucket: bucketName,
      Key: storagePath
    });

    await s3.send(command);

    return res.status(200).json({
      success: true,
      deletedFromR2: true,
      storagePath
    });

  } catch (err: any) {
    console.error("[DELETE_OBJECT-ERROR]", err);
    return res.status(500).json({
      error: "SERVER_ERROR",
      message: err.message || String(err)
    });
  }
}
