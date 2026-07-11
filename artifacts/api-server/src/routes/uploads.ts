import { Router, type IRouter, type Request } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import { requireAuth } from "../middlewares/auth";

const DEV_UPLOAD_DIR = "/tmp/kyc-uploads";

// ---------------------------------------------------------------------------
// Storage configuration
// ---------------------------------------------------------------------------

const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

function safeFilename(name: string): string | null {
  if (!name || name.includes("..") || name.includes("/") || name.includes("\\")) {
    return null;
  }
  return name;
}

function buildPublicFileUrl(req: Request, filename: string): string {
  const configured = process.env.API_PUBLIC_URL?.replace(/\/$/, "");
  if (configured) {
    return `${configured}/api/uploads/kyc-files/${filename}`;
  }

  const host = req.get("x-forwarded-host") ?? req.get("host") ?? "localhost:8080";
  const protocol = req.get("x-forwarded-proto") ?? req.protocol ?? "http";
  return `${protocol}://${host}/api/uploads/kyc-files/${filename}`;
}

const devStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    fs.mkdirSync(DEV_UPLOAD_DIR, { recursive: true });
    cb(null, DEV_UPLOAD_DIR);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    const name = `${Date.now()}-${crypto.randomBytes(8).toString("hex")}${ext}`;
    cb(null, name);
  },
});

const memStorage = multer.memoryStorage();

const upload = multer({
  storage: process.env.NODE_ENV === "production" ? memStorage : devStorage,
  limits: { fileSize: MAX_FILE_SIZE_BYTES },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Only JPEG, PNG, WebP, and PDF files are accepted"));
    }
  },
});

// ---------------------------------------------------------------------------
// Supabase Storage (production)
// Required env vars: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, KYC_BUCKET_NAME
// ---------------------------------------------------------------------------

async function uploadToSupabase(file: Express.Multer.File): Promise<string> {
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const bucketName = process.env.KYC_BUCKET_NAME ?? "kyc-documents";

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      "Missing Supabase env vars: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required in production",
    );
  }

  const { createClient } = await import("@supabase/supabase-js");
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  const ext = path.extname(file.originalname) || ".jpg";
  const filePath = `${Date.now()}-${crypto.randomBytes(8).toString("hex")}${ext}`;

  const { error } = await supabase.storage
    .from(bucketName)
    .upload(filePath, file.buffer, { contentType: file.mimetype, upsert: false });

  if (error) {
    throw new Error(`Supabase upload failed: ${error.message}`);
  }

  // Return a signed URL valid for 10 years (admin review only)
  const { data: signedData, error: signError } = await supabase.storage
    .from(bucketName)
    .createSignedUrl(filePath, 60 * 60 * 24 * 365 * 10);

  if (signError || !signedData) {
    throw new Error(`Failed to create signed URL: ${signError?.message}`);
  }

  return signedData.signedUrl;
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

const router: IRouter = Router();

router.get(
  "/uploads/kyc-files/:filename",
  requireAuth,
  (req, res): void => {
    const filename = safeFilename(String(req.params.filename));
    if (!filename) {
      res.status(400).json({ error: "Invalid filename" });
      return;
    }

    const filePath = path.join(DEV_UPLOAD_DIR, filename);
    if (!fs.existsSync(filePath)) {
      res.status(404).json({ error: "File not found" });
      return;
    }

    res.sendFile(filePath);
  },
);

router.post(
  "/uploads/kyc-document",
  requireAuth,
  upload.single("file"),
  async (req, res): Promise<void> => {
    if (!req.file) {
      res.status(400).json({ error: "No file uploaded" });
      return;
    }

    try {
      let url: string;

      if (process.env.NODE_ENV === "production") {
        url = await uploadToSupabase(req.file);
      } else {
        const filename = (req.file as Express.Multer.File & { filename: string }).filename;
        url = buildPublicFileUrl(req, filename);
      }

      res.json({ url });
    } catch (err) {
      req.log.error({ err }, "KYC document upload failed");
      res.status(500).json({ error: "Upload failed. Please try again." });
    }
  },
);

export default router;
