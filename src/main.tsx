import React, { lazy } from "react";
import ReactDOM from "react-dom/client";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import ChaiStudio from "./ChaiStudio";
import Preview from "./Preview";
import "./data-providers/data";
import RJSF from "./RJSF.tsx";
import "./index.css";

async function enableMocking() {
  if (import.meta.env.MODE !== "development") {
    return;
  }

  const { worker } = await import("./mock/browser");

  // `worker.start()` returns a Promise that resolves
  // once the Service Worker is up and ready to intercept requests.
  return worker.start();
}

const ChaiBuilderDefault = lazy(() => import("./Editor.tsx"));
const ChaiBuilderEmail = lazy(() => import("./Email.tsx"));

const router = createBrowserRouter([
  {
    path: "/",
    element: <ChaiBuilderDefault />,
  },
  {
    path: "/email",
    element: <ChaiBuilderEmail />,
  },
  {
    path: "/studio",
    element: <ChaiStudio />,
  },
  {
    path: "/preview",
    element: <Preview />,
  },
  {
    path: "/rjsf",
    element: <RJSF />,
  },
]);

enableMocking().then(() => {
  ReactDOM.createRoot(document.getElementById("root")!).render(
    <React.StrictMode>
      <RouterProvider router={router} />
    </React.StrictMode>,
  );
});
