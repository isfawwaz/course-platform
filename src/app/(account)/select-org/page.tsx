import Link from "next/link";
import { redirect } from "next/navigation";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";

/** Org picker for users with more than one active membership. */
export default async function SelectOrgPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: memberships } = await supabase
    .from("memberships")
    .select("org_id")
    .eq("user_id", user.id)
    .eq("status", "active");

  const ids = (memberships ?? []).map((m) => m.org_id);
  if (ids.length === 0) redirect("/no-access");

  const { data: orgs } = await supabase
    .from("orgs")
    .select("slug, name")
    .in("id", ids)
    .order("name");

  if (!orgs || orgs.length === 0) redirect("/no-access");
  if (orgs.length === 1) redirect(`/${orgs[0].slug}`);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Choose a studio</CardTitle>
        <CardDescription>
          You belong to more than one. Pick where to go.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {orgs.map((org) => (
          <Button
            key={org.slug}
            asChild
            variant="outline"
            className="w-full justify-start"
          >
            <Link href={`/${org.slug}`}>{org.name}</Link>
          </Button>
        ))}
      </CardContent>
    </Card>
  );
}
