import { reactRenderer } from "@hono/react-renderer";
import { Link, ViteClient } from "vite-ssr-components/react";

export const renderer = reactRenderer(({ children }) => {
  return (
    <html lang="ja">
      <head>
        <meta charSet="utf-8" />
        <meta content="width=device-width, initial-scale=1" name="viewport" />
        <meta
          content="入力するだけで月々の返済額や完済時期が瞬時にわかるローンシミュレーター"
          name="description"
        />
        <meta content="#020617" name="theme-color" />
        <title>ローンプランナー | Loan Planner</title>
        <ViteClient />
        <Link href="/src/style.css" rel="stylesheet" />
      </head>
      <body className="antialiased selection:bg-primary/30 selection:text-primary-foreground">
        {children}
      </body>
    </html>
  );
});
