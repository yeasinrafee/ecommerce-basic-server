import { Router } from 'express';
import { asyncHandler } from '../../common/utils/async-handler.js';
import { zonePolicyController } from './zone-policy.controller.js';

const router = Router();

router.get('/get-all-paginated', asyncHandler(zonePolicyController.getZonePolicies));
router.get('/get-all', asyncHandler(zonePolicyController.getAllZonePolicies));
router.get('/get/:id', asyncHandler(zonePolicyController.getZonePolicyById));
router.post('/create', asyncHandler(zonePolicyController.createZonePolicy));
router.patch('/bulk-update-status', asyncHandler(zonePolicyController.bulkUpdateStatus));
router.patch('/update/:id', asyncHandler(zonePolicyController.updateZonePolicy));
router.delete('/delete/:id', asyncHandler(zonePolicyController.deleteZonePolicy));

export const zonePolicyRoutes = router;
