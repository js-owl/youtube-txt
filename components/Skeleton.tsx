export default function Skeleton() {
  return (
    <div className="w-full animate-fade-in" aria-busy="true" aria-live="polite">
      {/* Шапка с миниатюрой */}
      <div className="flex items-center gap-3 mb-5">
        <div className="skeleton w-24 h-16 rounded-md" />
        <div className="flex-1 space-y-2">
          <div className="skeleton h-3.5 w-3/4" />
          <div className="skeleton h-3 w-1/2" />
        </div>
      </div>

      {/* Заголовок */}
      <div className="skeleton h-5 w-2/3 mb-4" />

      {/* Параграфы */}
      <div className="space-y-2 mb-4">
        <div className="skeleton h-3.5 w-full" />
        <div className="skeleton h-3.5 w-[92%]" />
        <div className="skeleton h-3.5 w-[80%]" />
      </div>

      <div className="skeleton h-4 w-1/3 mb-3" />

      <div className="space-y-2 mb-4">
        <div className="skeleton h-3.5 w-[95%]" />
        <div className="skeleton h-3.5 w-[88%]" />
        <div className="skeleton h-3.5 w-[70%]" />
      </div>

      <div className="skeleton h-4 w-1/4 mb-3" />

      <div className="space-y-2">
        <div className="skeleton h-3.5 w-[90%]" />
        <div className="skeleton h-3.5 w-[60%]" />
      </div>
    </div>
  );
}
