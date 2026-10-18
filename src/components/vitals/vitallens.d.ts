// vitallens@0.4.7 publishes only `browser`/`node` export conditions and incomplete types
// (types/core.d.ts is missing), so TypeScript can't resolve it. The part the scan uses.
declare module "vitallens" {
  export class VitalLens {
    constructor(options: { method: "vitallens"; proxyUrl: string });
    setVideoStream(stream?: MediaStream, videoElement?: HTMLVideoElement): Promise<void>;
    startVideoStream(): void;
    stopVideoStream(): void;
    addEventListener(event: "vitals", callback: (result: unknown) => void): void;
    close(): Promise<void>;
  }
}
