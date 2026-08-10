import { Suspense } from "react";
import { PublisherRegisterForm } from "./publisher-register-form";

export default function PublisherRegisterPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center text-muted-foreground">Loading...</div>}>
      <PublisherRegisterForm />
    </Suspense>
  );
}
