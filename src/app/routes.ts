import { createBrowserRouter } from "react-router";
import { Layout } from "./components/Layout";
import { Dashboard } from "./components/Dashboard";
import { Worklog } from "./components/Worklog";
import { Timeline } from "./components/Timeline";
import { TodoPage } from "./components/TodoPage";
import { AppBucketsPage } from "./components/AppBucketsPage";
import { IdeaHub } from "./components/ideas/IdeaHub";
import { IdeaDetail } from "./components/ideas/IdeaDetail";

export const router = createBrowserRouter([
  {
    path: "/",
    Component: Layout,
    children: [
      { index: true, Component: Dashboard },
      { path: "ideas", Component: IdeaHub },
      { path: "ideas/:id", Component: IdeaDetail },
      { path: "todo", Component: TodoPage },
      { path: "worklog", Component: Worklog },
      { path: "timeline", Component: Timeline },
      { path: "buckets", Component: AppBucketsPage },
    ],
  },
]);
