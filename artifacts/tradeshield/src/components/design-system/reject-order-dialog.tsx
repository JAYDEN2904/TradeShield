import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";

export function RejectOrderDialog({
  onReject,
  isRejecting,
  triggerClassName,
}: {
  onReject: (reason?: string) => void;
  isRejecting: boolean;
  triggerClassName?: string;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          className={triggerClassName ?? "w-full text-destructive hover:text-destructive"}
          disabled={isRejecting}
        >
          Reject order
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reject this order?</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <p className="text-sm text-muted-foreground">
            The buyer will be notified. You can optionally share why the order
            cannot be fulfilled.
          </p>
          <Textarea
            placeholder="Reason (optional) — e.g. out of stock this week"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            disabled={isRejecting}
            onClick={() => {
              onReject(reason.trim() || undefined);
              setOpen(false);
              setReason("");
            }}
          >
            Reject order
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
