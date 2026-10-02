const formatter = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 });

export const formatCurrency = (value) => formatter.format(Number(value) || 0);
