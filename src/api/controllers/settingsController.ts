import { Response } from 'express';
import mongoose from 'mongoose';
import Settings from '../models/settings';
import { IRequest } from '../middlewares/authMiddleware';
import { getIO } from '../../socket/socketInstance';

// Get current settings
export const getSettings = async (_req: IRequest, res: Response) => {
  try {
    let settings = await Settings.findOne().populate('lastUpdatedBy', 'fullName email');

    if (!settings) {
      // Create default settings if none exist
      settings = await Settings.create({
        maintenanceMode: false,
        maintenanceMessage: 'The app is currently under maintenance. Please try again later.',
        affectedServices: ['all'],
        lastUpdatedBy: _req.user?._id || new mongoose.Types.ObjectId(),
      });
    }

    res.status(200).json({
      status: true,
      data: settings,
      message: 'Settings retrieved successfully'
    });
  } catch (error: any) {
    console.error('❌ Get settings error:', error);
    res.status(500).json({
      status: false,
      message: error.message || 'Failed to get settings'
    });
  }
};

// Toggle maintenance mode
export const toggleMaintenanceMode = async (req: IRequest, res: Response) => {
  try {
    if (!req.user?.isAdmin) {
      return res.status(403).json({
        status: false,
        message: 'Admin privileges required'
      });
    }

    const { maintenanceMode, maintenanceMessage, affectedServices, maintenanceStartTime, maintenanceEndTime } = req.body;

    let settings = await Settings.findOne();

    if (!settings) {
      settings = new Settings({
        maintenanceMode: maintenanceMode ?? false,
        maintenanceMessage: maintenanceMessage || 'The app is currently under maintenance.',
        affectedServices: affectedServices || ['all'],
        maintenanceStartTime,
        maintenanceEndTime,
        lastUpdatedBy: req.user._id,
      });
    } else {
      if (maintenanceMode !== undefined) settings.maintenanceMode = maintenanceMode;
      if (maintenanceMessage) settings.maintenanceMessage = maintenanceMessage;
      if (affectedServices) settings.affectedServices = affectedServices;
      if (maintenanceStartTime) settings.maintenanceStartTime = maintenanceStartTime;
      if (maintenanceEndTime) settings.maintenanceEndTime = maintenanceEndTime;
      settings.lastUpdatedBy = req.user._id;
      settings.lastUpdatedAt = new Date();
    }

    await settings.save();

    // Broadcast maintenance status via Socket.IO
    const io = getIO();
    if (io) {
      io.emit('maintenance_status_changed', {
        maintenanceMode: settings.maintenanceMode,
        maintenanceMessage: settings.maintenanceMessage,
        affectedServices: settings.affectedServices,
      });
    }

    res.status(200).json({
      status: true,
      data: settings,
      message: maintenanceMode ? 'Maintenance mode enabled' : 'Maintenance mode disabled'
    });
  } catch (error: any) {
    console.error('❌ Toggle maintenance mode error:', error);
    res.status(500).json({
      status: false,
      message: error.message || 'Failed to update settings'
    });
  }
};

// Get maintenance status (no auth required - public endpoint)
export const getMaintenanceStatus = async (_req: IRequest, res: Response) => {
  try {
    const settings = await Settings.findOne().select('maintenanceMode maintenanceMessage affectedServices maintenanceStartTime maintenanceEndTime');

    const status = {
      maintenanceMode: settings?.maintenanceMode ?? false,
      maintenanceMessage: settings?.maintenanceMessage || '',
      affectedServices: settings?.affectedServices || ['all'],
      maintenanceStartTime: settings?.maintenanceStartTime,
      maintenanceEndTime: settings?.maintenanceEndTime,
    };

    res.status(200).json({
      status: true,
      data: status
    });
  } catch (error: any) {
    console.error('❌ Get maintenance status error:', error);
    res.status(200).json({
      status: true,
      data: {
        maintenanceMode: false,
        maintenanceMessage: '',
        affectedServices: [],
      }
    });
  }
};
