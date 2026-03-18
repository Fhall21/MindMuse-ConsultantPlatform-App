"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const MIN_PASSWORD_LENGTH = 8;

export function AccountSettingsPanel() {
  const [supabase] = useState(() => createClient());
  const [isLoading, setIsLoading] = useState(true);
  const [currentEmail, setCurrentEmail] = useState("");
  const [emailValue, setEmailValue] = useState("");
  const [pendingEmail, setPendingEmail] = useState<string | null>(null);
  const [isSavingEmail, setIsSavingEmail] = useState(false);
  const [passwordValue, setPasswordValue] = useState("");
  const [confirmPasswordValue, setConfirmPasswordValue] = useState("");
  const [isSavingPassword, setIsSavingPassword] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function loadUser() {
      const {
        data: { user },
        error,
      } = await supabase.auth.getUser();

      if (!isMounted) {
        return;
      }

      if (error) {
        toast.error(error.message);
      }

      const email = user?.email ?? "";
      setCurrentEmail(email);
      setEmailValue(email);
      setIsLoading(false);
    }

    void loadUser();

    return () => {
      isMounted = false;
    };
  }, [supabase]);

  const normalizedEmail = emailValue.trim().toLowerCase();
  const isEmailChanged = normalizedEmail.length > 0 && normalizedEmail !== currentEmail.toLowerCase();

  async function handleEmailUpdate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!isEmailChanged) {
      return;
    }

    setIsSavingEmail(true);

    const { error } = await supabase.auth.updateUser({ email: normalizedEmail });

    setIsSavingEmail(false);

    if (error) {
      toast.error(error.message);
      return;
    }

    setPendingEmail(normalizedEmail);
    toast.success("Email update requested. Check your inbox to confirm the new address.");
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

    setIsSavingPassword(true);

    const { error } = await supabase.auth.updateUser({ password: passwordValue });

    setIsSavingPassword(false);

    if (error) {
      toast.error(error.message);
      return;
    }

    setPasswordValue("");
    setConfirmPasswordValue("");
    toast.success("Password updated.");
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            <CardTitle>Account Overview</CardTitle>
            <CardDescription>
              Keep your sign-in details up to date without mixing them with operational reporting.
            </CardDescription>
          </div>
          <Badge variant="outline">{isLoading ? "Loading account..." : "Signed in"}</Badge>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="rounded-xl border bg-muted/30 p-4">
            <p className="text-sm font-medium">Current email</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {isLoading ? "Fetching your account details..." : currentEmail || "No email found"}
            </p>
          </div>
          <div className="rounded-xl border bg-muted/30 p-4">
            <p className="text-sm font-medium">Security note</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Email updates may require inbox confirmation depending on your Supabase auth setup.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Change Email</CardTitle>
          <CardDescription>
            Update the address used for sign-in and account notifications.
          </CardDescription>
        </CardHeader>
        <CardContent>
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
              <div className="rounded-xl border border-primary/20 bg-primary/5 p-3 text-sm text-muted-foreground">
                Confirmation is pending for <span className="font-medium text-foreground">{pendingEmail}</span>.
              </div>
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
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Change Password</CardTitle>
          <CardDescription>
            Set a new password for this workspace account.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={handlePasswordUpdate}>
            <div className="grid gap-4 md:grid-cols-2">
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
              Use at least {MIN_PASSWORD_LENGTH} characters for a stronger password.
            </p>

            <Button
              type="submit"
              disabled={
                isSavingPassword ||
                passwordValue.length < MIN_PASSWORD_LENGTH ||
                confirmPasswordValue.length < MIN_PASSWORD_LENGTH
              }
            >
              {isSavingPassword ? "Saving..." : "Update Password"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
