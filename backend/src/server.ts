import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { config } from "./lib/config";
import { authRouter } from "./routes/auth";
import { usersRouter } from "./routes/users";
import { projectsRouter } from "./routes/projects";
import { tasksRouter } from "./routes/tasks";
import { remindersRouter } from "./routes/reminders";
import { dashboardRouter } from "./routes/dashboard";
import { subtasksRouter } from "./routes/subtasks";
import { attachmentsRouter, UPLOAD_DIR } from "./routes/attachments";
import { activityRouter } from "./routes/activity";
import { chatRouter } from "./routes/chat";
import { notificationsRouter } from "./routes/notifications";
import { pushRouter } from "./routes/push";
import { eventsRouter } from "./routes/events";
import { reportsRouter } from "./routes/reports";
import { errorHandler, notFound } from "./middleware/error";

const app = express();

// CORS — terima localhost + IP LAN (192.168.x.x, 10.x.x.x, 172.16-31.x.x)
// di port frontend yang dipakai. Saat di-deploy ke domain produksi,
// nilai APP_URL akan jadi single allowed origin.
const allowedOriginPatterns = [
  /^https?:\/\/localhost(:\d+)?$/,
  /^https?:\/\/127\.0\.0\.1(:\d+)?$/,
  /^https?:\/\/192\.168\.\d+\.\d+(:\d+)?$/,
  /^https?:\/\/10\.\d+\.\d+\.\d+(:\d+)?$/,
  /^https?:\/\/172\.(1[6-9]|2\d|3[0-1])\.\d+\.\d+(:\d+)?$/,
];

app.use(
  cors({
    origin: (origin, cb) => {
      if (!origin) return cb(null, true); // curl, mobile app
      if (origin === config.appUrl) return cb(null, true);
      if (allowedOriginPatterns.some((re) => re.test(origin))) return cb(null, true);
      cb(new Error(`Origin ${origin} tidak diizinkan oleh CORS`));
    },
    credentials: true,
  })
);
app.use(express.json({ limit: "1mb" }));
app.use(cookieParser());

// Static file serving untuk attachment
app.use(
  "/uploads",
  express.static(UPLOAD_DIR, {
    maxAge: "7d",
    fallthrough: false,
  })
);

app.get("/api/health", (_req, res) => res.json({ ok: true, ts: Date.now() }));

app.use("/api/auth", authRouter);
app.use("/api/users", usersRouter);
app.use("/api/projects", projectsRouter);
app.use("/api/projects/:projectId/messages", chatRouter);
app.use("/api/projects/:projectId", reportsRouter);
app.use("/api/tasks", tasksRouter);
app.use("/api/tasks/:taskId/subtasks", subtasksRouter);
app.use("/api/tasks/:taskId/attachments", attachmentsRouter);
app.use("/api/reminders", remindersRouter);
app.use("/api/activity", activityRouter);
app.use("/api/notifications", notificationsRouter);
app.use("/api/push", pushRouter);
app.use("/api/events", eventsRouter);
app.use("/api/dashboard", dashboardRouter);

app.use(notFound);
app.use(errorHandler);

app.listen(config.port, () => {
  console.log(`[api] listening on http://localhost:${config.port}`);
});
