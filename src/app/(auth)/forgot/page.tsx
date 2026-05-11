import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function ForgotPage() {
  return (
    <div className="w-full max-w-[380px]">
      <Card>
        <CardHeader>
          <CardTitle>Reset password</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">
            Password reset flow is not wired up yet — coming in a follow-up
            step. Ask your account manager for a temporary password.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
