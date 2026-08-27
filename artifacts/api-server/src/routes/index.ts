import { Router, type IRouter } from "express";
import healthRouter from "./health";
import adminAuthRouter from "./admin-auth";
import storageRouter from "./storage";
import toursRouter from "./tours";
import activitiesRouter from "./activities";
import locationsRouter from "./locations";
import countriesRouter from "./countries";
import destinationsRouter from "./destinations";
import categoriesRouter from "./categories";
import journalsRouter from "./journals";
import statsRouter from "./stats";
import enquiriesRouter from "./enquiries";

const router: IRouter = Router();

router.use(healthRouter);
router.use(adminAuthRouter);
router.use(storageRouter);
router.use(toursRouter);
router.use(activitiesRouter);
router.use(locationsRouter);
router.use(countriesRouter);
router.use(destinationsRouter);
router.use(categoriesRouter);
router.use(journalsRouter);
router.use(enquiriesRouter);
router.use(statsRouter);

export default router;
