import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/lib/auth";
import { Layout } from "@/components/layout";
import { ProtectedRoute } from "@/components/protected-route";

import NotFound from "@/pages/not-found";
import ForgotPassword from "@/pages/forgot-password";
import Login from "@/pages/login";
import Register from "@/pages/register";
import Home from "@/pages/home";
import ProductDetail from "@/pages/product-detail";
import Orders from "@/pages/orders";
import OrderDetail from "@/pages/order-detail";
import Dashboard from "@/pages/dashboard";
import SupplierProfile from "@/pages/supplier-profile";
import Settings from "@/pages/settings";
import Admin from "@/pages/admin";
import Verify from "@/pages/verify";
import Notifications from "@/pages/notifications";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function Router() {
  return (
    <Switch>
      <Route path="/login" component={Login} />
      <Route path="/forgot-password" component={ForgotPassword} />
      <Route path="/register" component={Register} />
      
      {/* The "/" route renders without Layout — LandingView manages its own
          marketing nav and footer; CatalogView (logged-in buyers) imports
          Layout directly so it still gets the app header/footer. */}
      <Route path="/">
        <Home />
      </Route>
      
      <Route path="/products/:id">
        <Layout><ProductDetail /></Layout>
      </Route>
      
      <Route path="/suppliers/:id">
        <Layout><SupplierProfile /></Layout>
      </Route>

      <Route path="/orders">
        <Layout>
          <ProtectedRoute>
            <Orders />
          </ProtectedRoute>
        </Layout>
      </Route>

      <Route path="/orders/:id">
        <Layout>
          <ProtectedRoute>
            <OrderDetail />
          </ProtectedRoute>
        </Layout>
      </Route>

      <Route path="/dashboard">
        <Layout>
          <ProtectedRoute requireRole="supplier">
            <Dashboard />
          </ProtectedRoute>
        </Layout>
      </Route>

      {/* Legacy redirect: /sell → /dashboard */}
      <Route path="/sell">
        <Layout>
          <ProtectedRoute requireRole="supplier">
            <Dashboard />
          </ProtectedRoute>
        </Layout>
      </Route>

      <Route path="/settings">
        <Layout>
          <ProtectedRoute>
            <Settings />
          </ProtectedRoute>
        </Layout>
      </Route>

      <Route path="/notifications">
        <Layout>
          <ProtectedRoute>
            <Notifications />
          </ProtectedRoute>
        </Layout>
      </Route>

      <Route path="/admin">
        <Layout>
          <ProtectedRoute requireAdmin={true}>
            <Admin />
          </ProtectedRoute>
        </Layout>
      </Route>

      <Route path="/verify">
        <Layout>
          <ProtectedRoute>
            <Verify />
          </ProtectedRoute>
        </Layout>
      </Route>

      <Route>
        <Layout><NotFound /></Layout>
      </Route>
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <AuthProvider>
            <Router />
          </AuthProvider>
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
