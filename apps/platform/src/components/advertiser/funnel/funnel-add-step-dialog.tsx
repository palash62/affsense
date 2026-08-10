"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

type FunnelAddStepDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function FunnelAddStepDialog({ open, onOpenChange }: FunnelAddStepDialogProps) {
  const [name, setName] = useState("");
  const [path, setPath] = useState("");

  function handleClose(next: boolean) {
    if (!next) {
      setName("");
      setPath("");
    }
    onOpenChange(next);
  }

  function handleCreate() {
    toast.info("Custom funnel steps coming in the next phase");
    handleClose(false);
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New step in funnel</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="step-name">
              Name for page <span className="text-red-500">*</span>
            </Label>
            <Input
              id="step-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Name for page"
            />
          </div>
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Label htmlFor="step-path">Path</Label>
              <Badge variant="secondary" className="bg-amber-100 text-amber-800">
                Beta
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">Nested paths are now supported in URLs</p>
            <Input id="step-path" value={path} onChange={(e) => setPath(e.target.value)} placeholder="Path" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => handleClose(false)}>
            Cancel
          </Button>
          <Button onClick={handleCreate} disabled={!name.trim()}>
            Create funnel step
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
