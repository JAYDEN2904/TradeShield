import { Router, type IRouter, type Request } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import { requireAuth } from "../middlewares/auth";

const KYC_UPLOAD_DIR = "/tmp/kyc-uploads";
const PRODUCT_UPLOAD_DIR = "/tmp/product-uploads";

const KYC_MIME_TYPES = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
const PRODUCT_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

function safeFilename(name: string): string | null {
  if (!name || name.includes("..") || name.includes("/") || name.includes("\\")) {
    return null;
  }
  return name;
}

function buildPublicFileUrl(req: Request, kind: "kyc" | "product", filename: string): string {
  const configured = process.env.API_PUBLIC_URL?.replace(/\/$/, "");
  const segment = kind === "kyc" ? "kyc-files" : "product-files";
  if (configured) {
    return `${configured}/api/uploads/${segment}/${filename}`;
  }

  const host = req.get("x-forwarded-host") ?? req.get("host") ?? "localhost:8080";
  const protocol = req.get("x-forwarded-proto") ?? req.protocol ?? "http";
  return `${protocol}://${host}/api/uploads/${segment}/${filename}`;
}

function makeDiskStorage(dir: string) {
  return multer.diskStorage({
    destination: (_req, _file, cb) => {
      fs.mkdirSync(dir, { recursive: true });
      cb(null, dir);
    },
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname);
      const name = `${Date.now()}-${crypto.randomBytes(8).toString("hex")}${ext}`;
      cb(null, name);
    },
  });
}

const memStorage = multer.memoryStorage();
const isProduction = process.env.NODE_ENV === "production";

function makeUploader(allowedMimeTypes: string[], diskDir: string) {
  return multer({
    storage: isProduction ? memStorage : makeDiskStorage(diskDir),
    limits: { fileSize: MAX_FILE_SIZE_BYTES },
    fileFilter: (_req, file, cb) => {
      if (allowedMimeTypes.includes(file.mimetype)) {
        cb(null, true);
      } else {
        cb(new Error(`Only ${allowedMimeTypes.join(", ")} files are accepted`));
      }
    },
  });
}

const kycUpload = makeUploader(KYC_MIME_TYPES, KYC_UPLOAD_DIR);
const productUpload = makeUploader(PRODUCT_MIME_TYPES, PRODUCT_UPLOAD_DIR);

// ---------------------------------------------------------------------------
// Supabase Storage (production)
// ---------------------------------------------------------------------------

async function uploadToSupabase(
  file: Express.Multer.File,
  bucketName: string,
  opts: { publicUrl: boolean },
): Promise<string> {
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

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

  if (opts.publicUrl) {
    const { data } = supabase.storage.from(bucketName).getPublicUrl(filePath);
    if (!data?.publicUrl) {
      throw new Error("Failed to create public URL");
    }
    return data.publicUrl;
  }

  // Signed URL valid for 10 years (admin review only)
  const { data: signedData, error: signError } = await supabase.storage
    .from(bucketName)
    .createSignedUrl(filePath, 60 * 60 * 24 * 365 * 10);

  if (signError || !signedData) {
    throw new Error(`Failed to create signed URL: ${signError?.message}`);
  }

  return signedData.signedUrl;
}

function serveLocalFile(dir: string, filenameParam: string, res: import("express").Response): void {
  const filename = safeFilename(filenameParam);
  if (!filename) {
    res.status(400).json({ error: "Invalid filename" });
    return;
  }

  const filePath = path.join(dir, filename);
  if (!fs.existsSync(filePath)) {
    res.status(404).json({ error: "File not found" });
    return;
  }

  res.sendFile(filePath);
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

const router: IRouter = Router();

router.get("/uploads/kyc-files/:filename", requireAuth, (req, res): void => {
  serveLocalFile(KYC_UPLOAD_DIR, String(req.params.filename), res);
});

/** Product images are public — buyers need to see them without logging in. */
router.get("/uploads/product-files/:filename", (req, res): void => {
  serveLocalFile(PRODUCT_UPLOAD_DIR, String(req.params.filename), res);
});

router.post(
  "/uploads/kyc-document",
  requireAuth,
  kycUpload.single("file"),
  async (req, res): Promise<void> => {
    if (!req.file) {
      res.status(400).json({ error: "No file uploaded" });
      return;
    }

    try {
      let url: string;

      if (isProduction) {
        const bucketName = process.env.KYC_BUCKET_NAME ?? "kyc-documents";
        url = await uploadToSupabase(req.file, bucketName, { publicUrl: false });
      } else {
        const filename = (req.file as Express.Multer.File & { filename: string }).filename;
        url = buildPublicFileUrl(req, "kyc", filename);
      }

      res.json({ url });
    } catch (err) {
      req.log.error({ err }, "KYC document upload failed");
      res.status(500).json({ error: "Upload failed. Please try again." });
    }
  },
);

router.post(
  "/uploads/product-image",
  requireAuth,
  productUpload.single("file"),
  async (req, res): Promise<void> => {
    if (!req.file) {
      res.status(400).json({ error: "No file uploaded" });
      return;
    }

    try {
      let url: string;

      if (isProduction) {
        const bucketName = process.env.PRODUCT_BUCKET_NAME ?? "product-images";
        url = await uploadToSupabase(req.file, bucketName, { publicUrl: true });
      } else {
        const filename = (req.file as Express.Multer.File & { filename: string }).filename;
        url = buildPublicFileUrl(req, "product", filename);
      }

      res.json({ url });
    } catch (err) {
      req.log.error({ err }, "Product image upload failed");
      res.status(500).json({ error: "Upload failed. Please try again." });
    }
  },
);

export default router;
