import { Router } from "express";
import { asyncHandler } from "../../common/utils/async-handler.js";
import { authController } from "./auth.controller.js";
import { createUploadMiddleware } from "../../common/utils/file-upload.js";
import { Role } from "@prisma/client/edge";
import {
  authenticate,
  authorizeRoles,
} from "../../common/middlewares/auth.middleware.js";

const router = Router();
const upload = createUploadMiddleware({
  maxFileSizeInMB: 5,
  maxFileCount: 1,
});

router.post(
  "/admin/create",
  authenticate,
  authorizeRoles(Role.SUPER_ADMIN),
  upload.fields([{ name: "image", maxCount: 1 }]),
  asyncHandler(authController.createAdmin),
);

router.post("/refresh", asyncHandler(authController.refreshToken));

export const authRoutes = router;
