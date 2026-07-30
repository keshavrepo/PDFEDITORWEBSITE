import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const user = await getSession();
  
  if (!user) {
    redirect("/login");
  }

  const getInitials = (name?: string | null, email?: string) => {
    if (name) {
      return name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2);
    }
    return email?.slice(0, 2).toUpperCase() || "U";
  };

  return (
    <>
      <Navbar user={user} />
      
      <main>
        {/* Header */}
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-24 pb-12">
          <h1 className="text-3xl md:text-4xl font-bold">
            Settings
          </h1>
        </section>

        <section className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pb-24">
          <div className="space-y-12">
            {/* Profile */}
            <div>
              <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-6">
                Profile
              </h2>
              <Card className="p-8">
                <div className="space-y-6">
                  <div className="flex items-center space-x-4">
                    <Avatar className="w-16 h-16">
                      <AvatarImage src={user.avatar || undefined} />
                      <AvatarFallback className="text-xl">
                        {getInitials(user.name, user.email)}
                      </AvatarFallback>
                    </Avatar>
                    <Button variant="outline" size="sm">
                      Change photo
                    </Button>
                  </div>

                  <div className="grid gap-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Name</label>
                      <Input defaultValue={user.name || ""} placeholder="Your name" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Email</label>
                      <Input defaultValue={user.email} disabled />
                    </div>
                  </div>

                  <div className="flex justify-end space-x-3">
                    <Button variant="outline">Cancel</Button>
                    <Button>Save changes</Button>
                  </div>
                </div>
              </Card>
            </div>

            {/* Security */}
            <div>
              <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-6">
                Security
              </h2>
              <Card className="p-8">
                <div className="space-y-6">
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Current password</label>
                      <Input type="password" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">New password</label>
                      <Input type="password" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Confirm password</label>
                      <Input type="password" />
                    </div>
                  </div>

                  <div className="flex justify-end space-x-3">
                    <Button variant="outline">Cancel</Button>
                    <Button>Update password</Button>
                  </div>
                </div>
              </Card>
            </div>

            {/* Billing */}
            <div>
              <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-6">
                Billing
              </h2>
              <Card className="p-8">
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium capitalize">{user.plan || "Free"} Plan</p>
                      <p className="text-sm text-muted-foreground">
                        {user.plan === "free"
                          ? "Upgrade to unlock premium features"
                          : "Full access to all features"}
                      </p>
                    </div>
                    {user.plan === "free" && (
                      <Button>Upgrade</Button>
                    )}
                  </div>
                </div>
              </Card>
            </div>

            {/* Danger Zone */}
            <div>
              <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-6">
                Danger Zone
              </h2>
              <Card className="p-8 border-destructive">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Delete account</p>
                    <p className="text-sm text-muted-foreground">
                      Permanently delete your account and all data
                    </p>
                  </div>
                  <Button variant="destructive">
                    Delete
                  </Button>
                </div>
              </Card>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </>
  );
}
