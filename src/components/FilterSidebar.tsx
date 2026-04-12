import { brands, categories, allSizes } from "@/data/products";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";

export interface Filters {
  brands: string[];
  categories: string[];
  sizes: number[];
  priceRange: [number, number];
}

interface FilterSidebarProps {
  filters: Filters;
  onChange: (filters: Filters) => void;
  onClose?: () => void;
}

export function FilterSidebar({ filters, onChange, onClose }: FilterSidebarProps) {
  const toggleBrand = (brand: string) => {
    const next = filters.brands.includes(brand)
      ? filters.brands.filter((b) => b !== brand)
      : [...filters.brands, brand];
    onChange({ ...filters, brands: next });
  };

  const toggleCategory = (cat: string) => {
    const next = filters.categories.includes(cat)
      ? filters.categories.filter((c) => c !== cat)
      : [...filters.categories, cat];
    onChange({ ...filters, categories: next });
  };

  const toggleSize = (size: number) => {
    const next = filters.sizes.includes(size)
      ? filters.sizes.filter((s) => s !== size)
      : [...filters.sizes, size];
    onChange({ ...filters, sizes: next });
  };

  const clearAll = () =>
    onChange({ brands: [], categories: [], sizes: [], priceRange: [0, 300] });

  const hasFilters =
    filters.brands.length > 0 ||
    filters.categories.length > 0 ||
    filters.sizes.length > 0 ||
    filters.priceRange[0] > 0 ||
    filters.priceRange[1] < 300;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold uppercase tracking-wider text-foreground">Filters</h2>
        <div className="flex items-center gap-2">
          {hasFilters && (
            <button onClick={clearAll} className="text-xs text-primary hover:underline">
              Clear all
            </button>
          )}
          {onClose && (
            <Button variant="ghost" size="icon" onClick={onClose} className="lg:hidden h-7 w-7">
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      <div className="h-px bg-border" />

      <div>
        <h3 className="font-semibold text-xs mb-3 text-muted-foreground uppercase tracking-wider">Brand</h3>
        <div className="space-y-2.5">
          {brands.map((brand) => (
            <div key={brand} className="flex items-center gap-2">
              <Checkbox
                id={`brand-${brand}`}
                checked={filters.brands.includes(brand)}
                onCheckedChange={() => toggleBrand(brand)}
              />
              <Label htmlFor={`brand-${brand}`} className="text-sm cursor-pointer text-foreground">
                {brand}
              </Label>
            </div>
          ))}
        </div>
      </div>

      <div className="h-px bg-border" />

      <div>
        <h3 className="font-semibold text-xs mb-3 text-muted-foreground uppercase tracking-wider">Category</h3>
        <div className="space-y-2.5">
          {categories.map((cat) => (
            <div key={cat} className="flex items-center gap-2">
              <Checkbox
                id={`cat-${cat}`}
                checked={filters.categories.includes(cat)}
                onCheckedChange={() => toggleCategory(cat)}
              />
              <Label htmlFor={`cat-${cat}`} className="text-sm cursor-pointer text-foreground">
                {cat}
              </Label>
            </div>
          ))}
        </div>
      </div>

      <div className="h-px bg-border" />

      <div>
        <h3 className="font-semibold text-xs mb-3 text-muted-foreground uppercase tracking-wider">Price Range</h3>
        <Slider
          value={filters.priceRange}
          onValueChange={(val) => onChange({ ...filters, priceRange: val as [number, number] })}
          min={0}
          max={300}
          step={10}
          className="mb-2"
        />
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>${filters.priceRange[0]}</span>
          <span>${filters.priceRange[1]}</span>
        </div>
      </div>

      <div className="h-px bg-border" />

      <div>
        <h3 className="font-semibold text-xs mb-3 text-muted-foreground uppercase tracking-wider">Size</h3>
        <div className="flex flex-wrap gap-2">
          {allSizes.map((size) => (
            <button
              key={size}
              onClick={() => toggleSize(size)}
              className={`px-2.5 py-1.5 text-xs rounded-full border transition-all duration-200 ${
                filters.sizes.includes(size)
                  ? "bg-primary text-primary-foreground border-primary"
                  : "border-border text-muted-foreground hover:border-foreground hover:text-foreground"
              }`}
            >
              {size}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
