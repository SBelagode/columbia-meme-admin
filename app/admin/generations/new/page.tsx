import { Suspense } from "react";
import { requireSuperadmin } from "@/lib/auth";
import PageHeader from "@/components/admin/PageHeader";
import CreateGenerationForm from "@/components/admin/generations/CreateGenerationForm";

async function NewGenerationContent() {
  await requireSuperadmin();
  return <CreateGenerationForm />;
}

export default function NewGenerationPage() {
  return (
    <>
      <PageHeader
        title="New generation"
        description="Upload an image and generate a caption with Gemini, the same way the consumer app does."
      />
      <Suspense fallback={<p className="text-sm text-zinc-500">Loading…</p>}>
        <NewGenerationContent />
      </Suspense>
    </>
  );
}
