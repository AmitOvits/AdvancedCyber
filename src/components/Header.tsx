import { useCart } from "@/context/CartContext";
import { Button } from "@/components/ui/button";
import { ShoppingBag, Menu } from "lucide-react";

interface HeaderProps {
  onToggleSidebar?: () => void;
}

export function Header({ onToggleSidebar }: HeaderProps) {
  const { totalItems, setIsCartOpen } = useCart();

  return (
    <header className="sticky top-0 z-40 bg-card/80 backdrop-blur-md border-b">
      <div className="flex items-center justify-between h-16 px-4 lg:px-8">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" className="lg:hidden" onClick={onToggleSidebar}>
            <Menu className="h-5 w-5" />
          </Button>
          <h1 className="font-heading text-2xl tracking-tight text-foreground">
            SOLE<span className="text-primary">.</span>
          </h1>
        </div>

        <nav className="hidden md:flex items-center gap-6 text-sm font-medium">
          <a href="/" className="text-foreground hover:text-primary transition-colors">Shop</a>
          <a href="#" className="text-muted-foreground hover:text-primary transition-colors">New Arrivals</a>
          <a href="#" className="text-muted-foreground hover:text-primary transition-colors">Brands</a>
        </nav>

        <Button
          variant="ghost"
          size="icon"
          className="relative"
          onClick={() => setIsCartOpen(true)}
        >
          <ShoppingBag className="h-5 w-5" />
          {totalItems > 0 && (
            <span className="absolute -top-1 -right-1 bg-primary text-primary-foreground text-[10px] font-bold rounded-full h-5 w-5 flex items-center justify-center">
              {totalItems}
            </span>
          )}
        </Button>
      </div>
    </header>
  );
}
