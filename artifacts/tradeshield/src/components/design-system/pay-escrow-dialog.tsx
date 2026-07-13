import { useEffect, useState } from "react";
import { MomoProvider } from "@workspace/api-client-react";
import { formatGhs } from "@/lib/format";
import { inferMomoProvider, normalizeMomoNumber } from "@/lib/phone";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

const PROVIDERS: { value: MomoProvider; label: string }[] = [
  { value: MomoProvider.mtn, label: "MTN" },
  { value: MomoProvider.telecel, label: "Telecel" },
  { value: MomoProvider.airteltigo, label: "AirtelTigo" },
];

export type PayEscrowPayload = {
  momoProvider: MomoProvider;
  momoNumber: string;
};

export function PayEscrowDialog({
  open,
  onOpenChange,
  amount,
  defaultPhone,
  isPaying,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  amount: string;
  defaultPhone?: string;
  isPaying: boolean;
  onSubmit: (payload: PayEscrowPayload) => void;
}) {
  const [provider, setProvider] = useState<MomoProvider>(MomoProvider.mtn);
  const [momoNumber, setMomoNumber] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const seed = defaultPhone?.trim() ?? "";
    setMomoNumber(seed);
    setProvider(seed ? inferMomoProvider(seed) : MomoProvider.mtn);
    setError(null);
  }, [open, defaultPhone]);

  const handleSubmit = () => {
    const normalized = normalizeMomoNumber(momoNumber);
    if (!normalized) {
      setError("Enter a valid Ghana mobile money number.");
      return;
    }
    setError(null);
    onSubmit({ momoProvider: provider, momoNumber: normalized });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Pay with mobile money</DialogTitle>
          <DialogDescription>
            Choose your network and the number that should receive the payment
            prompt. Funds go into escrow until you confirm delivery.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-2">
          <div className="rounded-lg border border-border/60 bg-muted/30 px-4 py-3">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Amount to escrow
            </p>
            <p className="mt-1 font-serif text-2xl font-semibold text-foreground">
              {formatGhs(amount)}
            </p>
          </div>

          <div className="space-y-2">
            <Label>Provider</Label>
            <div className="grid grid-cols-3 gap-2">
              {PROVIDERS.map((option) => {
                const selected = provider === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setProvider(option.value)}
                    className={cn(
                      "min-h-11 rounded-lg border px-2 text-sm font-semibold transition-colors",
                      selected
                        ? "border-cta bg-cta/10 text-foreground"
                        : "border-border/70 bg-background text-muted-foreground hover:bg-muted/40",
                    )}
                    aria-pressed={selected}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="pay-momo-number">Mobile money number</Label>
            <Input
              id="pay-momo-number"
              inputMode="tel"
              autoComplete="tel"
              placeholder="024 123 4567"
              value={momoNumber}
              onChange={(e) => {
                setMomoNumber(e.target.value);
                if (error) setError(null);
              }}
            />
            <p className="text-xs text-muted-foreground">
              You can pay from a different number than your account phone.
            </p>
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isPaying}
          >
            Cancel
          </Button>
          <Button
            variant="cta"
            onClick={handleSubmit}
            disabled={isPaying || !momoNumber.trim()}
          >
            {isPaying ? "Sending…" : `Send payment prompt`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
