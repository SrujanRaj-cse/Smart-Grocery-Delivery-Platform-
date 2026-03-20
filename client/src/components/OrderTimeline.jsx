const OrderTimeline = ({ status }) => {
  const steps = [
    { key: "confirmed", label: "Confirmed" },
    { key: "assigned", label: "Assigned" },
    { key: "picked", label: "Picked" },
    { key: "delivered", label: "Delivered" },
  ];

  const currentIndex = steps.findIndex((s) => s.key === status);

  const renderDot = (completed) => (
    <span
      className={[
        "inline-flex h-3 w-3 items-center justify-center rounded-full",
        completed ? "bg-emerald-600" : "bg-slate-300",
      ].join(" ")}
    >
      {completed ? <span className="text-[10px] font-bold text-white">✓</span> : null}
    </span>
  );

  return (
    <div className="flex flex-col gap-2">
      {steps.map((s, idx) => {
        const completed = currentIndex !== -1 ? idx <= currentIndex : false;
        return (
          <div key={s.key} className="flex items-center gap-2">
            {renderDot(completed)}
            <div className="text-sm">
              <span className={completed ? "font-semibold text-slate-900" : "text-slate-500"}>{s.label}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default OrderTimeline;

