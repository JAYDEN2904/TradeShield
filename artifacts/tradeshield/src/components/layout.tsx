import { ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import { LogOut, Settings, Menu, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Logo } from "@/components/logo";
import { NotificationBell } from "@/components/notification-bell";
import { cn } from "@/lib/utils";

export function Layout({ children }: { children: ReactNode }) {
  const { user, logout, canSell, activeRole, setActiveRole } = useAuth();
  const [location] = useLocation();

  const showSell = canSell && (user?.role !== "both" || activeRole === "supplier");

  const navLinkClass = (path: string, matchPrefix = false) =>
    cn(
      "text-sm font-medium transition-colors duration-150",
      (matchPrefix ? location.startsWith(path) : location === path)
        ? "text-primary"
        : "text-muted-foreground hover:text-foreground",
    );

  const NavLinks = () => (
    <>
      <Link href="/" className={navLinkClass("/")} data-testid="link-home">
        Browse
      </Link>
      {user && (
        <>
          <Link
            href="/orders"
            className={navLinkClass("/orders", true)}
            data-testid="link-orders"
          >
            Orders
          </Link>
          {showSell && (
            <Link
              href="/dashboard"
              className={navLinkClass("/dashboard", true)}
              data-testid="link-dashboard"
            >
              Dashboard
            </Link>
          )}
          {user.isAdmin && (
            <Link
              href="/admin"
              className={navLinkClass("/admin", true)}
              data-testid="link-admin"
            >
              Admin
            </Link>
          )}
        </>
      )}
    </>
  );

  return (
    <div className="min-h-[100dvh] flex flex-col bg-background">
      <header className="sticky top-0 z-50 w-full border-b border-border/80 bg-background/95 backdrop-blur-md supports-[backdrop-filter]:bg-background/80">
        <div className="ts-container-wide h-16 flex items-center justify-between">
          <div className="flex items-center gap-8">
            <Link href="/" className="group transition-transform duration-150 group-hover:scale-[1.02]" data-testid="link-logo">
              <Logo variant="mark" size="md" className="sm:hidden" />
              <Logo variant="lockup" size="md" className="hidden sm:flex" />
            </Link>
            <nav className="hidden md:flex items-center gap-6">
              <NavLinks />
            </nav>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            {user ? (
              <>
                <NotificationBell />
                <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    className="relative h-9 w-9 rounded-full p-0"
                    data-testid="btn-user-menu"
                  >
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary font-semibold text-sm">
                      {user.businessName.charAt(0).toUpperCase()}
                    </div>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-56" align="end" forceMount>
                  <DropdownMenuLabel className="font-normal">
                    <div className="flex flex-col space-y-1">
                      <p className="text-sm font-semibold leading-none">
                        {user.businessName}
                      </p>
                      <p className="text-xs leading-none text-muted-foreground">
                        {user.phone}
                      </p>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {user.role === "both" && (
                    <>
                      <DropdownMenuLabel className="text-xs text-muted-foreground font-normal">
                        Active view
                      </DropdownMenuLabel>
                      <DropdownMenuItem
                        className="cursor-pointer"
                        onClick={() => setActiveRole("buyer")}
                      >
                        {activeRole === "buyer" ? "✓ " : ""}Buying
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="cursor-pointer"
                        onClick={() => setActiveRole("supplier")}
                      >
                        {activeRole === "supplier" ? "✓ " : ""}Selling
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                    </>
                  )}
                  <Link href="/settings">
                    <DropdownMenuItem className="cursor-pointer" data-testid="menu-settings">
                      <Settings className="mr-2 h-4 w-4" />
                      <span>Settings</span>
                    </DropdownMenuItem>
                  </Link>
                  {user.kycStatus !== "approved" && (
                    <Link href="/verify">
                      <DropdownMenuItem className="cursor-pointer">
                        <ShieldCheck className="mr-2 h-4 w-4" />
                        <span>Get Verified</span>
                      </DropdownMenuItem>
                    </Link>
                  )}
                  <DropdownMenuItem
                    className="cursor-pointer text-destructive focus:text-destructive"
                    onClick={() => logout()}
                    data-testid="menu-logout"
                  >
                    <LogOut className="mr-2 h-4 w-4" />
                    <span>Log out</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              </>
            ) : (
              <div className="hidden md:flex items-center gap-2">
                <Link href="/login">
                  <Button variant="ghost" size="sm" data-testid="btn-login">
                    Log in
                  </Button>
                </Link>
                <Link href="/register">
                  <Button variant="cta" size="sm">
                    Get started
                  </Button>
                </Link>
              </div>
            )}

            <Sheet>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="md:hidden">
                  <Menu className="h-5 w-5" />
                  <span className="sr-only">Toggle menu</span>
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="flex flex-col gap-6 pt-10">
                <nav className="flex flex-col gap-4">
                  <NavLinks />
                  {!user && (
                    <Link href="/login">
                      <Button variant="cta" className="mt-4 w-full">
                        Log in
                      </Button>
                    </Link>
                  )}
                </nav>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </header>

      <main className="flex-1 flex flex-col relative">{children}</main>

      <footer className="border-t border-border/80 pt-12 pb-8 bg-muted/30">
        <div className="ts-container-wide">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-10">
            {/* Brand column */}
            <div className="col-span-2 md:col-span-1">
              <div className="mb-3">
                <Logo variant="lockup" size="sm" />
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed max-w-[220px]">
                Ghana&apos;s escrow-protected B2B wholesale marketplace. Trade
                with confidence.
              </p>
            </div>

            {/* Platform */}
            <div>
              <h4 className="font-semibold text-sm mb-4">Platform</h4>
              <ul className="space-y-2.5">
                <li>
                  <Link
                    href="/"
                    className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Browse Products
                  </Link>
                </li>
                <li>
                  <a
                    href="/#how-it-works"
                    className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    How It Works
                  </a>
                </li>
                <li>
                  <Link
                    href="/register"
                    className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Become a Supplier
                  </Link>
                </li>
              </ul>
            </div>

            {/* Account */}
            <div>
              <h4 className="font-semibold text-sm mb-4">Account</h4>
              <ul className="space-y-2.5">
                <li>
                  <Link
                    href="/register"
                    className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Sign Up Free
                  </Link>
                </li>
                <li>
                  <Link
                    href="/login"
                    className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Log In
                  </Link>
                </li>
                <li>
                  <Link
                    href="/settings"
                    className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Settings
                  </Link>
                </li>
              </ul>
            </div>

            {/* Legal */}
            <div>
              <h4 className="font-semibold text-sm mb-4">Legal</h4>
              <ul className="space-y-2.5">
                <li>
                  <a
                    href="#"
                    className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Terms of Service
                  </a>
                </li>
                <li>
                  <a
                    href="#"
                    className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Privacy Policy
                  </a>
                </li>
                <li>
                  <a
                    href="#"
                    className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Dispute Policy
                  </a>
                </li>
              </ul>
            </div>
          </div>

          {/* Bottom row */}
          <div className="flex flex-col md:flex-row justify-between items-center gap-3 pt-8 border-t border-border/60">
            <p className="text-xs text-muted-foreground">
              &copy; {new Date().getFullYear()} TradeShield. All rights
              reserved. Secure B2B escrow for Ghanaian wholesale trade.
            </p>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Logo variant="mark" size="sm" className="h-5 w-5" />
              Escrow-protected
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
