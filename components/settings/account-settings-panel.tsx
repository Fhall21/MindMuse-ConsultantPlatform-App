"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { authClient } from "@/lib/auth/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const MIN_PASSWORD_LENGTH = 8;

interface AccountResponse {
  email: string;
  displayName: string;
  fullName: string;
}

interface ErrorResponse {
  detail?: string;
}

export function AccountSettingsPanel() {
  const [isLoading, setIsLoading] = useState(true);
  const [currentEmail, setCurrentEmail] = useState("");
  const [fullNameValue, setFullNameValue] = useState("");
  const [displayNameValue, setDisplayNameValue] = useState("");
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [emailValue, setEmailValue] = useState("");
  const [pendingEmail, setPendingEmail] = useState<string | null>(null);
  const [isSavingEmail, setIsSavingEmail] = useState(false);
  const [currentPasswordValue, setCurrentPasswordValue] = useState("");
  const [passwordValue, setPasswordValue] = useState("");
  const [confirmPasswordValue, setConfirmPasswordValue] = useState("");
  const [isSavingPassword, setIsSavingPassword] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function loadUser() {
      try {
        const response = await fetch("/api/account", {
          cache: "no-store",
        });

        const payload = (await response.json()) as AccountResponse | ErrorResponse;

        if (!isMounted) {
          return;
        }

        if (!response.ok) {
          const errorPayload = payload as ErrorResponse;
          toast.error(errorPayload.detail ?? "Failed to load your account.");
          setIsLoading(false);
          return;
        }

        const account = payload as AccountResponse;
        setCurrentEmail(account.email);
        setFullNameValue(account.fullName);
        setDisplayNameValue(account.displayName);
        setEmailValue(account.email);
        setIsLoading(false);
      } catch {
        if (!isMounted) {
          return;
        }

        toast.error("Failed to load your account.");
        setIsLoading(false);
      }
    }

    void loadUser();

    return () => {
      isMounted = false;
    };
  }, []);

  const normalizedEmail = emailValue.trim().toLowerCase();
  const normalizedFullName = fullNameValue.trim();
  const normalizedDisplayName = displayNameValue.trim();
  const isEmailChanged = normalizedEmail.length > 0 && normalizedEmail !== currentEmail.toLowerCase();
  const hasProfileDetails = normalizedDisplayName.length > 0 || normalizedFullName.length > 0;

  async function handleProfileUpdate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setIsSavingProfile(true);

    const response = await fetch("/api/account", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        displayName: normalizedDisplayName,
        fullName: normalizedFullName,
      }),
    });

    setIsSavingProfile(false);

    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as { detail?: string } | null;
      toast.error(payload?.detail ?? "Failed to save your profile.");
      return;
    }

    toast.success("Profile updated.");
  }

  async function handleEmailUpdate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!isEmailChanged) {
      return;
    }

    setIsSavingEmail(true);

    const { error } = await authClient.changeEmail({
      newEmail: normalizedEmail,
    });

    setIsSavingEmail(false);

    if (error) {
      toast.error(error.message);
      return;
    }

    setCurrentEmail(normalizedEmail);
    setEmailValue(normalizedEmail);
    setPendingEmail(null);
    toast.success("Email updated.");
  }

  async function handlePasswordUpdate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (passwordValue.length < MIN_PASSWORD_LENGTH) {
      toast.error(`Use at least ${MIN_PASSWORD_LENGTH} characters for the new password.`);
      return;
    }

    if (passwordValue !== confirmPasswordValue) {
      toast.error("Password confirmation does not match.");
      return;
    }

    if (currentPasswordValue.length === 0) {
      toast.error("Enter your current password before saving a new one.");
      return;
    }

    setIsSavingPassword(true);

    const { error } = await authClient.changePassword({
      currentPassword: currentPasswordValue,
      newPassword: passwordValue,
      revokeOtherSessions: false,
    });

    setIsSavingPassword(false);

    if (error) {
      toast.error(error.message);
      return;
    }

    setCurrentPasswordValue("");
    setPasswordValue("");
    setConfirmPasswordValue("");
    toast.success("Password updated.");
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/80 pb-4">
        <div className="space-y-1">
          <p className="text-sm font-medium">Account</p>
          <p className="text-sm text-muted-foreground">
            {isLoading ? "Loading account details…" : currentEmail || "No email found"}
          </p>
        </div>
        <Badge variant="outline">{isLoading ? "Loading" : "Signed in"}</Badge>
      </div>

      <section className="space-y-4 border-t border-border/80 pt-5">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold tracking-tight">Profile</h2>
          <p className="text-sm text-muted-foreground">
            Set the name shown around the workspace.
          </p>
        </div>

        <form className="space-y-4" onSubmit={handleProfileUpdate}>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="settings-display-name">Preferred name</Label>
              <Input
                id="settings-display-name"
                value={displayNameValue}
                onChange={(event) => setDisplayNameValue(event.target.value)}
                disabled={isLoading || isSavingProfile}
                placeholder="How you want to be addressed"
                autoComplete="nickname"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="settings-full-name">Full name</Label>
              <Input
                id="settings-full-name"
                value={fullNameValue}
                onChange={(event) => setFullNameValue(event.target.value)}
                disabled={isLoading || isSavingProfile}
                placeholder="Your full name"
                autoComplete="name"
              />
            </div>
          </div>

          {!hasProfileDetails ? (
            <p className="text-sm text-muted-foreground">Optional.</p>
          ) : null}

          <Button type="submit" disabled={isLoading || isSavingProfile}>
            {isSavingProfile ? "Saving..." : "Save Profile"}
          </Button>
        </form>
      </section>

      <section className="space-y-4 border-t border-border/80 pt-5">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold tracking-tight">Email</h2>
          <p className="text-sm text-muted-foreground">
            Update the address used for sign-in.
          </p>
        </div>

        <form className="space-y-4" onSubmit={handleEmailUpdate}>
          <div className="space-y-2">
            <Label htmlFor="settings-email">Email address</Label>
            <Input
              id="settings-email"
              type="email"
              value={emailValue}
              onChange={(event) => setEmailValue(event.target.value)}
              disabled={isLoading || isSavingEmail}
              autoComplete="email"
            />
          </div>

          {pendingEmail ? (
            <p className="text-sm text-muted-foreground">
              Confirmation is pending for <span className="font-medium text-foreground">{pendingEmail}</span>.
            </p>
          ) : null}

          <div className="flex flex-wrap gap-3">
            <Button type="submit" disabled={!isEmailChanged || isLoading || isSavingEmail}>
              {isSavingEmail ? "Saving..." : "Update Email"}
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={isLoading || isSavingEmail}
              onClick={() => {
                setEmailValue(currentEmail);
                setPendingEmail(null);
              }}
            >
              Reset
            </Button>
          </div>
        </form>
      </section>

      <section className="space-y-4 border-t border-border/80 pt-5">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold tracking-tight">Password</h2>
          <p className="text-sm text-muted-foreground">
            Use your current password to set a new one.
          </p>
        </div>

        <form className="space-y-4" onSubmit={handlePasswordUpdate}>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="settings-password-current">Current password</Label>
              <Input
                id="settings-password-current"
                type="password"
                value={currentPasswordValue}
                onChange={(event) => setCurrentPasswordValue(event.target.value)}
                disabled={isSavingPassword}
                autoComplete="current-password"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="settings-password">New password</Label>
              <Input
                id="settings-password"
                type="password"
                value={passwordValue}
                onChange={(event) => setPasswordValue(event.target.value)}
                disabled={isSavingPassword}
                autoComplete="new-password"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="settings-password-confirm">Confirm password</Label>
              <Input
                id="settings-password-confirm"
                type="password"
                value={confirmPasswordValue}
                onChange={(event) => setConfirmPasswordValue(event.target.value)}
                disabled={isSavingPassword}
                autoComplete="new-password"
              />
            </div>
          </div>

          <p className="text-sm text-muted-foreground">
            Minimum length: {MIN_PASSWORD_LENGTH} characters.
          </p>

          <Button
            type="submit"
            disabled={
              isSavingPassword ||
              currentPasswordValue.length === 0 ||
              passwordValue.length < MIN_PASSWORD_LENGTH ||
              confirmPasswordValue.length < MIN_PASSWORD_LENGTH
            }
          >
            {isSavingPassword ? "Saving..." : "Update Password"}
          </Button>
        </form>
      </section>
    </div>
  );
}
