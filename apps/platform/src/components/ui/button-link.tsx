"use client";

import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { VariantProps } from "class-variance-authority";
import { useNavigationPending } from "@/components/layout/navigation-pending";

type ButtonLinkProps = VariantProps<typeof buttonVariants> & {
  href: string;
  className?: string;
  children: React.ReactNode;
  target?: React.HTMLAttributeAnchorTarget;
  rel?: string;
};

export function ButtonLink({
  href,
  className,
  children,
  variant = "default",
  size = "default",
  target,
  rel,
}: ButtonLinkProps) {
  const { startNavigation } = useNavigationPending();

  return (
    <Link
      href={href}
      prefetch={target !== "_blank"}
      target={target}
      rel={rel}
      onClick={() => startNavigation()}
      className={cn(buttonVariants({ variant, size }), className)}
    >
      {children}
    </Link>
  );
}
