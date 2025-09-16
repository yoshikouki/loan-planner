/** @jsxImportSource react */
import { Hono } from "hono";
import { renderer } from "./renderer";
import Hero from "./components/Hero";

const app = new Hono();

app.use(renderer);

app.get("/", (c) => {
  return c.render(<Hero />);
});

export default app;
