const EmptyState = ({ title, description }) => {
  return (
    <div className="rounded-2xl border bg-white p-6 text-center shadow-sm">
      <p className="text-lg font-semibold">{title}</p>
      {description ? <p className="mt-2 text-sm text-slate-600">{description}</p> : null}
    </div>
  );
};

export default EmptyState;

