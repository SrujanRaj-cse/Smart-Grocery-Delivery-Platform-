import { createContext, useContext, useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import api from "../api/client";
import { useAuth } from "./AuthContext";
import { connectSocket } from "../services/socket";

const CartContext = createContext(null);

export const CartProvider = ({ children }) => {
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);

  const cartCount = useMemo(() => items.reduce((sum, item) => sum + item.quantity, 0), [items]);

  const syncCart = async () => {
    if (!user) {
      setItems([]);
      return;
    }
    setLoading(true);
    try {
      const res = await api.get("/api/cart");
      setItems(res.data.items);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    syncCart();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?._id]);

  // Keep cart UI in sync with server stock changes.
  useEffect(() => {
    const socket = connectSocket();
    const onStockUpdated = ({ productId, newStock }) => {
      setItems((prev) =>
        prev.map((it) =>
          String(it.product?._id) === String(productId)
            ? { ...it, product: { ...it.product, stock: newStock } }
            : it
        )
      );
    };
    socket.on("stockUpdated", onStockUpdated);
    return () => {
      socket.off("stockUpdated", onStockUpdated);
    };
  }, []);

  const addToCart = async ({ productId, quantity }) => {
    if (!user) {
      toast.error("Please login to add items to cart");
      return;
    }
    setLoading(true);
    try {
      const res = await api.post("/api/cart/add", { productId, quantity });
      setItems(res.data.items);
      toast.success("Item added to cart");
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to add to cart");
    } finally {
      setLoading(false);
    }
  };

  const updateQty = (productId, quantity) => {
    // Keep this function async-looking in UI; it updates state after backend validation.
    const qty = Number(quantity);
    if (!user) return;
    return api
      .patch("/api/cart/item", { productId, quantity: qty })
      .then((res) => setItems(res.data.items))
      .catch((error) => toast.error(error.response?.data?.message || "Failed to update cart"));
  };

  const removeFromCart = async (productId) => {
    if (!user) return;
    setLoading(true);
    try {
      const res = await api.post("/api/cart/remove", { productId });
      setItems(res.data.items);
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to remove item");
    } finally {
      setLoading(false);
    }
  };

  const clearCart = () => setItems([]);

  const total = useMemo(
    () => items.reduce((sum, item) => sum + item.product.price * item.quantity, 0),
    [items]
  );

  const value = {
    items,
    loading,
    cartCount,
    addToCart,
    updateQty,
    removeFromCart,
    clearCart,
    total,
    syncCart,
  };

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
};

export const useCart = () => useContext(CartContext);
