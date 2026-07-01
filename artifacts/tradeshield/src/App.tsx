import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/lib/auth";
import { Layout } from "@/components/layout";
import { ProtectedRoute } from "@/components/protected-route";

import NotFound from "@/pages/not-found";
import Login from "@/pages/login";
import Register from "@/pages/register";
import Home from "@/pages/home";
import ProductDetail from "@/pages/product-detail";
import Orders from "@/pages/orders";
import OrderDetail from "@/pages/order-detail";
import Sell from "@/pages/sell";
import SupplierProfile from "@/pages/supplier-profile";
import Settings from "@/pages/settings";
import Admin from "@/pages/admin";

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
      <Route path="/register" component={Register} />
      
      <Route path="/">
        <Layout><Home /></Layout>
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

      <Route path="/sell">
        <Layout>
          <ProtectedRoute requireRole="supplier">
            <Sell />
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

      <Route path="/admin">
        <Layout>
          <ProtectedRoute requireAdmin={true}>
            <Admin />
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
