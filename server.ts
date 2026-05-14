import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  app.get("/api/books/:isbn", async (req, res) => {
    const { isbn } = req.params;
    const cleanIsbn = isbn.replace(/[^0-9X]/gi, "");
    const apiKey = process.env.BOOKS_API_KEY;

    try {
      const results: any = { google: null, openlibrary: null };

      // Fetch from both in parallel
      const [googleResponse, olResponse] = await Promise.allSettled([
        fetch(`https://www.googleapis.com/books/v1/volumes?q=isbn:${cleanIsbn}${apiKey ? `&key=${apiKey}` : ""}`),
        fetch(`https://openlibrary.org/api/books?bibkeys=ISBN:${cleanIsbn}&format=json&jscmd=data`)
      ]);

      if (googleResponse.status === 'fulfilled' && googleResponse.value.ok) {
        results.google = await googleResponse.value.json();
      }

      if (olResponse.status === 'fulfilled' && olResponse.value.ok) {
        results.openlibrary = await olResponse.value.json();
      }

      res.json(results);
    } catch (error) {
      console.error("Error fetching book details:", error);
      res.status(500).json({ error: "Failed to fetch book details" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
