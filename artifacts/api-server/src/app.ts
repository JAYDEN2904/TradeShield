import express, { type Express, type Request, type RequestHandler } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";
import { attachCurrentUser } from "./middlewares/auth";

export function createApp(sessionMiddleware: RequestHandler): Express {
  const app: Express = express();

  app.use(
    pinoHttp({
      logger,
      serializers: {
        req(req) {
          return {
            id: req.id,
            method: req.method,
            url: req.url?.split("?")[0],
          };
        },
        res(res) {
          return {
            statusCode: res.statusCode,
          };
        },
      },
    }),
  );
  app.use(cors());
  app.use(
    express.json({
      verify: (req: Request & { rawBody?: Buffer }, _res, buf) => {
        if (req.url?.includes("/webhooks/")) {
          req.rawBody = buf;
        }
      },
    }),
  );
  app.use(express.urlencoded({ extended: true }));

  app.set("trust proxy", 1);

  app.use(sessionMiddleware);
  app.use(attachCurrentUser);

  app.use("/api", router);

  return app;
}
