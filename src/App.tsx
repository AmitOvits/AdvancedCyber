import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/context/AuthContext";
import { CartProvider } from "@/context/CartContext";
import Index from "./pages/Index.tsx";
import Auth from "./pages/Auth.tsx";
import Admin from "./pages/Admin.tsx";
import NewArrivals from "./pages/NewArrivals.tsx";
import Brands from "./pages/Brands.tsx";
import About from "./pages/About.tsx";
import Collections from "./pages/Collections.tsx";
import Checkout from "./pages/Checkout.tsx";
import NotFound from "./pages/NotFound.tsx";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <CartProvider>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/new-arrivals" element={<NewArrivals />} />
              <Route path="/brands" element={<Brands />} />
              <Route path="/about" element={<About />} />
              <Route path="/collections" element={<Collections />} />
              <Route path="/checkout" element={<Checkout />} />
              <Route path="/auth" element={<Auth />} />
              <Route path="/admin" element={<Admin />} />
              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </CartProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
