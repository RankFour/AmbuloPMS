import expressAsync from 'express-async-handler';
import propertiesServices from '../services/propertiesServices.js';
import { emitToProperty } from '../config/socket.js';

const createProperty = expressAsync(async (req, res) => {
  try {
    const display_image = req.files && req.files['display_image'] 
      ? req.files['display_image'][0].path 
      : "";

    const payload = { 
      ...req.body, 
      display_image: display_image || req.body.display_image || null
    };

    const response = await propertiesServices.createProperty(payload);
    res.json(response);
  } catch (error) {
    console.error("Error creating property:", error);
    res.status(500).json({ 
      message: error.message || "Failed to create property"
    });
  }
});

const getProperties = expressAsync(async (req, res) => {
  try {
    const response = await propertiesServices.getProperties(req.query);
    res.json(response);
  } catch (error) {
    console.error("Error getting properties:", error);
    res.status(500).json({ 
      message: error.message || "Failed to get properties"
    });
  }
});

const getSinglePropertyById = expressAsync(async (req, res) => {
    try {
        const response = await propertiesServices.getSinglePropertyById(req.params.property_id);
        res.json(response);
    } catch (error) {
        console.error("Error getting property:", error);
        
        if (error.message === "Property not found") {
            res.status(404).json({
                message: "Property not found",
                error: error.message
            });
        } else {
            res.status(500).json({
                message: "Failed to get property",
                error: error.message
            });
        }
    }
});



const editPropertyById = expressAsync(async (req, res) => {
    try {
        const display_image = req.files && req.files['display_image'] 
          ? req.files['display_image'][0].path 
          : "";

        const showcase_images = req.files && req.files['showcase_images']
          ? req.files['showcase_images'].map(file => file.path)
          : [];

        let payload = { ...req.body };
        
        if (display_image) {
            payload.display_image = display_image;
        } else if (payload.remove_display_image === 'true') {
            payload.display_image = null; 
        }

        if (showcase_images.length > 0) {
            payload.showcase_images = showcase_images;
        }

        if (payload.showcase_descriptions) {
            if (!Array.isArray(payload.showcase_descriptions)) {
                payload.showcase_descriptions = [payload.showcase_descriptions];
            }
        } else {
            payload.showcase_descriptions = [];
        }

        if (payload.existing_image_ids) {
            if (!Array.isArray(payload.existing_image_ids)) {
                payload.existing_image_ids = [payload.existing_image_ids];
            }
            payload.existing_image_ids = payload.existing_image_ids
                .map(id => parseInt(id))
                .filter(id => !isNaN(id) && id > 0);
        } else {
            payload.existing_image_ids = [];
        }

        if (payload.existing_descriptions) {
            if (!Array.isArray(payload.existing_descriptions)) {
                payload.existing_descriptions = [payload.existing_descriptions];
            }
        } else {
            payload.existing_descriptions = [];
        }

        if (payload.deleted_image_ids) {
            if (!Array.isArray(payload.deleted_image_ids)) {
                payload.deleted_image_ids = [payload.deleted_image_ids];
            }
            payload.deleted_image_ids = payload.deleted_image_ids
                .map(id => parseInt(id))
                .filter(id => !isNaN(id) && id > 0);
        } else {
            payload.deleted_image_ids = [];
        }

        

        const response = await propertiesServices.editPropertyById(req.params.property_id, payload);

        // Emit real-time event to tenants subscribed to this property's room if status changed
        try {
            if (response?.statusChanged) {
                const io = req.app.get('io');
                if (io) {
                    emitToProperty(io, req.params.property_id, 'property_status_changed', {
                        property_id: req.params.property_id,
                        property_name: response?.property?.property_name || undefined,
                        old_status: response?.prevStatus,
                        new_status: response?.newStatus,
                        changed_at: new Date().toISOString()
                    });
                }
            }
        } catch (emitErr) {
            console.warn('Socket emit failed for property status change:', emitErr?.message || emitErr);
        }

        res.json(response);
    } catch (error) {
        console.error("Error updating property:", error);
        
        if (error.message === "Property not found") {
            res.status(404).json({
                message: "Property not found",
                error: error.message
            });
        } else if (error.message === "No valid fields to update") {
            res.status(400).json({
                message: "No valid fields to update",
                error: error.message
            });
        } else {
            res.status(500).json({
                message: "Failed to update property",
                error: error.message
            });
        }
    }
});

const deletePropertyById = expressAsync(async (req, res) => {
    try {
        const response = await propertiesServices.deletePropertyById(req.params.property_id);
        res.json(response);
    } catch (error) {
        console.error("Error deleting property:", error);
        
        if (error.message === "Property not found") {
            res.status(404).json({
                message: "Property not found",
                error: error.message
            });
        } else if (error.message === "Cannot delete property with active tenants") {
            res.status(400).json({
                message: "Cannot delete property with active tenants",
                error: error.message
            });
        } else {
            res.status(500).json({
                message: "Failed to delete property",
                error: error.message
            });
        }
    }
});

export {
  createProperty,
  getProperties,
  getSinglePropertyById,
  editPropertyById,
  deletePropertyById,
}