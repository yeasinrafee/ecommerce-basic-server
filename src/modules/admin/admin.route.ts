import { Router } from 'express';
import { asyncHandler } from '../../common/utils/async-handler.js';
import { adminController } from './admin.controller.js';

const router = Router();

router.get('/get-all-paginated', asyncHandler(adminController.getAdmins));
router.get('/get-all', asyncHandler(adminController.getAllAdmins));
router.get('/get/:id', asyncHandler(adminController.getAdmin));
router.patch('/update/:id', asyncHandler(adminController.updateAdmin));
router.delete('/delete/:id', asyncHandler(adminController.deleteAdmin));

export const adminRoutes = router;
