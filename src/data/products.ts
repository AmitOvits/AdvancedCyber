export interface Product {
  id: string;
  name: string;
  brand: string;
  price: number;
  originalPrice?: number;
  image: string;
  sizes: number[];
  category: string;
  description: string;
  rating: number;
  reviews: number;
  isNew?: boolean;
}

export const brands = ["Nike", "Adidas", "Puma", "New Balance", "Converse"] as const;
export const categories = ["Running", "Lifestyle", "Basketball", "Training", "Skateboarding"] as const;
export const allSizes = [6, 7, 7.5, 8, 8.5, 9, 9.5, 10, 10.5, 11, 12, 13] as const;

export const products: Product[] = [
  {
    id: "1",
    name: "Air Max 90",
    brand: "Nike",
    price: 130,
    originalPrice: 160,
    image: "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=600&h=600&fit=crop",
    sizes: [7, 8, 8.5, 9, 10, 11, 12],
    category: "Lifestyle",
    description: "The Nike Air Max 90 stays true to its roots with the iconic Waffle outsole and stitched overlays.",
    rating: 4.7,
    reviews: 342,
    isNew: true,
  },
  {
    id: "2",
    name: "Ultraboost 22",
    brand: "Adidas",
    price: 190,
    image: "https://images.unsplash.com/photo-1608231387042-66d1773070a5?w=600&h=600&fit=crop",
    sizes: [7, 7.5, 8, 9, 9.5, 10, 11],
    category: "Running",
    description: "Experience incredible energy return with every stride in the Adidas Ultraboost 22.",
    rating: 4.8,
    reviews: 518,
  },
  {
    id: "3",
    name: "RS-X Reinvention",
    brand: "Puma",
    price: 110,
    originalPrice: 140,
    image: "https://images.unsplash.com/photo-1606107557195-0e29a4b5b4aa?w=600&h=600&fit=crop",
    sizes: [8, 8.5, 9, 10, 10.5, 11, 12],
    category: "Lifestyle",
    description: "Bold design meets maximum comfort in the Puma RS-X Reinvention sneaker.",
    rating: 4.5,
    reviews: 186,
  },
  {
    id: "4",
    name: "Fresh Foam 1080v12",
    brand: "New Balance",
    price: 160,
    image: "https://images.unsplash.com/photo-1539185441755-769473a23570?w=600&h=600&fit=crop",
    sizes: [7, 8, 9, 9.5, 10, 11, 12, 13],
    category: "Running",
    description: "Plush cushioning and a smooth ride make the 1080v12 perfect for daily training.",
    rating: 4.9,
    reviews: 421,
    isNew: true,
  },
  {
    id: "5",
    name: "Chuck Taylor All Star",
    brand: "Converse",
    price: 65,
    image: "https://images.unsplash.com/photo-1607522370275-f14206abe5d3?w=600&h=600&fit=crop",
    sizes: [6, 7, 7.5, 8, 8.5, 9, 10, 11, 12],
    category: "Lifestyle",
    description: "The iconic Chuck Taylor All Star. Timeless style that never goes out of fashion.",
    rating: 4.6,
    reviews: 1203,
  },
  {
    id: "6",
    name: "LeBron XX",
    brand: "Nike",
    price: 200,
    image: "https://images.unsplash.com/photo-1597045566677-8cf032ed6634?w=600&h=600&fit=crop",
    sizes: [8, 9, 10, 10.5, 11, 12, 13],
    category: "Basketball",
    description: "Engineered for explosive speed and power on the court. LeBron's 20th signature shoe.",
    rating: 4.8,
    reviews: 297,
    isNew: true,
  },
  {
    id: "7",
    name: "NMD R1",
    brand: "Adidas",
    price: 150,
    originalPrice: 180,
    image: "https://images.unsplash.com/photo-1556906781-9a412961c28c?w=600&h=600&fit=crop",
    sizes: [7, 7.5, 8, 8.5, 9, 10, 11],
    category: "Lifestyle",
    description: "Street-ready style with Boost cushioning. The NMD R1 blends heritage with innovation.",
    rating: 4.6,
    reviews: 645,
  },
  {
    id: "8",
    name: "Metcon 8",
    brand: "Nike",
    price: 130,
    image: "https://images.unsplash.com/photo-1491553895911-0055eca6402d?w=600&h=600&fit=crop",
    sizes: [7, 8, 8.5, 9, 9.5, 10, 11, 12],
    category: "Training",
    description: "Built for the toughest workouts. Stable base for lifting, flexible sole for sprints.",
    rating: 4.7,
    reviews: 312,
  },
];
