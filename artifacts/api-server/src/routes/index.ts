import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import usersRouter from "./users";
import productsRouter from "./products";
import ordersRouter from "./orders";
import webhooksRouter from "./webhooks";
import adminRouter from "./admin";
import kycRouter from "./kyc";
import uploadsRouter from "./uploads";
import notificationsRouter from "./notifications";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(usersRouter);
router.use(productsRouter);
router.use(ordersRouter);
router.use(webhooksRouter);
router.use(adminRouter);
router.use(kycRouter);
router.use(uploadsRouter);
router.use(notificationsRouter);

export default router;
