"use client";

import { ChangeEvent, FormEvent, useState } from "react";
import Link from "next/link";
import { signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { BillingButton } from "@/components/billing-button";

interface SettingsFormsProps {
  user: {
    name?: string | null;
    email: string;
    avatar?: string | null;
    plan: string;
  };
  hasPassword: boolean;
  billingStatus?: string;
}

function getInitials(name?: string | null, email?: string) {
  if (name) {
    return name
      .split(" ")
      .map((part) => part[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  }
  return email?.slice(0, 2).toUpperCase() || "U";
}

export function SettingsForms({
  user,
  hasPassword,
  billingStatus,
}: SettingsFormsProps) {
  const router = useRouter();
  const [name, setName] = useState(user.name || "");
  const [avatar, setAvatar] = useState<string | null>(user.avatar || null);
  const [profileBusy, setProfileBusy] = useState(false);
  const [profileStatus, setProfileStatus] = useState<string | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [passwordBusy, setPasswordBusy] = useState(false);
  const [passwordStatus, setPasswordStatus] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deletionConfirmation, setDeletionConfirmation] = useState("");
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  function selectAvatar(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    setProfileError(null);
    if (!file) return;
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
      setProfileError("Choose a PNG, JPEG, or WebP image");
      return;
    }
    if (file.size > 1_000_000) {
      setProfileError("Profile photo must be smaller than 1MB");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => setAvatar(String(reader.result));
    reader.onerror = () => setProfileError("Unable to read that image");
    reader.readAsDataURL(file);
  }

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setProfileBusy(true);
    setProfileError(null);
    setProfileStatus(null);

    try {
      const response = await fetch("/api/account/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, avatar }),
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(result.error || "Unable to update profile");
      setProfileStatus("Profile saved");
      router.refresh();
    } catch (error) {
      setProfileError(error instanceof Error ? error.message : "Unable to update profile");
    } finally {
      setProfileBusy(false);
    }
  }

  async function updatePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPasswordBusy(true);
    setPasswordError(null);
    setPasswordStatus(null);
    const form = event.currentTarget;
    const formData = new FormData(form);
    const newPassword = String(formData.get("newPassword") || "");
    if (newPassword !== formData.get("confirmPassword")) {
      setPasswordError("New passwords do not match");
      setPasswordBusy(false);
      return;
    }

    try {
      const response = await fetch("/api/account/password", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPassword: formData.get("currentPassword") || undefined,
          newPassword,
        }),
      });
      const result = (await response.json()) as { error?: string; message?: string };
      if (!response.ok) throw new Error(result.error || "Unable to update password");
      form.reset();
      setPasswordStatus(result.message || "Password updated");
    } catch (error) {
      setPasswordError(error instanceof Error ? error.message : "Unable to update password");
    } finally {
      setPasswordBusy(false);
    }
  }

  async function deleteAccount() {
    setDeleteBusy(true);
    setDeleteError(null);
    try {
      const response = await fetch("/api/account", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmation: deletionConfirmation }),
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(result.error || "Unable to delete account");
      await signOut({ callbackUrl: "/" });
    } catch (error) {
      setDeleteError(error instanceof Error ? error.message : "Unable to delete account");
      setDeleteBusy(false);
    }
  }

  return (
    <div className="space-y-12">
      {billingStatus === "success" && (
        <p
          role="status"
          className="rounded-lg border border-primary/20 bg-primary/10 p-4 text-sm text-primary"
        >
          Checkout completed. Your plan will update as soon as payment is confirmed.
        </p>
      )}
      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-6">
          Profile
        </h2>
        <Card className="p-8">
          <form className="space-y-6" onSubmit={saveProfile}>
            <div className="flex flex-wrap items-center gap-4">
              <Avatar className="w-16 h-16">
                <AvatarImage src={avatar || undefined} />
                <AvatarFallback className="text-xl">
                  {getInitials(name, user.email)}
                </AvatarFallback>
              </Avatar>
              <label>
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="sr-only"
                  onChange={selectAvatar}
                  disabled={profileBusy}
                />
                <Button variant="outline" size="sm" type="button" asChild>
                  <span>Change photo</span>
                </Button>
              </label>
              {avatar && (
                <Button
                  variant="ghost"
                  size="sm"
                  type="button"
                  onClick={() => setAvatar(null)}
                >
                  Remove
                </Button>
              )}
            </div>

            <div className="grid gap-4">
              <div className="space-y-2">
                <label htmlFor="profile-name" className="text-sm font-medium">Name</label>
                <Input
                  id="profile-name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Your name"
                  minLength={2}
                  maxLength={100}
                  required
                  disabled={profileBusy}
                />
              </div>
              <div className="space-y-2">
                <label htmlFor="profile-email" className="text-sm font-medium">Email</label>
                <Input id="profile-email" value={user.email} disabled />
              </div>
            </div>

            {profileError && <p role="alert" className="text-sm text-destructive">{profileError}</p>}
            {profileStatus && <p role="status" className="text-sm text-primary">{profileStatus}</p>}
            <div className="flex justify-end space-x-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setName(user.name || "");
                  setAvatar(user.avatar || null);
                  setProfileError(null);
                  setProfileStatus(null);
                }}
                disabled={profileBusy}
              >
                Cancel
              </Button>
              <Button disabled={profileBusy}>
                {profileBusy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save changes
              </Button>
            </div>
          </form>
        </Card>
      </section>

      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-6">
          Security
        </h2>
        <Card className="p-8">
          <form className="space-y-6" onSubmit={updatePassword}>
            <div className="space-y-4">
              {hasPassword && (
                <div className="space-y-2">
                  <label htmlFor="current-password" className="text-sm font-medium">
                    Current password
                  </label>
                  <Input
                    id="current-password"
                    name="currentPassword"
                    type="password"
                    autoComplete="current-password"
                    required
                    maxLength={128}
                    disabled={passwordBusy}
                  />
                </div>
              )}
              <div className="space-y-2">
                <label htmlFor="new-password" className="text-sm font-medium">New password</label>
                <Input
                  id="new-password"
                  name="newPassword"
                  type="password"
                  autoComplete="new-password"
                  required
                  minLength={8}
                  maxLength={128}
                  disabled={passwordBusy}
                />
              </div>
              <div className="space-y-2">
                <label htmlFor="confirm-password" className="text-sm font-medium">
                  Confirm password
                </label>
                <Input
                  id="confirm-password"
                  name="confirmPassword"
                  type="password"
                  autoComplete="new-password"
                  required
                  minLength={8}
                  maxLength={128}
                  disabled={passwordBusy}
                />
              </div>
            </div>
            {!hasPassword && (
              <p className="text-xs text-muted-foreground">
                Your account uses social sign-in. Create a password to also sign in by email.
              </p>
            )}
            {passwordError && <p role="alert" className="text-sm text-destructive">{passwordError}</p>}
            {passwordStatus && <p role="status" className="text-sm text-primary">{passwordStatus}</p>}
            <div className="flex justify-end">
              <Button disabled={passwordBusy}>
                {passwordBusy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {hasPassword ? "Update password" : "Create password"}
              </Button>
            </div>
          </form>
        </Card>
      </section>

      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-6">
          Billing
        </h2>
        <Card className="p-8">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="font-medium capitalize">{user.plan || "Free"} Plan</p>
              <p className="text-sm text-muted-foreground">
                {user.plan === "free"
                  ? "Upgrade to unlock premium features"
                  : "Manage your subscription and payment method"}
              </p>
            </div>
            {user.plan === "free" ? (
              <Button asChild>
                <Link href="/pricing">Upgrade</Link>
              </Button>
            ) : (
              <BillingButton mode="portal">Manage billing</BillingButton>
            )}
          </div>
        </Card>
      </section>

      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-6">
          Danger Zone
        </h2>
        <Card className="p-8 border-destructive">
          {!confirmingDelete ? (
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="font-medium">Delete account</p>
                <p className="text-sm text-muted-foreground">
                  Permanently delete your account and all data
                </p>
              </div>
              <Button variant="destructive" onClick={() => setConfirmingDelete(true)}>
                Delete
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <p className="font-medium">This action cannot be undone</p>
                <p className="text-sm text-muted-foreground">
                  Type DELETE to permanently remove your account and cancel any subscription.
                </p>
              </div>
              <Input
                value={deletionConfirmation}
                onChange={(event) => setDeletionConfirmation(event.target.value)}
                placeholder="DELETE"
                aria-label="Type DELETE to confirm"
                disabled={deleteBusy}
              />
              {deleteError && <p role="alert" className="text-sm text-destructive">{deleteError}</p>}
              <div className="flex justify-end gap-3">
                <Button
                  variant="outline"
                  onClick={() => {
                    setConfirmingDelete(false);
                    setDeletionConfirmation("");
                    setDeleteError(null);
                  }}
                  disabled={deleteBusy}
                >
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  onClick={deleteAccount}
                  disabled={deleteBusy || deletionConfirmation !== "DELETE"}
                >
                  {deleteBusy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Permanently delete
                </Button>
              </div>
            </div>
          )}
        </Card>
      </section>
    </div>
  );
}
