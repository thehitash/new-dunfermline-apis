import { Request, Response, NextFunction } from 'express';
import Settings from '../models/settings';

export const checkMaintenance = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const settings = await Settings.findOne();

    if (settings?.maintenanceMode) {
      // Skip check for certain endpoints (settings, admin endpoints, auth)
      if (
        req.path.includes('/api/settings') ||
        req.path.includes('/api/admin') ||
        req.path.includes('/api/auth')
      ) {
        return next();
      }

      // Check if maintenance affects this service
      const affectedServices = settings.affectedServices || ['all'];
      const endpoint = req.path.split('/')[2]; // Extract service name (ride, payment, etc)

      const isAffected = affectedServices.includes('all') || affectedServices.includes(endpoint);

      if (isAffected) {
        return res.status(503).json({
          status: false,
          message: settings.maintenanceMessage,
          maintenanceMode: true,
          retryAfter: settings.maintenanceEndTime
        });
      }
    }

    next();
  } catch (error) {
    // If error checking maintenance, continue normally
    console.error('❌ Maintenance check error:', error);
    next();
  }
};
