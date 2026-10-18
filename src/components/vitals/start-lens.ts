// Camera → VitalLens, in the order the library needs. Its stream code attaches the camera to the
// <video> only in startVideoStream(), and a <video> without a source never settles play(): so the
// video gets its stream first (as VitalLens's own webcam widget does), and the library plays it.
export type LensControls = {
  setVideoStream(stream: MediaStream, video: HTMLVideoElement): Promise<void>;
  startVideoStream(): void;
};

export async function startLens(lens: LensControls, stream: MediaStream, video: HTMLVideoElement): Promise<void> {
  video.srcObject = stream;
  await lens.setVideoStream(stream, video);
  lens.startVideoStream();
}
