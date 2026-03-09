import { Router } from 'express';
import { asyncHandler } from '../../common/utils/async-handler.js';
import { zoneController } from './zone.controller.js';

const router = Router();

router.get('/get-all-paginated', asyncHandler(zoneController.getZones));
router.get('/get-all', asyncHandler(zoneController.getAllZones));
router.get('/get/:id', asyncHandler(zoneController.getZone));
router.post('/create', asyncHandler(zoneController.createZone));
router.patch('/update/:id', asyncHandler(zoneController.updateZone));
router.delete('/delete/:id', asyncHandler(zoneController.deleteZone));

export const zoneRoutes = router;
