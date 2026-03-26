import { createBrowserRouter } from "react-router";
import { Layout } from "./components/Layout";
import { Dashboard } from "./components/Dashboard";
import { Worklog } from "./components/Worklog";
import { Timeline } from "./components/Timeline";

export const router = createBrowserRouter([
  {
    path: "/",
    Component: Layout,
    children: [
      { index: true, Component: Dashboard },
      { path: "worklog", Component: Worklog },
      { path: "timeline", Component: Timeline },
    ],
  },
]);
