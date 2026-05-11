import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";

export default function ReportsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Reports"
        description="Generated .docx reports — coming in step 10."
      />
      <Card>
        <CardContent className="text-muted-foreground py-12 text-center text-sm">
          Report history will appear here.
        </CardContent>
      </Card>
    </div>
  );
}
