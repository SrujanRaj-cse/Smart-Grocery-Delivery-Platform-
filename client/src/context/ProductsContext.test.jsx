import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("../api/client", () => ({ default: { get: vi.fn().mockResolvedValue({ data: [] }) } }));
vi.mock("../services/socket", () => ({ connectSocket: vi.fn(() => null) }));

import { ProductsProvider, useProducts } from "./ProductsContext.jsx";

const StoreProbe = () => {
  const { products } = useProducts();
  return <main>Store is available ({products.length} products)</main>;
};

describe("ProductsProvider", () => {
  it("renders the public catalogue when there is no authenticated socket", () => {
    render(<ProductsProvider><StoreProbe /></ProductsProvider>);
    expect(screen.getByText("Store is available (0 products)")).toBeInTheDocument();
  });
});
