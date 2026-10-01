"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BuilderImageUpload } from "@/modules/page-builder/components/editor/builder-image-upload";
import type { SerializedTutorial } from "@/services/tutorial.service";
import { TutorialDescriptionEditor } from "@/components/admin/tutorial-description-editor";
import { richTextToPlain } from "@/lib/rich-text";

export type TutorialFormValues = {
  title: string;
  description: string;
  youtubeUrl: string;
  thumbnailUrl: string;
  sortOrder: number;
  isPublished: boolean;
};

type AdminTutorialFormDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  loading: boolean;
  tutorial?: SerializedTutorial | null;
  onSubmit: (values: TutorialFormValues) => void;
};

const emptyValues: TutorialFormValues = {
  title: "",
  description: "",
  youtubeUrl: "",
  thumbnailUrl: "",
  sortOrder: 0,
  isPublished: true,
};

export function AdminTutorialFormDialog({
  open,
  onOpenChange,
  loading,
  tutorial,
  onSubmit,
}: AdminTutorialFormDialogProps) {
  const [values, setValues] = useState<TutorialFormValues>(emptyValues);
  const isEdit = Boolean(tutorial);

  useEffect(() => {
    if (!open) return;
    if (tutorial) {
      setValues({
        title: tutorial.title,
        description: tutorial.description,
        youtubeUrl: tutorial.youtubeUrl,
        thumbnailUrl: tutorial.thumbnailUrl,
        sortOrder: tutorial.sortOrder,
        isPublished: tutorial.isPublished,
      });
    } else {
      setValues(emptyValues);
    }
  }, [open, tutorial]);

  function handleSubmit() {
    onSubmit(values);
  }

  const canSubmit =
    values.title.trim().length >= 2 &&
    richTextToPlain(values.description).length >= 1 &&
    values.youtubeUrl.trim().length >= 1 &&
    values.thumbnailUrl.trim().length >= 1;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit tutorial" : "Add tutorial"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="tutorial-title">Title</Label>
            <Input
              id="tutorial-title"
              value={values.title}
              onChange={(e) => setValues((prev) => ({ ...prev, title: e.target.value }))}
              placeholder="How to create your first campaign"
            />
          </div>

          <div className="space-y-2">
            <Label>Description</Label>
            <TutorialDescriptionEditor
              key={tutorial?.id ?? "new"}
              value={values.description}
              onChange={(html) => setValues((prev) => ({ ...prev, description: html }))}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="tutorial-youtube">YouTube URL</Label>
            <Input
              id="tutorial-youtube"
              value={values.youtubeUrl}
              onChange={(e) => setValues((prev) => ({ ...prev, youtubeUrl: e.target.value }))}
              placeholder="https://www.youtube.com/watch?v=..."
            />
          </div>

          <div className="space-y-2">
            <Label>Thumbnail</Label>
            <BuilderImageUpload
              value={values.thumbnailUrl}
              onChange={(url) => setValues((prev) => ({ ...prev, thumbnailUrl: url }))}
              onClear={() => setValues((prev) => ({ ...prev, thumbnailUrl: "" }))}
              showUrlInput={false}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="tutorial-sort">Sort order</Label>
            <Input
              id="tutorial-sort"
              type="number"
              min={0}
              max={9999}
              value={values.sortOrder}
              onChange={(e) =>
                setValues((prev) => ({
                  ...prev,
                  sortOrder: Number.isFinite(Number(e.target.value)) ? Number(e.target.value) : 0,
                }))
              }
            />
          </div>

          <div className="flex items-center gap-2">
            <Checkbox
              id="tutorial-published"
              checked={values.isPublished}
              onCheckedChange={(checked) =>
                setValues((prev) => ({ ...prev, isPublished: checked === true }))
              }
            />
            <Label htmlFor="tutorial-published" className="cursor-pointer font-normal">
              Published (visible to advertisers)
            </Label>
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t border-border pt-4">
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!canSubmit || loading}>
            {isEdit ? "Save changes" : "Add tutorial"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
