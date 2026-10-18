import { describe, expect, it } from "vitest";
import { startLens, type LensControls } from "./start-lens";

function fakes() {
  const calls: string[] = [];
  const stream = {} as MediaStream;
  const video = {
    srcObject: null as MediaStream | null,
    // A <video> with no source never settles play(); one with a stream resolves.
    play() {
      calls.push(`play(src=${this.srcObject ? "stream" : "none"})`);
      return this.srcObject ? Promise.resolve() : new Promise<void>(() => {});
    },
  };
  const lens: LensControls = {
    async setVideoStream(s, v) {
      calls.push(`setVideoStream(src=${v?.srcObject === s ? "stream" : "none"})`);
    },
    startVideoStream() {
      calls.push("startVideoStream");
    },
  };
  return { calls, stream, video: video as unknown as HTMLVideoElement & typeof video, lens };
}

describe("startLens (camera → VitalLens, in the order the library needs)", () => {
  it("gives the video its stream before VitalLens takes it, then starts the scan", async () => {
    const { calls, stream, video, lens } = fakes();
    await startLens(lens, stream, video);
    expect(video.srcObject).toBe(stream);
    expect(calls).toEqual(["setVideoStream(src=stream)", "startVideoStream"]);
  });

  it("never waits on play() of a video without a source (it would never settle)", async () => {
    const { stream, video, lens } = fakes();
    const done = await Promise.race([startLens(lens, stream, video).then(() => "started"), new Promise((r) => setTimeout(() => r("hung"), 50))]);
    expect(done).toBe("started");
  });
});
