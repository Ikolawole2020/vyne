export default function RouteSkeleton() {
  return (
    <div className="route-fallback">
      <div className="skeleton-stack" aria-hidden="true">
        <div className="sk title" />
        <div className="sk w80" />
        <div className="sk w60" />
        <div className="sk block" />
        <div className="sk w40" />
      </div>
    </div>
  );
}
