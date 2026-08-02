"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Menu, X, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";
import { getInitials } from "@/lib/format";
import { Logo } from "@/components/logo";
import { platform } from "@/lib/products";
import { GlobalSearch } from "@/components/platform/global-search";
import { NotificationCenter } from "@/components/platform/notification-center";
import { signOut, useSession } from "next-auth/react";

interface NavbarProps {
  user?: {
    name?: string | null;
    email: string;
    avatar?: string | null;
    role?: string;
  } | null;
}

export function Navbar({ user: serverUser }: NavbarProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { theme, setTheme } = useTheme();
  const { data: clientSession } = useSession();
  const pathname = usePathname();
  const user =
    serverUser === undefined
      ? clientSession?.user
        ? {
            name: clientSession.user.name,
            email: clientSession.user.email || "",
            avatar: clientSession.user.image,
            role: clientSession.user.role,
          }
        : null
      : serverUser;

  // Platform-level navigation. Dashboard only appears once signed in, so the
  // bar never offers a link that immediately bounces to the login page.
  const navLinks = [
    { href: "/", label: "Home" },
    { href: "/products", label: "Products" },
    { href: "/pricing", label: "Pricing" },
    { href: "/blog", label: "Blog" },
    { href: "/contact", label: "Contact" },
    ...(user ? [{ href: "/dashboard", label: "Dashboard" }] : []),
  ];

  // Inside a focused product the wordmark reads as the product, so users
  // always know which module they are in while the platform name stays one
  // click away.
  const inPdfPilot = pathname?.startsWith("/tools") ?? false;
  const inOfficePilot = pathname?.startsWith("/officepilot") ?? false;


  return (
    <nav className="fixed top-0 left-0 right-0 z-50 border-b border-border/40 bg-background/80 backdrop-blur-xl supports-[backdrop-filter]:bg-background/60">
      <div className="max-w-7xl mx-auto px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          {/* Logo */}
          <Link href="/" className="flex items-center space-x-2.5 group">
            <div className="relative transition-transform duration-300 group-hover:scale-105">
              <div className="relative flex h-8 w-8 items-center justify-center rounded-xl border border-border/60 bg-foreground text-background shadow-sm transition-shadow group-hover:shadow-md">
                <Logo className="h-4 w-4" />
              </div>
            </div>
            <span className="text-[15px] font-semibold tracking-tight">
              {platform.name}
              {inPdfPilot && (
                <span className="text-muted-foreground font-normal"> / PDFPilot</span>
              )}
              {inOfficePilot && (
                <span className="text-muted-foreground font-normal"> / OfficePilot</span>
              )}
            </span>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center space-x-1">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "px-4 py-2 text-sm font-medium rounded-xl transition-all duration-200",
                  pathname === link.href
                    ? "text-foreground bg-accent"
                    : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
                )}
              >
                {link.label}
              </Link>
            ))}
          </div>

          {/* Right Side Actions */}
          <div className="hidden md:flex items-center space-x-3">
            <GlobalSearch />

            {user && <NotificationCenter />}

            <Button
              variant="ghost"
              size="icon"
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              className="w-9 h-9 rounded-xl"
            >
              <Sun className="h-[18px] w-[18px] rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
              <Moon className="absolute h-[18px] w-[18px] rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
              <span className="sr-only">Toggle theme</span>
            </Button>

            {user ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="flex items-center space-x-2.5 rounded-2xl px-3 py-1.5 hover:bg-accent transition-all duration-200">
                    <Avatar className="h-7 w-7">
                      <AvatarImage src={user.avatar || undefined} />
                      <AvatarFallback className="text-xs bg-muted text-foreground">
                        {getInitials(user.name, user.email)}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-sm font-medium">{user.name?.split(" ")[0] || "User"}</span>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel>
                    <div className="flex flex-col space-y-1">
                      <p className="text-sm font-medium leading-none">
                        {user.name || "User"}
                      </p>
                      <p className="text-xs leading-none text-muted-foreground">
                        {user.email}
                      </p>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link href="/dashboard">Dashboard</Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href="/files">Files</Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href="/settings">Settings</Link>
                  </DropdownMenuItem>
                  {user.role === "admin" && (
                    <DropdownMenuItem asChild>
                      <Link href="/admin/posts">Blog admin</Link>
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onSelect={() => void signOut({ callbackUrl: "/" })}
                  >
                    Log out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <>
                <Button variant="ghost" size="sm" asChild>
                  <Link href="/login">Log in</Link>
                </Button>
                <Button size="sm" asChild>
                  <Link href="/register">Sign up</Link>
                </Button>
              </>
            )}
          </div>

          {/* Mobile actions */}
          <div className="flex items-center gap-1 md:hidden">
            <GlobalSearch />
            {user && <NotificationCenter />}
            <button
              className="p-2 rounded-xl hover:bg-accent transition-colors focus-visible:outline-none"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
            >
              {mobileMenuOpen ? (
                <X className="w-5 h-5" />
              ) : (
                <Menu className="w-5 h-5" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-border/40 bg-background/95 backdrop-blur-xl">
          <div className="px-6 py-6 space-y-3">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "block px-4 py-3 text-sm font-medium rounded-2xl transition-all duration-200",
                  pathname === link.href
                    ? "bg-accent text-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
                )}
                onClick={() => setMobileMenuOpen(false)}
              >
                {link.label}
              </Link>
            ))}
            <div className="pt-4 border-t border-border/40 mt-4">
              {user ? (
                <div className="space-y-3">
                  <div className="flex items-center space-x-3 px-4 py-3">
                    <Avatar className="h-9 w-9">
                      <AvatarImage src={user.avatar || undefined} />
                      <AvatarFallback className="text-xs bg-muted text-foreground">
                        {getInitials(user.name, user.email)}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="text-sm font-medium">{user.name || "User"}</p>
                      <p className="text-xs text-muted-foreground">{user.email}</p>
                    </div>
                  </div>
                  <Link
                    href="/dashboard"
                    className="block px-4 py-3 text-sm rounded-2xl hover:bg-accent"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    Dashboard
                  </Link>
                  <Link
                    href="/files"
                    className="block px-4 py-3 text-sm rounded-2xl hover:bg-accent"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    Files
                  </Link>
                  <Link
                    href="/settings"
                    className="block px-4 py-3 text-sm rounded-2xl hover:bg-accent"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    Settings
                  </Link>
                  {user.role === "admin" && (
                    <Link
                      href="/admin/posts"
                      className="block px-4 py-3 text-sm rounded-2xl hover:bg-accent"
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      Blog admin
                    </Link>
                  )}
                  <button
                    type="button"
                    onClick={() => void signOut({ callbackUrl: "/" })}
                    className="w-full text-left px-4 py-3 text-sm text-destructive rounded-2xl hover:bg-accent"
                  >
                    Log out
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  <Button variant="ghost" size="sm" className="w-full justify-start" asChild>
                    <Link href="/login">Log in</Link>
                  </Button>
                  <Button size="sm" className="w-full" asChild>
                    <Link href="/register">Sign up</Link>
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}
