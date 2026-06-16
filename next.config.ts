import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // OCR stack ships native binaries / WASM that must not be bundled by Turbopack;
  // load them from node_modules at runtime instead.
  serverExternalPackages: [
    "ppu-paddle-ocr",
    "onnxruntime-node",
    "@napi-rs/canvas",
    "@techstark/opencv-js",
  ],
};

export default nextConfig;
