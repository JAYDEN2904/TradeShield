import { createContext, useContext, ReactNode, useState, useEffect, useMemo } from "react";
import {
  useGetCurrentUser,
  useLogout,
  getGetCurrentUserQueryKey,
  type User,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import {
  type ActiveRole,
  readStoredActiveRole,
  storeActiveRole,
} from "@/lib/phone";

type AuthContextType = {
  user: User | undefined;
  isLoading: boolean;
  logout: () => void;
  /** For `both` role users — controls default buyer vs supplier UI */
  activeRole: ActiveRole;
  setActiveRole: (role: ActiveRole) => void;
  /** Resolved role for orders/sell visibility */
  effectiveRole: "buyer" | "supplier" | "both";
  canSell: boolean;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function defaultActiveRole(user: User | undefined): ActiveRole {
  if (!user) return "buyer";
  const stored = readStoredActiveRole();
  if (stored && user.role === "both") return stored;
  if (user.role === "supplier") return "supplier";
  return "buyer";
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const { data: user, isLoading } = useGetCurrentUser({
    query: {
      queryKey: getGetCurrentUserQueryKey(),
      retry: false,
    },
  });

  const [activeRole, setActiveRoleState] = useState<ActiveRole>("buyer");

  useEffect(() => {
    if (user) {
      setActiveRoleState(defaultActiveRole(user));
    }
  }, [user?.id, user?.role]);

  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();

  const logoutMutation = useLogout({
    mutation: {
      onSuccess: () => {
        queryClient.setQueryData(getGetCurrentUserQueryKey(), null);
        setLocation("/");
      },
    },
  });

  const setActiveRole = (role: ActiveRole) => {
    storeActiveRole(role);
    setActiveRoleState(role);
    if (role === "supplier") {
      setLocation("/dashboard");
    } else {
      setLocation("/");
    }
  };

  const effectiveRole = useMemo((): AuthContextType["effectiveRole"] => {
    if (!user) return "buyer";
    if (user.role === "both") return "both";
    return user.role;
  }, [user]);

  const canSell =
    !!user &&
    (user.role === "supplier" ||
      user.role === "both");

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        logout: () => logoutMutation.mutate(undefined),
        activeRole,
        setActiveRole,
        effectiveRole,
        canSell,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
