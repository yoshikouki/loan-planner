/** @jsxImportSource react */
import { Hono } from "hono";
import LoanPlanner from "./components/LoanPlanner";
import { renderer } from "./renderer";

const app = new Hono();

app.use(renderer);

app.get("/", (c) => {
  return c.render(<LoanPlanner />);
});

export default app;
