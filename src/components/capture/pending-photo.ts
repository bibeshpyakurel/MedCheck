// Carries a photo picked on the capture page over to the photo page (a client-side navigation keeps
// this module alive), so "Take a photo" opens the camera from the first screen. A reload loses it;
// the photo page then shows its own camera and library buttons.
let pending: File | null = null;

export function setPendingPhoto(file: File): void {
  pending = file;
}

/** Returns the waiting photo once, then forgets it. */
export function takePendingPhoto(): File | null {
  const file = pending;
  pending = null;
  return file;
}
