import { useState, useRef, type ChangeEvent } from "react";
import { Link } from "wouter";
import { ShieldCheck, Upload, CheckCircle2, AlertCircle, ArrowLeft, ArrowRight } from "lucide-react";
import {
  useGetKycStatus,
  useUploadKycDocument,
  useSubmitKyc,
  getGetKycStatusQueryKey,
  getGetCurrentUserQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { getErrorMessage } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { PageHeader } from "@/components/design-system";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const GHANA_CARD_REGEX = /^GHA-\d{9}-\d$/;

function formatGhanaCard(raw: string): string {
  // Strip everything that isn't alphanumeric or dash, uppercase
  const clean = raw.toUpperCase().replace(/[^A-Z0-9-]/g, "");
  return clean;
}

interface FilePreview {
  url: string;
  name: string;
  uploading: boolean;
  uploadedUrl: string | null;
  error: string | null;
}

function emptyPreview(): FilePreview {
  return { url: "", name: "", uploading: false, uploadedUrl: null, error: null };
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

interface DocumentUploadProps {
  label: string;
  hint: string;
  preview: FilePreview;
  onFileChange: (file: File) => void;
  inputRef: React.RefObject<HTMLInputElement | null>;
}

function DocumentUpload({ label, hint, preview, onFileChange, inputRef }: DocumentUploadProps) {
  function handleChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) onFileChange(file);
  }

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <p className="text-xs text-muted-foreground">{hint}</p>
      <div
        className="relative flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border bg-muted/30 p-6 transition-colors hover:bg-muted/50 cursor-pointer"
        onClick={() => inputRef.current?.click()}
      >
        {preview.url ? (
          <img
            src={preview.url}
            alt={label}
            className="max-h-32 max-w-full rounded object-contain"
          />
        ) : (
          <>
            <Upload className="h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Click to upload</p>
            <p className="text-xs text-muted-foreground">JPEG, PNG, WebP or PDF · max 5 MB</p>
          </>
        )}
        {preview.uploading && (
          <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-background/70">
            <p className="text-sm font-medium">Uploading…</p>
          </div>
        )}
        {preview.uploadedUrl && !preview.uploading && (
          <CheckCircle2 className="absolute right-2 top-2 h-5 w-5 text-emerald-500" />
        )}
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,application/pdf"
          className="hidden"
          onChange={handleChange}
        />
      </div>
      {preview.error && (
        <p className="text-xs font-medium text-destructive">{preview.error}</p>
      )}
      {preview.name && !preview.error && (
        <p className="text-xs text-muted-foreground">{preview.name}</p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// States
// ---------------------------------------------------------------------------

function PendingState({ ghanaCardNumber }: { ghanaCardNumber?: string | null }) {
  return (
    <div className="flex flex-col items-center gap-6 py-8 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/30">
        <ShieldCheck className="h-8 w-8 text-amber-600 dark:text-amber-400" />
      </div>
      <div className="space-y-2">
        <h2 className="text-xl font-semibold">Under review</h2>
        <p className="max-w-sm text-muted-foreground text-sm leading-relaxed">
          We're reviewing your documents — usually done within 24 hours. You can still use the
          marketplace normally while you wait.
        </p>
      </div>
      {ghanaCardNumber && (
        <p className="text-sm text-muted-foreground">
          Submitted Ghana Card: <span className="font-mono font-medium">{ghanaCardNumber}</span>
        </p>
      )}
      <Button asChild variant="outline">
        <Link href="/">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to marketplace
        </Link>
      </Button>
    </div>
  );
}

function ApprovedState() {
  return (
    <div className="flex flex-col items-center gap-6 py-8 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/30">
        <ShieldCheck className="h-8 w-8 text-emerald-600 dark:text-emerald-400" />
      </div>
      <div className="space-y-2">
        <h2 className="text-xl font-semibold">Your account is verified</h2>
        <p className="max-w-sm text-muted-foreground text-sm">
          You now have a Verified badge on your profile and can place orders above GHS 10,000.
        </p>
      </div>
      <Button asChild variant="cta">
        <Link href="/">Go to marketplace</Link>
      </Button>
    </div>
  );
}

function RejectedState({
  reason,
  onResubmit,
}: {
  reason?: string | null;
  onResubmit: () => void;
}) {
  return (
    <div className="flex flex-col items-center gap-6 py-8 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
        <AlertCircle className="h-8 w-8 text-destructive" />
      </div>
      <div className="space-y-3">
        <h2 className="text-xl font-semibold">We couldn't verify your documents</h2>
        {reason && (
          <div className="rounded-lg border border-destructive/20 bg-destructive/5 px-4 py-3 text-left">
            <p className="text-xs font-medium text-muted-foreground mb-1">Here's what we found:</p>
            <p className="text-sm text-foreground">{reason}</p>
          </div>
        )}
        <p className="max-w-sm text-muted-foreground text-sm">
          Please fix the issue above and resubmit your documents.
        </p>
      </div>
      <Button variant="cta" onClick={onResubmit}>
        Resubmit documents
      </Button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Form — Step 1: Card number, Step 2: Upload photos
// ---------------------------------------------------------------------------

function SubmitForm({ onSuccess }: { onSuccess: () => void }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [step, setStep] = useState<1 | 2>(1);
  const [ghanaCard, setGhanaCard] = useState("");
  const [ghanaCardError, setGhanaCardError] = useState<string | null>(null);

  const [frontPreview, setFrontPreview] = useState<FilePreview>(emptyPreview());
  const [backPreview, setBackPreview] = useState<FilePreview>(emptyPreview());

  const frontRef = useRef<HTMLInputElement>(null);
  const backRef = useRef<HTMLInputElement>(null);

  const uploadMut = useUploadKycDocument();
  const submitMut = useSubmitKyc({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetKycStatusQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetCurrentUserQueryKey() });
        onSuccess();
      },
      onError: (err) => {
        toast({
          title: "Submission failed",
          description: getErrorMessage(err, "Please try again"),
          variant: "destructive",
        });
      },
    },
  });

  function handleCardInput(e: ChangeEvent<HTMLInputElement>) {
    setGhanaCard(formatGhanaCard(e.target.value));
    if (ghanaCardError) setGhanaCardError(null);
  }

  function goToStep2() {
    if (!GHANA_CARD_REGEX.test(ghanaCard)) {
      setGhanaCardError("Enter a valid Ghana Card number (GHA-XXXXXXXXX-X)");
      return;
    }
    setStep(2);
  }

  async function handleFileUpload(
    file: File,
    setPreview: (fn: (p: FilePreview) => FilePreview) => void,
  ) {
    const objectUrl = URL.createObjectURL(file);
    setPreview((p) => ({ ...p, url: objectUrl, name: file.name, uploading: true, error: null }));

    const formData = new FormData();
    formData.append("file", file);

    try {
      const result = await uploadMut.mutateAsync({ data: formData });
      setPreview((p) => ({ ...p, uploading: false, uploadedUrl: result.url }));
    } catch (err) {
      setPreview((p) => ({
        ...p,
        uploading: false,
        error: getErrorMessage(err, "Upload failed. Please try again."),
      }));
    }
  }

  function handleSubmit() {
    if (!frontPreview.uploadedUrl) {
      toast({ title: "Missing document", description: "Upload the front of your Ghana Card", variant: "destructive" });
      return;
    }
    if (!backPreview.uploadedUrl) {
      toast({ title: "Missing document", description: "Upload the back of your Ghana Card", variant: "destructive" });
      return;
    }
    submitMut.mutate({
      data: {
        ghanaCardNumber: ghanaCard,
        docUrls: {
          ghana_card_front: frontPreview.uploadedUrl,
          ghana_card_back: backPreview.uploadedUrl,
        },
      },
    });
  }

  return (
    <div className="space-y-6">
      {/* Step indicator */}
      <div className="flex items-center gap-3">
        {([1, 2] as const).map((s) => (
          <div key={s} className="flex items-center gap-2">
            <div
              className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold transition-colors ${
                step === s
                  ? "bg-primary text-primary-foreground"
                  : step > s
                    ? "bg-emerald-500 text-white"
                    : "bg-muted text-muted-foreground"
              }`}
            >
              {step > s ? <CheckCircle2 className="h-4 w-4" /> : s}
            </div>
            <span className={`text-sm ${step === s ? "font-medium" : "text-muted-foreground"}`}>
              {s === 1 ? "Card number" : "Upload photos"}
            </span>
            {s < 2 && <div className="h-px w-6 bg-border" />}
          </div>
        ))}
      </div>

      {step === 1 && (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="ghana-card">Ghana Card number</Label>
            <Input
              id="ghana-card"
              placeholder="GHA-123456789-0"
              value={ghanaCard}
              onChange={handleCardInput}
              className="font-mono"
              maxLength={15}
            />
            {ghanaCardError && (
              <p className="text-xs font-medium text-destructive">{ghanaCardError}</p>
            )}
            <p className="text-xs text-muted-foreground">Format: GHA-XXXXXXXXX-X</p>
          </div>
          <p className="rounded-lg bg-muted/50 px-4 py-3 text-xs text-muted-foreground leading-relaxed">
            Upload the Ghana Card of the person managing this account. This does not need to be
            the business owner.
          </p>
          <Button variant="cta" className="w-full" onClick={goToStep2}>
            Continue
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-5">
          <DocumentUpload
            label="Ghana Card — front"
            hint="The side with your photo and name"
            preview={frontPreview}
            onFileChange={(f) => handleFileUpload(f, setFrontPreview)}
            inputRef={frontRef}
          />
          <DocumentUpload
            label="Ghana Card — back"
            hint="The side with the QR code and barcode"
            preview={backPreview}
            onFileChange={(f) => handleFileUpload(f, setBackPreview)}
            inputRef={backRef}
          />

          <div className="flex gap-3">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => setStep(1)}
              disabled={submitMut.isPending}
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Button>
            <Button
              variant="cta"
              className="flex-1"
              onClick={handleSubmit}
              disabled={
                submitMut.isPending ||
                frontPreview.uploading ||
                backPreview.uploading ||
                !frontPreview.uploadedUrl ||
                !backPreview.uploadedUrl
              }
            >
              {submitMut.isPending ? "Submitting…" : "Submit for review"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function Verify() {
  const { data, isLoading } = useGetKycStatus();
  const [forceForm, setForceForm] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const kycStatus = submitted ? "pending" : (data?.kycStatus ?? "none");

  return (
    <div className="min-h-screen bg-muted/30 flex flex-col items-center py-12 px-4">
      <div className="w-full max-w-lg">
        <PageHeader
          title="Get Verified"
          description="Upload your Ghana Card to earn a Verified badge and unlock high-value orders."
          className="mb-6"
        />

        <Card className="shadow-ts-md border-border/80">
          <CardHeader>
            <CardTitle className="font-sans text-base">Identity verification</CardTitle>
            <CardDescription>
              Your documents are reviewed by our team and kept secure. This usually takes under 24
              hours.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="py-8 text-center text-sm text-muted-foreground">Loading…</div>
            ) : kycStatus === "approved" ? (
              <ApprovedState />
            ) : kycStatus === "pending" && !forceForm ? (
              <PendingState ghanaCardNumber={data?.ghanaCardNumber} />
            ) : kycStatus === "rejected" && !forceForm ? (
              <RejectedState
                reason={data?.kycRejectionReason}
                onResubmit={() => setForceForm(true)}
              />
            ) : (
              <SubmitForm onSuccess={() => { setSubmitted(true); setForceForm(false); }} />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
