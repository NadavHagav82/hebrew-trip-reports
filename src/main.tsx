import { createRoot } from "react-dom/client";
import { Buffer } from "buffer";
import App from "./App.tsx";
import "./index.css";

// @react-pdf/renderer expects Buffer to exist (Node-like global). Vite doesn't polyfill it by default.
if (!(globalThis as any).Buffer) {
  (globalThis as any).Buffer = Buffer;
}

createRoot(document.getElementById("root")!).render(<App />);
