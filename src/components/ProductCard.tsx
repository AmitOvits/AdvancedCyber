import { useState } from "react";
import type { Product } from "@/data/products";
import { useCart } from "@/context/CartContext";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Star, ShoppingBag } from "lucide-react";
import { motion } from "framer-motion";

export function ProductCard({ product, index = 0 }: { product: Product; index?: number }) {
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
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.06, ease: [0.25, 0.46, 0.45, 0.94] }}
      className="group relative rounded-2xl overflow-hidden bg-card border border-border/50 hover:border-border transition-all duration-500 hover:shadow-card-hover"
    >
      <div className="relative aspect-square overflow-hidden bg-accent/50">
        <img
          src={product.image}
          alt={product.name}
          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700 ease-out"
          loading="lazy"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-background/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
        {product.isNew && (
          <Badge className="absolute top-3 left-3 bg-primary text-primary-foreground rounded-full px-3 text-[10px] font-semibold uppercase tracking-wider">
            New
          </Badge>
        )}
        {product.originalPrice && (
          <Badge className="absolute top-3 right-3 bg-destructive text-destructive-foreground rounded-full px-3 text-[10px] font-semibold">
            -{Math.round(((product.originalPrice - product.price) / product.originalPrice) * 100)}%
          </Badge>
        )}
      </div>

      <div className="p-5 space-y-3">
        <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-[0.15em]">{product.brand}</p>
        <h3 className="font-semibold text-base leading-tight text-card-foreground">{product.name}</h3>

        <div className="flex items-center gap-1.5 text-sm">
          <Star className="h-3.5 w-3.5 fill-primary text-primary" />
          <span className="font-medium text-card-foreground text-xs">{product.rating}</span>
          <span className="text-muted-foreground text-xs">({product.reviews})</span>
        </div>

        <div className="flex items-baseline gap-2">
          <span className="text-lg font-bold text-card-foreground">${product.price}</span>
          {product.originalPrice && (
            <span className="text-sm text-muted-foreground line-through">${product.originalPrice}</span>
          )}
        </div>

        {showSizes && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            className="flex flex-wrap gap-1.5 pt-1"
          >
            {product.sizes.map((size) => (
              <button
                key={size}
                onClick={() => setSelectedSize(size)}
                className={`px-2.5 py-1 text-xs rounded-full border transition-all duration-200 ${
                  selectedSize === size
                    ? "bg-primary text-primary-foreground border-primary"
                    : "border-border text-muted-foreground hover:border-foreground hover:text-foreground"
                }`}
              >
                {size}
              </button>
            ))}
          </motion.div>
        )}

        <Button
          onClick={handleAdd}
          className="w-full mt-2 rounded-full font-semibold text-sm h-11"
          size="sm"
        >
          <ShoppingBag className="h-4 w-4 mr-2" />
          {showSizes && !selectedSize ? "Select Size" : "Add to Cart"}
        </Button>
      </div>
    </motion.div>
  );
}
