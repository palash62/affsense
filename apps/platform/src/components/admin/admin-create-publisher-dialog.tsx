"use client";

import { UserPlus } from "lucide-react";
import { AdminCreatePublisherForm } from "@/components/admin/admin-create-publisher-form";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export function AdminCreatePublisherDialog() {
  return (
    <Dialog>
      <DialogTrigger render={<Button className="h-10 gap-2 rounded-xl bg-[var(--theme-primary)] hover:opacity-90" />}>
        <UserPlus className="h-4 w-4" />
        Add Affiliate
      </DialogTrigger>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Create Affiliate Account</DialogTitle>
          <DialogDescription>
            Add a new affiliate, set their status, and share the temporary password after creation.
          </DialogDescription>
        </DialogHeader>
        <AdminCreatePublisherForm />
      </DialogContent>
    </Dialog>
  );
}
