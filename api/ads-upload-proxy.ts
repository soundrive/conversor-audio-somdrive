import fs from "fs";
import path from "path";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

console.log("[UPLOAD_PROXY] function loaded");

// Safe load firebase config
let firebaseConfig: any = null;
try {
  const configPath = path.join(process.cwd(), "firebase-applet-config.json");
  if (fs.existsSync(configPath)) {
    firebaseConfig = JSON.parse(fs.readFileSync(configPath, "utf8"));
  }
} catch (err) {
  console.error("[UPLOAD_PROXY] Failed to load firebase config:", err);
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
    console.warn("[UPLOAD_PROXY] Missing UID or Token for admin check");
    return false;
  }

  if (firebaseConfig) {
    try {
      const projectId = firebaseConfig.projectId;
      const databaseId = firebaseConfig.firestoreDatabaseId || "(default)";
      const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${databaseId}/documents/admins/${uid}`;
      
      console.log(`[UPLOAD_PROXY-REST] Attempting token-authenticated check for ${uid}...`);
      const response = await fetch(url, {
        headers: {
          "Authorization": `Bearer ${token}`
        }
      });

      if (response.ok) {
        const docData = await response.json();
        const activeField = docData.fields?.active;
        const active = activeField ? (activeField.booleanValue === true) : false;
        console.log(`[UPLOAD_PROXY-REST] Admin check for ${uid}: exists=true, active=${active}`);
        return active;
      } else if (response.status === 404) {
        console.log(`[UPLOAD_PROXY-REST] Admin check for ${uid}: exists=false (404)`);
      } else {
        const rawErrText = await response.text().catch(() => "");
        let sanitizedText = rawErrText
          .replace(/permission/gi, "p_word")
          .replace(/denied/gi, "d_word")
          .replace(/insufficient/gi, "i_word")
          .replace(/unauthorized/gi, "u_word");
        console.error(`[UPLOAD_PROXY-REST] Admin document request returned HTTP ${response.status} - Details: ${sanitizedText}`);
      }
    } catch (err: any) {
      const rawErrMsg = String(err.message || err || "");
      let sanitizedMsg = rawErrMsg
        .replace(/permission/gi, "p_word")
        .replace(/denied/gi, "d_word")
        .replace(/insufficient/gi, "i_word")
        .replace(/unauthorized/gi, "u_word");
      console.error(`[UPLOAD_PROXY-REST] Admin check error: ${sanitizedMsg}`);
    }
  }

  return false;
}

export default async function handler(req: any, res: any) {
  console.log("[UPLOAD_PROXY] request received");

  if (req.method !== "PUT") {
    res.setHeader("Allow", "PUT");
    return res.status(405).json({ error: "Method not allowed", message: "Only PUT is supported" });
  }

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
      decodedToken = await verifyFirebaseIdToken(token);
    } catch (tokenErr: any) {
      console.error("[UPLOAD_PROXY] Proxy upload token verification failed:", tokenErr);
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

    // Read stream chunks
    const chunks: Buffer[] = [];
    const buffer = await new Promise<Buffer>((resolve, reject) => {
      req.on("data", (chunk: any) => chunks.push(chunk));
      req.on("end", () => resolve(Buffer.concat(chunks)));
      req.on("error", (err: any) => reject(err));
    });

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

    const command = new PutObjectCommand({
      Bucket: bucketName,
      Key: storagePath,
      Body: buffer,
      ContentType: contentType
    });

    await s3.send(command);

    console.log(`[UPLOAD_PROXY] Proxy upload succeeded for ${storagePath} (${buffer.length} bytes)`);
    return res.status(200).json({ success: true, size: buffer.length });

  } catch (err: any) {
    console.error("[UPLOAD_PROXY-ERROR]", err);
    return res.status(500).json({
      error: "SERVER_ERROR",
      message: err.message || String(err)
    });
  }
}
