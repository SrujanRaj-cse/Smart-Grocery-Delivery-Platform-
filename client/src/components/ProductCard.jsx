import { useEffect, useMemo, useRef, useState } from "react";

const stockMeta = (stock) => {
  const s = Number(stock) || 0;
  if (s <= 0) return { label: "Out of Stock", className: "text-red-600" };
  if (s <= 10) return { label: `Only ${s} left`, className: "text-amber-600" };
  return { label: "In Stock", className: "text-emerald-700" };
};

const ProductCard = ({ product, onAdd, canEdit, onEdit, onDelete }) => {
  const [imgOk, setImgOk] = useState(true);
  const prevStockRef = useRef(Number(product.stock) || 0);
  const [flash, setFlash] = useState(false);

  const stock = useMemo(() => Number(product.stock) || 0, [product.stock]);
  const price = useMemo(() => Number(product.price) || 0, [product.price]);
  const meta = useMemo(() => stockMeta(stock), [stock]);
  const imageUrl = product.imageUrl;

  useEffect(() => {
    setImgOk(true);
  }, [product._id, imageUrl]);

  useEffect(() => {
    const prev = prevStockRef.current;
    if (prev !== stock) {
      setFlash(true);
      const t = setTimeout(() => setFlash(false), 650);
      prevStockRef.current = stock;
      return () => clearTimeout(t);
    }
  }, [stock]);

  return (
    <div className="transform rounded-2xl border bg-white shadow-sm transition duration-200 hover:shadow-lg hover:scale-[1.02]">
      <div className="h-40 w-full overflow-hidden rounded-t-2xl bg-slate-100">
        {imageUrl && imgOk ? (
          <img
            src={imageUrl}
            alt={product.name}
            className="h-full w-full object-cover"
            onError={() => setImgOk(false)}
          />
        ) : (
          <div className="flex h-full items-center justify-center px-2 text-center text-xs text-slate-400">
            No image
          </div>
        )}
      </div>
      <div className="p-4">
        <h3 className="text-sm font-semibold md:text-base lg:text-lg">{product.name}</h3>
        <p className="mt-2 h-10 overflow-hidden text-xs text-slate-600 md:h-12 md:text-sm">{product.description}</p>

        <div className={`mt-2 text-xs md:text-sm ${meta.className}`}>
          <span className={flash ? "animate-pulse" : ""}>{meta.label}</span>
        </div>

        <div className="mt-4 flex items-center justify-between gap-3">
          <span className="text-sm font-bold text-emerald-700 md:text-base">${price.toFixed(2)}</span>

          {canEdit ? (
            <div className="flex gap-2">
              <button className="rounded bg-blue-600 px-2 py-1 text-xs text-white" onClick={onEdit}>
                Edit
              </button>
              <button className="rounded bg-red-600 px-2 py-1 text-xs text-white" onClick={onDelete}>
                Delete
              </button>
            </div>
          ) : (
            <button
              disabled={stock === 0}
              className="rounded bg-emerald-600 px-4 py-2 text-sm text-white transition disabled:cursor-not-allowed disabled:opacity-50 md:px-3 md:py-1"
              onClick={onAdd}
            >
              Add
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProductCard;
