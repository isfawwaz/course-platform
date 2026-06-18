import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { logout } from "@/lib/auth/actions";

/** Authenticated, but the account isn't linked to any studio yet. */
export default function NoAccessPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>No studio access yet</CardTitle>
        <CardDescription>
          Your account isn&apos;t linked to a studio. Access is granted by a studio
          admin — once you&apos;re invited, your courses will appear here.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={logout}>
          <Button type="submit" variant="outline" className="w-full">
            Sign out
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
