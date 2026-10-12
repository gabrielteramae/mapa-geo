import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { NorteApp } from "@/components/norte/NorteApp";
import "./styles.css";

const root = document.getElementById("root");
if (!root) throw new Error("faltou #root");

createRoot(root).render(
  <StrictMode>
    <NorteApp />
  </StrictMode>,
);
