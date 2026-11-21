// Pure tap-vs-drag decision logic for the touch portrait store. Phaser only
// feeds it pointer coordinates; all state transitions live here so they can be
// exercised without a canvas or a device.
export const PAN_DRAG_THRESHOLD = 10;

export type PanGesture = {
  tracking: boolean;
  pointerId: number;
  startX: number;
  startY: number;
  startPanX: number;
  dragging: boolean;
};

export const NO_PAN_GESTURE: PanGesture = {
  tracking: false, pointerId: -1, startX: 0, startY: 0, startPanX: 0, dragging: false,
};

export type PanBounds = { minPanX: number; maxPanX: number };
export type PanAction =
  | { kind: 'none' }
  | { kind: 'pan'; panX: number }
  | { kind: 'tap'; x: number; y: number };

export function panGestureDown(gesture: PanGesture, pointerId: number,
  x: number, y: number, panX: number): PanGesture {
  if (gesture.tracking) return gesture; // ignore extra fingers
  return { tracking: true, pointerId, startX: x, startY: y, startPanX: panX, dragging: false };
}

export function panGestureMove(gesture: PanGesture, pointerId: number, x: number, y: number,
  bounds: PanBounds, threshold = PAN_DRAG_THRESHOLD): { gesture: PanGesture; action: PanAction } {
  if (!gesture.tracking || gesture.pointerId !== pointerId) return { gesture, action: { kind: 'none' } };
  const dx = x - gesture.startX;
  const dy = y - gesture.startY;
  // Axis lock: a mostly vertical move is not a browse gesture.
  const dragging = gesture.dragging || (Math.abs(dx) >= threshold && Math.abs(dx) > Math.abs(dy));
  if (!dragging) return { gesture, action: { kind: 'none' } };
  const panX = Math.max(bounds.minPanX, Math.min(bounds.maxPanX, gesture.startPanX + dx));
  return { gesture: { ...gesture, dragging: true }, action: { kind: 'pan', panX } };
}

export function panGestureUp(gesture: PanGesture, pointerId: number,
  x: number, y: number): { gesture: PanGesture; action: PanAction } {
  if (!gesture.tracking || gesture.pointerId !== pointerId) return { gesture, action: { kind: 'none' } };
  // A drag never becomes a tap: releasing over an item must not open its modal.
  const action: PanAction = gesture.dragging ? { kind: 'none' } : { kind: 'tap', x, y };
  return { gesture: NO_PAN_GESTURE, action };
}

export function panGestureCancel(gesture: PanGesture): PanGesture {
  return gesture.tracking ? NO_PAN_GESTURE : gesture;
}
