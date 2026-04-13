"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import DashboardHeader from "@/components/DashboardHeader";
import { Loader2, Save, Building2, Radio, UserPlus, Shield, User, Lock, Check, AlertCircle, Calendar, Badge as BadgeIcon } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { api } from "@/lib/api";
import { useAuthStore } from "@/store/auth.store";
import * as Avatar from "@radix-ui/react-avatar";
import { clsx } from "clsx";

interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  role: string;
  created_at: string;
}

const inputCls =
  "w-full rounded-xl bg-surface-container-low px-4 py-2.5 text-sm text-on-surface outline-none transition-all focus:ring-2 focus:ring-primary/30 disabled:opacity-50 disabled:cursor-not-allowed";

export default function SettingsPage() {
  const t = useTranslations("settingsPage");
  const { user, setUser } = useAuthStore();

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  // Profile fields
  const [fullName, setFullName] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileSuccess, setProfileSuccess] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);

  // Password fields
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordSuccess, setPasswordSuccess] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [showPasswordForm, setShowPasswordForm] = useState(false);

  useEffect(() => {
    api
      .get<UserProfile>("/api/v1/auth/me")
      .then((data) => {
        setProfile(data);
        setFullName(data.full_name);
      })
      .finally(() => setLoading(false));
  }, []);

  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    setSavingProfile(true);
    setProfileError(null);
    setProfileSuccess(false);
    try {
      const updated = await api.patch<UserProfile>("/api/v1/auth/me", { full_name: fullName });
      setProfile(updated);
      if (setUser) setUser({ ...user!, full_name: updated.full_name });
      setProfileSuccess(true);
      setTimeout(() => setProfileSuccess(false), 3000);
    } catch {
      setProfileError(t("saved")); // fallback
    } finally {
      setSavingProfile(false);
    }
  }

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    setSavingPassword(true);
    setPasswordError(null);
    setPasswordSuccess(false);
    try {
      await api.patch("/api/v1/auth/me", {
        current_password: currentPassword,
        new_password: newPassword,
      });
      setPasswordSuccess(true);
      setCurrentPassword("");
      setNewPassword("");
      setShowPasswordForm(false);
      setTimeout(() => setPasswordSuccess(false), 4000);
    } catch (err: unknown) {
      const anyErr = err as { data?: { detail?: string } };
      const detail = anyErr?.data?.detail;
      if (detail === "current_password_wrong") setPasswordError(t("wrongPassword"));
      else if (detail === "password_too_short") setPasswordError(t("passwordTooShort"));
      else setPasswordError(detail ?? "Failed to change password");
    } finally {
      setSavingPassword(false);
    }
  }

  if (loading) {
    return (
      <div>
        <DashboardHeader title={t("profileTitle")} />
        <div className="flex items-center justify-center p-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  const initials = profile?.full_name?.charAt(0)?.toUpperCase() || "U";

  return (
    <div>
      <DashboardHeader title={t("profileTitle")} />

      <div className="p-8">
        <div className="mx-auto max-w-3xl space-y-8">

          {/* Quick nav cards */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {[
              { href: "/settings/business-profile", Icon: Building2, key: "businessProfile" },
              { href: "/settings/channels", Icon: Radio, key: "channels" },
              { href: "/settings/team", Icon: UserPlus, key: "team" },
              { href: "/settings/white-label", Icon: Shield, key: "whiteLabel" },
            ].map(({ href, Icon, key }) => (
              <Link
                key={href}
                href={href}
                className="flex flex-col items-center gap-2 rounded-2xl bg-surface-container-lowest p-4 shadow-soft transition-all hover:-translate-y-0.5 hover:shadow-soft-lg"
              >
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10">
                  <Icon className="h-4 w-4 text-primary" />
                </div>
                <span className="text-center text-xs font-semibold text-on-surface">{t(key)}</span>
              </Link>
            ))}
          </div>

          {/* Avatar + info card */}
          <div className="rounded-2xl bg-surface-container-lowest p-6 shadow-soft">
            <div className="flex items-center gap-5">
              <Avatar.Root className="brand-gradient flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl shadow-soft">
                <Avatar.Fallback className="text-xl font-bold text-white">{initials}</Avatar.Fallback>
              </Avatar.Root>
              <div>
                <h2 className="font-headline text-xl font-bold text-on-surface">{profile?.full_name}</h2>
                <p className="text-sm text-on-surface-variant">{profile?.email}</p>
                <div className="mt-1.5 flex items-center gap-3 text-xs text-on-surface-variant">
                  <span className="flex items-center gap-1">
                    <BadgeIcon className="h-3 w-3" />
                    {profile?.role}
                  </span>
                  <span className="flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    {t("memberSince")}{" "}
                    {profile?.created_at
                      ? new Date(profile.created_at).toLocaleDateString()
                      : "—"}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Profile form */}
          <div className="rounded-2xl bg-surface-container-lowest p-6 shadow-soft">
            <div className="mb-5 flex items-center gap-2">
              <User className="h-5 w-5 text-primary" />
              <h3 className="font-headline text-lg font-bold text-on-surface">{t("profileTitle")}</h3>
            </div>

            {profileSuccess && (
              <div className="mb-4 flex items-center gap-2 rounded-xl bg-emerald-50 px-4 py-2.5 text-sm font-medium text-emerald-700">
                <Check className="h-4 w-4" />
                {t("profileSaved")}
              </div>
            )}
            {profileError && (
              <div className="mb-4 flex items-center gap-2 rounded-xl bg-error-container px-4 py-2.5 text-sm text-on-error-container">
                <AlertCircle className="h-4 w-4" />
                {profileError}
              </div>
            )}

            <form onSubmit={handleSaveProfile} className="space-y-4">
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-widest text-on-surface-variant">
                  {t("fullName")}
                </label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className={inputCls}
                  required
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-widest text-on-surface-variant">
                  {t("email")}
                </label>
                <input
                  type="email"
                  value={profile?.email ?? ""}
                  readOnly
                  disabled
                  className={inputCls}
                />
                <p className="mt-1 text-xs text-on-surface-variant">{t("emailReadOnly")}</p>
              </div>
              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={savingProfile}
                  className="flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-white shadow-soft transition-all hover:brightness-105 disabled:opacity-60"
                >
                  {savingProfile ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}
                  {t("saveProfile")}
                </button>
              </div>
            </form>
          </div>

          {/* Password section */}
          <div className="rounded-2xl bg-surface-container-lowest p-6 shadow-soft">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Lock className="h-5 w-5 text-primary" />
                <h3 className="font-headline text-lg font-bold text-on-surface">{t("changePassword")}</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowPasswordForm((v) => !v)}
                className="text-sm font-semibold text-primary hover:underline"
              >
                {showPasswordForm ? "إلغاء" : t("changePassword")}
              </button>
            </div>

            {passwordSuccess && (
              <div className="mt-4 flex items-center gap-2 rounded-xl bg-emerald-50 px-4 py-2.5 text-sm font-medium text-emerald-700">
                <Check className="h-4 w-4" />
                {t("passwordChanged")}
              </div>
            )}

            {showPasswordForm && (
              <form onSubmit={handleChangePassword} className="mt-5 space-y-4">
                {passwordError && (
                  <div className="flex items-center gap-2 rounded-xl bg-error-container px-4 py-2.5 text-sm text-on-error-container">
                    <AlertCircle className="h-4 w-4" />
                    {passwordError}
                  </div>
                )}
                <div>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-widest text-on-surface-variant">
                    {t("currentPassword")}
                  </label>
                  <input
                    type="password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    className={inputCls}
                    required
                    autoComplete="current-password"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-widest text-on-surface-variant">
                    {t("newPassword")}
                  </label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className={inputCls}
                    required
                    minLength={8}
                    autoComplete="new-password"
                  />
                </div>
                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={savingPassword}
                    className="flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-white shadow-soft transition-all hover:brightness-105 disabled:opacity-60"
                  >
                    {savingPassword ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Lock className="h-4 w-4" />
                    )}
                    {t("saveSettings")}
                  </button>
                </div>
              </form>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
