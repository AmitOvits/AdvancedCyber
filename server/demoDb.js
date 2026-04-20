const db = {
  products: [
    { id: "p_001", name: "AeroRun Pro", brand: "Sole", price: 149, stock: 12 },
    { id: "p_002", name: "StreetFlex 2", brand: "Sole", price: 129, stock: 7 },
    { id: "p_003", name: "TrailGuard X", brand: "Sole", price: 169, stock: 3 },
  ],
  orders: [
    { id: "o_1001", userEmail: "student@example.edu", total: 278, items: [{ productId: "p_001", qty: 1 }, { productId: "p_002", qty: 1 }] },
    { id: "o_1002", userEmail: "student@example.edu", total: 169, items: [{ productId: "p_003", qty: 1 }] },
  ],
};

export function getDb() {
  return db;
}
