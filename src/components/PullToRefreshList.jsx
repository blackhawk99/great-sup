import React, { useRef, useState } from "react";

const PULL_THRESHOLD = 60;
const MAX_PULL = 140;

const PullToRefreshList = ({
  children,
  onRefresh,
  className = "",
  loaderLabel = "Refreshing",
}) => {
  const [pullDistance, setPullDistance] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const startY = useRef(null);
  const containerRef = useRef(null);

  const handleTouchStart = (event) => {
    if (refreshing) return;
    startY.current = event.touches[0].clientY;
  };

  const handleTouchMove = (event) => {
    if (refreshing || startY.current === null) return;
    const currentY = event.touches[0].clientY;
    const distance = currentY - startY.current;

    const scrollTop = containerRef.current?.scrollTop ?? 0;
    if (scrollTop > 0 || distance < 0) return; // allow only downward pulls from the top

    setPullDistance(Math.min(distance, MAX_PULL));
  };

  const handleTouchEnd = async () => {
    if (refreshing || startY.current === null) return;
    if (pullDistance >= PULL_THRESHOLD) {
      setRefreshing(true);
      await Promise.resolve(onRefresh?.());
    }
    setPullDistance(0);
    setRefreshing(false);
    startY.current = null;
  };

  const indicatorOpacity = Math.min(pullDistance / PULL_THRESHOLD, 1);

  return (
    <div
      ref={containerRef}
      className={`relative overflow-y-auto ${className}`}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchEnd}
    >
      <div
        className="sticky top-0 z-10 flex h-10 items-center justify-center text-xs font-semibold text-blue-700"
        style={{
          transform: `translateY(${Math.max(pullDistance - 40, 0)}px)` ,
          opacity: indicatorOpacity,
          transition: refreshing ? "opacity 200ms ease" : undefined,
        }}
        aria-live="polite"
      >
        {refreshing ? `${loaderLabel}…` : pullDistance >= PULL_THRESHOLD ? "Release to refresh" : "Pull to refresh"}
      </div>
      <div style={{ transform: `translateY(${pullDistance / 4}px)`, transition: refreshing ? "transform 180ms ease" : "" }}>
        {children}
      </div>
    </div>
  );
};

export default PullToRefreshList;
