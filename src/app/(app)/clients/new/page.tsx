import { PageHeader } from "@/components/page-header";
import { requireManager } from "@/lib/auth-helpers";

import { NewClientForm } from "./new-client-form";

export default async function NewClientPage() {
  await requireManager();
  return (
    <div className="space-y-6">
      <PageHeader
        title="New client"
        description="Create a new account. You can connect a Meta ad account in the next step."
      />
      <div className="max-w-xl">
        <NewClientForm />
      </div>
    </div>
  );
}
