import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import api from "../api/client";
import { connectSocket } from "../services/socket";

const ProductsContext = createContext(null);

export const ProductsProvider = ({ children }) => {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refreshProducts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get("/products");
      setProducts(res.data);
    } catch (error) {
      setError(error?.response?.data?.message || "Failed to load products");
      toast.error("Failed to load products");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshProducts();
  }, [refreshProducts]);

  useEffect(() => {
    const socket = connectSocket();
    const onStockUpdated = ({ productId, newStock }) => {
      setProducts((prev) =>
        prev.map((p) => (String(p._id) === String(productId) ? { ...p, stock: newStock } : p))
      );
    };
    socket.on("stockUpdated", onStockUpdated);

    return () => {
      socket.off("stockUpdated", onStockUpdated);
    };
  }, []);

  const value = useMemo(() => ({ products, loading, error, refreshProducts, setProducts }), [products, loading, error, refreshProducts]);
  return <ProductsContext.Provider value={value}>{children}</ProductsContext.Provider>;
};

export const useProducts = () => useContext(ProductsContext);

