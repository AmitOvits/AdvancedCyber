import { useState } from "react";
import type { Product } from "@/data/products";
import { useCart } from "@/context/CartContext";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Star, ShoppingBag } from "lucide-react";

export function ProductCard({ product }: { product: Product }) {
  const { addItem } = useCart();
  const [selectedSize, setSelectedSize] = useState<number | null>(null);
  const [showSizes, setShowSizes] = useState(false);

  const handleAdd = () => {
    if (!selectedSize) {
      setShowSizes(true);
      return;
    }
    addItem(product, selectedSize);
    setShowSizes(false);
    setSelectedSize(null);
  };

  return (
    <div className="group bg-card rounded-lg overflow-hidden shadow-card hover:shadow-card-hover transition-all duration-300">
      <div className="relative aspect-square overflow-hidden bg-accent">
        <img
          src={product.image}
          alt={product.name}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          loading="lazy"
        />
        {product.isNew && (
          <Badge className="absolute top-3 left-3 bg-primary text-primary-foreground">New</Badge>
        )}
        {product.originalPrice && (
          <Badge variant="destructive" className="absolute top-3 right-3">
            -{Math.round(((product.originalPrice - product.price) / product.originalPrice) * 100)}%
          </Badge>
        )}
      </div>

      <div className="p-4 space-y-2">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{product.brand}</p>
        <h3 className="font-heading text-lg leading-tight text-card-foreground">{product.name}</h3>

        <div className="flex items-center gap-1.5 text-sm">
          <Star className="h-3.5 w-3.5 fill-primary text-primary" />
          <span className="font-medium text-card-foreground">{product.rating}</span>
          <span className="text-muted-foreground">({product.reviews})</span>
        </div>

        <div className="flex items-baseline gap-2">
          <span className="text-lg font-bold text-card-foreground">${product.price}</span>
          {product.originalPrice && (
            <span className="text-sm text-muted-foreground line-through">${product.originalPrice}</span>
          )}
        </div>

        {showSizes && (
          <div className="flex flex-wrap gap-1.5 pt-1">
            {product.sizes.map((size) => (
              <button
                key={size}
                onClick={() => setSelectedSize(size)}
                className={`px-2 py-1 text-xs rounded-md border transition-colors ${
                  selectedSize === size
                    ? "bg-primary text-primary-foreground border-primary"
                    : "border-border text-muted-foreground hover:border-primary hover:text-card-foreground"
                }`}
              >
                {size}
              </button>
            ))}
          </div>
        )}

        <Button onClick={handleAdd} className="w-full mt-2" size="sm">
          <ShoppingBag className="h-4 w-4 mr-2" />
          {showSizes && !selectedSize ? "Select a size" : "Add to Cart"}
        </Button>
      </div>
    </div>
  );
}
