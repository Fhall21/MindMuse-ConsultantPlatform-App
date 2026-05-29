import {
  computeSpatialLayout,
  type SpatialLayoutInput,
} from "@/lib/canvas-spatial-layout-core";

self.onmessage = (e: MessageEvent<SpatialLayoutInput>) => {
  (self as unknown as Worker).postMessage(computeSpatialLayout(e.data));
};
