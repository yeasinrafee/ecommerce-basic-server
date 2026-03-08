import { Router } from 'express';
import { asyncHandler } from '../../common/utils/async-handler.js';
import { adminController } from './admin.controller.js';
import { createUploadMiddleware } from '../../common/utils/file-upload.js';

const router = Router();

const upload = createUploadMiddleware({ maxFileSizeInMB: 5, maxFileCount: 1 });

router.get('/get-all-paginated', asyncHandler(adminController.getAdmins));
router.get('/get-all', asyncHandler(adminController.getAllAdmins));
router.get('/get/:id', asyncHandler(adminController.getAdmin));
router.patch('/update/:id', upload.fields([{ name: 'image', maxCount: 1 }]), asyncHandler(adminController.updateAdmin));
router.patch('/update-status', asyncHandler(adminController.bulkUpdateStatus));
router.delete('/delete/:id', asyncHandler(adminController.deleteAdmin));

export const adminRoutes = router;
