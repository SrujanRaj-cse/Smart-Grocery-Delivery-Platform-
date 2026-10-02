import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import ProductCard from "./ProductCard.jsx";

describe("ProductCard", () => {
  const product = { _id: "p-1", name: "Fresh Milk", description: "Daily dairy", price: 29, stock: 4, imageUrl: "" };

  it("shows a localized price and calls add when selected", () => {
    const onAdd = vi.fn();
    render(<ProductCard product={product} canEdit={false} onAdd={onAdd} />);
    expect(screen.getByText("Fresh Milk")).toBeInTheDocument();
    expect(screen.getByText("₹29.00")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Add" }));
    expect(onAdd).toHaveBeenCalledOnce();
  });

  it("disables add when the product is out of stock", () => {
    render(<ProductCard product={{ ...product, stock: 0 }} canEdit={false} onAdd={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Add" })).toBeDisabled();
    expect(screen.getByText("Out of Stock")).toBeInTheDocument();
  });
});
