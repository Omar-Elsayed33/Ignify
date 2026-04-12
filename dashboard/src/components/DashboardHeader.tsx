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
    <header className="sticky top-0 z-30 flex h-[72px] items-center justify-between bg-surface/80 px-8 backdrop-blur-xl">
      <div className="min-w-0">
        <h1 className="font-headline text-2xl font-bold tracking-tight text-on-surface">
          {title}
        </h1>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative hidden md:block">
          <Search className="pointer-events-none absolute start-4 top-1/2 h-4 w-4 -translate-y-1/2 text-on-surface-variant/60" />
          <input
            type="text"
            placeholder={t("search")}
            className="h-10 w-72 rounded-full bg-surface-container-low ps-11 pe-4 text-sm text-on-surface placeholder:text-on-surface-variant/60 focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>

        <button
          className="relative rounded-full p-2.5 text-on-surface-variant transition-colors hover:bg-surface-container-low hover:text-on-surface"
          title={t("notifications")}
        >
          <Bell className="h-5 w-5" />
          <span className="absolute end-2 top-2 h-2 w-2 rounded-full bg-secondary ring-2 ring-surface" />
        </button>

        <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild>
            <button className="flex items-center gap-2.5 rounded-full p-1 pe-3 transition-colors hover:bg-surface-container-low">
              <Avatar.Root className="brand-gradient flex h-9 w-9 items-center justify-center overflow-hidden rounded-full">
                <Avatar.Fallback className="text-xs font-semibold text-white">
                  {user?.full_name?.charAt(0)?.toUpperCase() || "U"}
                </Avatar.Fallback>
              </Avatar.Root>
              <span className="hidden text-sm font-semibold text-on-surface md:block">
                {user?.full_name || "User"}
              </span>
            </button>
          </DropdownMenu.Trigger>

          <DropdownMenu.Portal>
            <DropdownMenu.Content
              className="min-w-[200px] rounded-2xl bg-surface-container-lowest p-2 shadow-soft-lg ghost-border"
              sideOffset={10}
              align="end"
            >
              <DropdownMenu.Item
                className="flex cursor-pointer items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm text-on-surface-variant outline-none hover:bg-surface-container-low hover:text-on-surface"
                onSelect={() => router.push("/settings")}
              >
                <User className="h-4 w-4" />
                {t("profile")}
              </DropdownMenu.Item>
              <DropdownMenu.Item
                className="flex cursor-pointer items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm text-on-surface-variant outline-none hover:bg-surface-container-low hover:text-on-surface"
                onSelect={() => router.push("/settings")}
              >
                <Settings className="h-4 w-4" />
                {t("settings")}
              </DropdownMenu.Item>
              <DropdownMenu.Separator className="my-1 h-px bg-surface-container" />
              <DropdownMenu.Item
                className="flex cursor-pointer items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm text-error outline-none hover:bg-error-container/50"
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
