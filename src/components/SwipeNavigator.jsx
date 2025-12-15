import React, { useMemo, useRef, useState } from "react";

const SWIPE_THRESHOLD = 48;

const clampIndex = (index, length) => {
  if (index < 0) return 0;
  if (index >= length) return length - 1;
  return index;
};

const SwipeNavigator = ({
  activeView,
  views,
  onChange,
  children,
  className = "",
}) => {
  const touchStart = useRef({ x: 0, y: 0 });
  const [isSwiping, setIsSwiping] = useState(false);

  const orderedViews = useMemo(() => views.filter(Boolean), [views]);

  const startSwipe = (event) => {
    const touch = event.touches[0];
    touchStart.current = { x: touch.clientX, y: touch.clientY };
    setIsSwiping(true);
  };

  const endSwipe = (event) => {
    if (!isSwiping || orderedViews.length === 0) return;
    const touch = event.changedTouches[0];
    const deltaX = touch.clientX - touchStart.current.x;
    const deltaY = touch.clientY - touchStart.current.y;

    if (Math.abs(deltaY) > Math.abs(deltaX)) {
      setIsSwiping(false);
      return; // ignore vertical swipes to avoid fighting scroll
    }

    if (Math.abs(deltaX) > SWIPE_THRESHOLD) {
      const currentIndex = orderedViews.indexOf(activeView);
      if (currentIndex >= 0) {
        const direction = deltaX < 0 ? 1 : -1;
        const nextIndex = clampIndex(currentIndex + direction, orderedViews.length);
        const nextView = orderedViews[nextIndex];
        if (nextView && nextView !== activeView) {
          onChange?.(nextView);
        }
      }
    }

    setIsSwiping(false);
  };

  return (
    <div
      className={className}
      onTouchStart={startSwipe}
      onTouchEnd={endSwipe}
      role="presentation"
    >
      {children}
    </div>
  );
};

export default SwipeNavigator;
