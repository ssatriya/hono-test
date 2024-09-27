import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import ffmpeg from "fluent-ffmpeg";
import { readFileSync, statSync, writeFileSync } from "fs";
import path from "path";
import { exec } from "child_process";
import { Readable } from "stream";

const app = new Hono();

app.use("/api/*", cors());

app.get("/", (c) => {
  return c.text("Hello Hono!");
});

app.get("/health-check", (c) => {
  return c.json({ status: "Ok", date: new Date().toDateString() });
});

app.post("/api/upload", async (c) => {
  const body = await c.req.parseBody();
  const file = body["file"] as File;

  if (!file) {
    return c.json({ error: "No file uploaded" }, 400);
  }

  const gifFileBuffer = await file.arrayBuffer();
  const gifFilePath = path.join(__dirname, "uploads", file.name);

  writeFileSync(gifFilePath, Buffer.from(gifFileBuffer));

  const mp4FilePath = path.join(
    __dirname,
    "uploads",
    `${path.parse(file.name).name}.mp4`
  );

  try {
    await convertGIF(gifFilePath, mp4FilePath);
    const mp4FileBuffer = readFileSync(mp4FilePath);
    const fileStats = statSync(mp4FilePath);

    return c.body(mp4FileBuffer, 200, {
      "Content-Type": "video/mp4",
      "Content-Length": fileStats.size.toString(),
      "Content-Disposition": `attachment; filename="${path.basename(
        mp4FilePath
      )}"`,
    });
  } catch (error) {
    console.error(error);
    return c.json({ status: 500, error: "Conversion failed" });
  }
});

const port = 4000;
console.log(`Server is running on port ${port}`);

serve({
  fetch: app.fetch,
  port,
});

async function convertGIF(inputPath: string, outputPath: string) {
  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .output(outputPath)
      .on("end", () => {
        console.log("Conversion finished:", outputPath);
        resolve(outputPath);
      })
      .on("error", (err) => {
        console.error("Error during conversion:", err);
        reject(err);
      })
      .run();
  });
}
