import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";

console.log("[ADS_IMAGE] function loaded");

export default async function handler(req: any, res: any) {
  console.log("[ADS_IMAGE] request received");
  
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed", message: "Only GET is supported" });
  }

  try {
    const storagePathQuery = req.query.path as string;
    const urlQuery = req.query.url as string;
    
    let storagePath = "";
    if (storagePathQuery) {
      storagePath = storagePathQuery;
    } else if (urlQuery) {
      const publicBaseUrl = process.env.R2_ADS_PUBLIC_BASE_URL;
      let pathPart = urlQuery;
      if (publicBaseUrl) {
        const baseUrl = publicBaseUrl.replace(/\/+$/, "");
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
      return res.status(400).json({ error: "BAD_REQUEST", message: "Parameter 'path' or 'url' is required" });
    }
    
    const cleanStoragePath = storagePath.trim().replace(/^\/+/, "").replace(/\s+/g, "_");
    
    // Strict security validations to prevent directory traversal and bucket exposure
    if (
      cleanStoragePath.includes("..") ||
      cleanStoragePath.includes("http://") ||
      cleanStoragePath.includes("https://") ||
      cleanStoragePath.includes("file://") ||
      cleanStoragePath.startsWith("/")
    ) {
      return res.status(403).json({
        error: "FORBIDDEN_PATH",
        message: "Acesso negado: o caminho fornecido contém caracteres ou protocolos proibidos."
      });
    }

    // Restrict access exclusively to approved directories ('ads/' and 'branding/')
    if (!cleanStoragePath.startsWith("ads/") && !cleanStoragePath.startsWith("branding/")) {
      return res.status(403).json({
        error: "FORBIDDEN_DIRECTORY",
        message: "Acesso negado: a rota pública de imagens só aceita recursos das pastas 'ads/' e 'branding/'."
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

    console.log("[ADS_IMAGE] env validation complete");

    const s3 = new S3Client({
      region: "auto",
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId,
        secretAccessKey
      }
    });

    console.log("[ADS_IMAGE] R2 request started");

    const command = new GetObjectCommand({
      Bucket: bucketName,
      Key: cleanStoragePath
    });
    
    const response = await s3.send(command);

    console.log("[ADS_IMAGE] R2 response received");

    // Content Type
    let contentType = response.ContentType || "";
    if (!contentType) {
      if (cleanStoragePath.endsWith(".png")) {
        contentType = "image/png";
      } else if (cleanStoragePath.endsWith(".gif")) {
        contentType = "image/gif";
      } else if (cleanStoragePath.endsWith(".webp")) {
        contentType = "image/webp";
      } else {
        contentType = "image/jpeg";
      }
    }

    res.setHeader("Content-Type", contentType);

    if (response.ContentLength !== undefined) {
      res.setHeader("Content-Length", response.ContentLength.toString());
    }
    
    res.setHeader("Cache-Control", "public, max-age=31536000");

    const stream = response.Body as any;
    if (stream && typeof stream.pipe === 'function') {
      stream.pipe(res);
    } else if (stream) {
      const bytes = await stream.transformToByteArray();
      res.send(Buffer.from(bytes));
    } else {
      res.status(404).json({
        error: "EMPTY_BODY",
        message: "O arquivo foi localizado, mas o corpo está vazio."
      });
    }
  } catch (err: any) {
    console.error("[ADS_IMAGE_ERROR]", {
      name: err?.name,
      message: err?.message,
      code: err?.code,
      stack: err?.stack
    });

    if (err.name === "NoSuchKey" || err.$metadata?.httpStatusCode === 404) {
      return res.status(404).json({
        error: "NOT_FOUND",
        message: "A imagem especificada não existe no servidor de armazenamento."
      });
    }
    res.status(500).json({
      error: "INTERNAL_ERROR",
      message: "Erro interno ao carregar o arquivo de imagem."
    });
  }
}
