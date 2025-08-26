import { Hono } from "hono";
import { renderer } from "./renderer";
import { motion } from "motion/react";
import { EarthIcon } from "lucide-react";

const app = new Hono();

app.use(renderer);

app.get("/", (c) => {
  return c.render(
    <motion.h1
      className="text-3xl font-bold flex items-center gap-2"
      initial={{ opacity: 1 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 1 }}
    >
      {/* 左右にふっくり震える Lucide のロゴを表示 */}
      <motion.div
        className="text-red-500"
        animate={{ x: 100 }}
        transition={{ repeat: Infinity, duration: 1, ease: "easeInOut" }}
      >
        <EarthIcon className="w-10 h-10" />
      </motion.div>
      Hello!
    </motion.h1>
  );
});

export default app;
