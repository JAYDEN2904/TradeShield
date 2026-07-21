import { ReactNode, useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import { Skeleton } from "@/components/ui/skeleton";

function loginRedirectPath(currentPath: string): string {
  if (!currentPath || currentPath === "/" || currentPath.startsWith("/login")) {
    return "/login";
  }
  return `/login?next=${encodeURIComponent(currentPath)}`;
}

export function ProtectedRoute({
  children,
  requireAdmin = false,
  requireRole,
}: {
  children: ReactNode;
  requireAdmin?: boolean;
  requireRole?: "buyer" | "supplier";
}) {
  const { user, isLoading } = useAuth();
  const [location, setLocation] = useLocation();

  useEffect(() => {
    if (!isLoading && !user) {
      setLocation(loginRedirectPath(location));
    } else if (!isLoading && user && requireAdmin && !user.isAdmin) {
      setLocation("/");
    } else if (!isLoading && user && requireRole) {
      if (requireRole === "buyer" && user.role === "supplier") {
        setLocation("/");
      }
      if (requireRole === "supplier" && user.role === "buyer") {
        setLocation("/");
      }
    }
  }, [user, isLoading, setLocation, requireAdmin, requireRole, location]);

  if (isLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center p-8">
        <div className="w-full max-w-md space-y-4">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      </div>
    );
  }

  if (!user) {
    return null; // Will redirect in useEffect
  }

  if (requireAdmin && !user.isAdmin) {
    return null;
  }

  if (requireRole && user.role !== "both" && user.role !== requireRole) {
    return null;
  }

  return <>{children}</>;
}
