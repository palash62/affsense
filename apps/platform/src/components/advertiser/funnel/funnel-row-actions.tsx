"use client";

import { Copy, Eye, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { buttonVariants } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

type FunnelRowActionsProps = {
  funnelId: string;
  slug: string;
  duplicating?: boolean;
  onDuplicate: () => void;
  onArchive: () => void;
};

export function FunnelRowActions({
  funnelId,
  slug,
  duplicating = false,
  onDuplicate,
  onArchive,
}: FunnelRowActionsProps) {
  const router = useRouter();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(buttonVariants({ variant: "ghost", size: "icon" }), "h-8 w-8 text-muted-foreground")}
      >
        <MoreHorizontal className="h-4 w-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuItem onClick={() => router.push(`/advertiser/optin-funnels/${funnelId}`)}>
          <Pencil className="mr-2 h-4 w-4" />
          Open funnel
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() =>
            window.open(`/o/${slug}?preview=1&frame=1`, "_blank", "noopener,noreferrer")
          }
        >
          <Eye className="mr-2 h-4 w-4" />
          Preview
        </DropdownMenuItem>
        <DropdownMenuItem disabled={duplicating} onClick={onDuplicate}>
          <Copy className="mr-2 h-4 w-4" />
          Duplicate
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem className="text-red-600 focus:text-red-600" onClick={onArchive}>
          <Trash2 className="mr-2 h-4 w-4" />
          Archive
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
