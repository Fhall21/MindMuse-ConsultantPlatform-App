"use client";

import { authClient } from "@/lib/auth/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { error } = await authClient.signIn.email({
      email,
      password,
    });

    if (error) {
      setError(error.message ?? "Unable to sign in.");
      setLoading(false);
      return;
    }

    router.push("/dashboard");
    router.refresh();
  }

  async function handleSignUp(e: React.FormEvent) {
    e.preventDefault();
    if (!isSignUp) {
      setIsSignUp(true);
      return;
    }
    setLoading(true);
    setError(null);

    const resolvedName = name.trim() ||
      email.trim().split("@")[0]?.replace(/[._-]+/g, " ").trim() ||
      "New user";

    const { error } = await authClient.signUp.email({
      name: resolvedName,
      email,
      password,
    });

    if (error) {
      setError(error.message ?? "Unable to create your account.");
      setLoading(false);
      return;
    }

    router.push("/dashboard");
    router.refresh();
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-2xl">ConsultantPlatform</CardTitle>
          <CardDescription>
            {isSignUp
              ? "Create your account"
              : "Sign in to manage your consultation evidence"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={isSignUp ? handleSignUp : handleLogin} className="space-y-4">
            {isSignUp && (
              <div className="space-y-2">
                <Label htmlFor="name">Your name</Label>
                <Input
                  id="name"
                  type="text"
                  placeholder="Jane Smith"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  autoFocus
                />
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}
            {isSignUp ? (
              <div className="flex gap-2">
                <Button type="submit" className="flex-1" disabled={loading}>
                  {loading ? "Creating…" : "Create account"}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  className="flex-1"
                  disabled={loading}
                  onClick={() => { setIsSignUp(false); setError(null); setName(""); }}
                >
                  Back to sign in
                </Button>
              </div>
            ) : (
              <div className="flex gap-2">
                <Button type="submit" className="flex-1" disabled={loading}>
                  {loading ? "Signing in…" : "Sign in"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  disabled={loading}
                  onClick={() => { setIsSignUp(true); setError(null); }}
                >
                  Sign up
                </Button>
              </div>
            )}
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
