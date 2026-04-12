"use client";

import { useTranslations } from "next-intl";
import { useAuthStore } from "@/store/auth.store";
import { useRouter } from "@/i18n/navigation";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import * as Avatar from "@radix-ui/react-avatar";
import { Search, Bell, User, Settings, LogOut } from "lucide-react";

interface DashboardHeaderProps {
  title: string;
}

export default function DashboardHeader({ title }: DashboardHeaderProps) {
  const t = useTranslations("header");
  const { user, logout } = useAuthStore();
  const router = useRouter();

  const handleLogout = () => {
    logout();
    router.push("/login");
  };

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-border bg-surface px-6">
      <h1 className="text-xl font-bold text-text-primary">{title}</h1>

      <div className="flex items-center gap-4">
        <div className="relative hidden md:block">
          <Search className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
          <input
            type="text"
            placeholder={t("search")}
            className="h-9 w-64 rounded-lg border border-border bg-background ps-10 pe-4 text-sm text-text-primary placeholder:text-text-muted focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>

        <button
          className="relative rounded-lg p-2 text-text-secondary hover:bg-surface-hover hover:text-text-primary"
          title={t("notifications")}
        >
          <Bell className="h-5 w-5" />
          <span className="absolute end-1.5 top-1.5 h-2 w-2 rounded-full bg-primary" />
        </button>

        <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild>
            <button className="flex items-center gap-2 rounded-lg p-1 hover:bg-surface-hover">
              <Avatar.Root className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full bg-primary">
                <Avatar.Fallback className="text-xs font-semibold text-white">
                  {user?.full_name?.charAt(0)?.toUpperCase() || "U"}
                </Avatar.Fallback>
              </Avatar.Root>
              <span className="hidden text-sm font-medium text-text-primary md:block">
                {user?.full_name || "User"}
              </span>
            </button>
          </DropdownMenu.Trigger>

          <DropdownMenu.Portal>
            <DropdownMenu.Content
              className="min-w-[180px] rounded-lg border border-border bg-surface p-1 shadow-lg"
              sideOffset={8}
              align="end"
            >
              <DropdownMenu.Item
                className="flex cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-sm text-text-secondary outline-none hover:bg-surface-hover hover:text-text-primary"
                onSelect={() => router.push("/settings")}
              >
                <User className="h-4 w-4" />
                {t("profile")}
              </DropdownMenu.Item>
              <DropdownMenu.Item
                className="flex cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-sm text-text-secondary outline-none hover:bg-surface-hover hover:text-text-primary"
                onSelect={() => router.push("/settings")}
              >
                <Settings className="h-4 w-4" />
                {t("settings")}
              </DropdownMenu.Item>
              <DropdownMenu.Separator className="my-1 h-px bg-border" />
              <DropdownMenu.Item
                className="flex cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-sm text-error outline-none hover:bg-error/10"
                onSelect={handleLogout}
              >
                <LogOut className="h-4 w-4" />
                {t("logout")}
              </DropdownMenu.Item>
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>
      </div>
    </header>
  );
}
