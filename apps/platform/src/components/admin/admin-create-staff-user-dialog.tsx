"use client";

import { UserPlus } from "lucide-react";
import { AdminCreateStaffUserForm } from "@/components/admin/admin-create-staff-user-form";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export function AdminCreateStaffUserDialog() {
  return (
    <Dialog>
      <DialogTrigger
        render={
          <Button className="h-10 gap-2 rounded-xl bg-[var(--theme-primary)] hover:opacity-90" />
        }
      >
        <UserPlus className="h-4 w-4" />
        Add Platform Manager
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Add Platform Manager</DialogTitle>
          <DialogDescription>
            Create a staff login with temporary password (emailed) and custom menu access.
          </DialogDescription>
        </DialogHeader>
        <AdminCreateStaffUserForm />
      </DialogContent>
    </Dialog>
  );
}
