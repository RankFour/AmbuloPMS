import { v4 as uuidv4 } from "uuid";
import conn from "./../config/db.js";

const pool = await conn();

const createProperty = async (propertyData = {}) => {
  const {
    property_name,
    floor_area_sqm,
    description,
    display_image,
    property_status,
    base_rent,
    advance_months,
    security_deposit_months,
    minimum_lease_term_months,
    address_id,
    building_name,
    street,
    barangay,
    city,
    province,
    postal_code,
    country,
    latitude,
    longitude,
  } = propertyData || {};

  const property_id = uuidv4();
  let finalAddressId = address_id;

  try {
    if (!address_id && (street || city)) {
      const newAddress = {
        building_name: building_name || null,
        street: street || null,
        barangay: barangay || null,
        city: city || null,
        province: province || null,
        postal_code: postal_code || null,
        country: country || "Philippines",
        latitude: latitude || null,
        longitude: longitude || null,
      };

      Object.keys(newAddress).forEach(
        (key) => newAddress[key] === undefined && delete newAddress[key]
      );

      const addressFields = Object.keys(newAddress).join(", ");
      const addressPlaceholders = Object.keys(newAddress)
        .map(() => "?")
        .join(", ");
      const addressValues = Object.values(newAddress);

      const addressQuery = `INSERT INTO addresses (${addressFields}, created_at, updated_at) VALUES (${addressPlaceholders}, NOW(), NOW())`;

      const [addressResult] = await pool.query(addressQuery, addressValues);

      finalAddressId = addressResult.insertId;
    }

    const newProperty = {
      property_id: property_id,
      property_name,
      floor_area_sqm: floor_area_sqm ? parseFloat(floor_area_sqm) : null,
      description,
      display_image,
      property_status: property_status || "Available",
      base_rent: base_rent ? parseFloat(base_rent) : null,
      advance_months: advance_months ? parseInt(advance_months) : null,
      security_deposit_months: security_deposit_months
        ? parseInt(security_deposit_months)
        : null,
      minimum_lease_term_months: minimum_lease_term_months
        ? parseInt(minimum_lease_term_months)
        : 24,
      address_id: finalAddressId || null,
    };

    Object.keys(newProperty).forEach(
      (key) => newProperty[key] === undefined && delete newProperty[key]
    );

    const fields = Object.keys(newProperty).join(", ");
    const placeholders = Object.keys(newProperty)
      .map(() => "?")
      .join(", ");
    const values = Object.values(newProperty);

    const query = `INSERT INTO properties (${fields}, created_at, updated_at) VALUES (${placeholders}, NOW(), NOW())`;

    const [result] = await pool.query(query, values);
    return {
      message: "Property has been successfully created!",
      propertyId: property_id,
      addressId: finalAddressId,
      propertyData: newProperty,
      insertId: result.insertId,
    };
  } catch (error) {
    console.error("Error creating property:", error);
    console.error("Error details:", error.message);
    throw new Error(error.message || "Failed to create property");
  }
};

const getProperties = async (queryObj = {}) => {
  try {
    let query = `
      SELECT 
        p.property_id,
        p.property_name,
        p.floor_area_sqm,
        p.description,
        p.display_image,
        p.property_status,
        p.base_rent,
        p.advance_months,
        p.security_deposit_months,
        p.minimum_lease_term_months,
        p.address_id,
        p.created_at,
        p.updated_at,
        a.building_name,
        a.street,
        a.barangay,
        a.city,
        a.province,
        a.postal_code,
        a.country,
        a.latitude,
        a.longitude
      FROM properties p
      LEFT JOIN addresses a ON p.address_id = a.address_id
      WHERE p.property_status != 'deleted'
    `;

    const values = [];

    if (queryObj.address_id && queryObj.address_id !== "all") {
      query += ` AND p.address_id = ?`;
      values.push(queryObj.address_id);
    }

    if (queryObj.property_status && queryObj.property_status !== "all") {
      query += ` AND p.property_status = ?`;
      values.push(queryObj.property_status);
    }

    if (queryObj.search) {
      query += ` AND (p.property_name LIKE ? OR a.building_name LIKE ? OR a.street LIKE ? OR a.city LIKE ? OR p.description LIKE ?)`;
      const searchTerm = `%${queryObj.search}%`;
      values.push(searchTerm, searchTerm, searchTerm, searchTerm, searchTerm);
    }

    if (queryObj.min_rent) {
      query += ` AND p.base_rent >= ?`;
      values.push(parseFloat(queryObj.min_rent));
    }
    if (queryObj.max_rent) {
      query += ` AND p.base_rent <= ?`;
      values.push(parseFloat(queryObj.max_rent));
    }
    if (queryObj.min_area) {
      query += ` AND p.floor_area_sqm >= ?`;
      values.push(parseFloat(queryObj.min_area));
    }
    if (queryObj.max_area) {
      query += ` AND p.floor_area_sqm <= ?`;
      values.push(parseFloat(queryObj.max_area));
    }
    if (queryObj.city) {
      query += ` AND a.city = ?`;
      values.push(queryObj.city);
    }

    query += ` ORDER BY p.created_at DESC`;

    const page = parseInt(queryObj.page) > 0 ? parseInt(queryObj.page) : 1;
    const limit = parseInt(queryObj.limit) > 0 ? parseInt(queryObj.limit) : 6;
    const offset = (page - 1) * limit;

    query += ` LIMIT ? OFFSET ?`;
    values.push(limit, offset);

    const [rows] = await pool.query(query, values);

    const propertyIds = rows.map((r) => r.property_id);
    let picturesMap = {};
    if (propertyIds.length > 0) {
      const [pictures] = await pool.query(
        `SELECT property_id, image_id as id, image_url, image_desc, created_at, updated_at
         FROM properties_pictures
         WHERE property_id IN (${propertyIds.map(() => "?").join(",")})`,
        propertyIds
      );

      picturesMap = pictures.reduce((acc, pic) => {
        if (!acc[pic.property_id]) acc[pic.property_id] = [];
        acc[pic.property_id].push({
          id: pic.id,
          image_url: pic.image_url,
          image_desc: pic.image_desc,
          created_at: pic.created_at,
          updated_at: pic.updated_at,
        });
        return acc;
      }, {});
    }

    const processedRows = rows.map((row) => ({
      ...row,
      property_pictures: picturesMap[row.property_id] || [],
    }));

    let countQuery = `
      SELECT COUNT(DISTINCT p.property_id) as total 
      FROM properties p
      LEFT JOIN addresses a ON p.address_id = a.address_id
      WHERE p.property_status != 'deleted'
    `;
    const countValues = [];
    if (queryObj.address_id && queryObj.address_id !== "all") {
      countQuery += ` AND p.address_id = ?`;
      countValues.push(queryObj.address_id);
    }
    if (queryObj.property_status && queryObj.property_status !== "all") {
      countQuery += ` AND p.property_status = ?`;
      countValues.push(queryObj.property_status);
    }
    if (queryObj.search) {
      countQuery += ` AND (p.property_name LIKE ? OR a.building_name LIKE ? OR a.street LIKE ? OR a.city LIKE ? OR p.description LIKE ?)`;
      const searchTerm = `%${queryObj.search}%`;
      countValues.push(
        searchTerm,
        searchTerm,
        searchTerm,
        searchTerm,
        searchTerm
      );
    }
    if (queryObj.min_rent) {
      countQuery += ` AND p.base_rent >= ?`;
      countValues.push(parseFloat(queryObj.min_rent));
    }
    if (queryObj.max_rent) {
      countQuery += ` AND p.base_rent <= ?`;
      countValues.push(parseFloat(queryObj.max_rent));
    }
    if (queryObj.min_area) {
      countQuery += ` AND p.floor_area_sqm >= ?`;
      countValues.push(parseFloat(queryObj.min_area));
    }
    if (queryObj.max_area) {
      countQuery += ` AND p.floor_area_sqm <= ?`;
      countValues.push(parseFloat(queryObj.max_area));
    }
    if (queryObj.city) {
      countQuery += ` AND a.city = ?`;
      countValues.push(queryObj.city);
    }

    const [countResult] = await pool.query(countQuery, countValues);

    return {
      message: "Properties retrieved successfully",
      properties: processedRows,
      total: countResult[0].total,
      page: queryObj.page || 1,
      limit: queryObj.limit || processedRows.length,
    };
  } catch (error) {
    console.error("Error getting properties:", error);
    throw new Error(error.message || "Failed to get properties");
  }
};

const getSinglePropertyById = async (property_id = "") => {
  try {
    if (!property_id) {
      throw new Error("Property ID is required");
    }

    const propertyQuery = `
            SELECT 
                p.*,
                a.building_name,
                a.street,
                a.barangay,
                a.city,
                a.province,
                a.postal_code,
                a.country,
                a.latitude,
                a.longitude
            FROM properties p
            LEFT JOIN addresses a ON p.address_id = a.address_id
            WHERE p.property_id = ? AND p.property_status != 'deleted'
        `;

    const [propertyRows] = await pool.query(propertyQuery, [property_id]);

    if (propertyRows.length === 0) {
      throw new Error("Property not found");
    }

    const picturesQuery = `
            SELECT image_id as id, image_url, image_desc, created_at, updated_at
            FROM properties_pictures
            WHERE property_id = ?
            ORDER BY created_at ASC
        `;

    const [pictureRows] = await pool.query(picturesQuery, [property_id]);

    const property = {
      ...propertyRows[0],
      property_pictures: pictureRows,
      address: propertyRows[0].street
        ? {
            building_name: propertyRows[0].building_name,
            street: propertyRows[0].street,
            barangay: propertyRows[0].barangay,
            city: propertyRows[0].city,
            province: propertyRows[0].province,
            postal_code: propertyRows[0].postal_code,
            country: propertyRows[0].country,
            latitude: propertyRows[0].latitude,
            longitude: propertyRows[0].longitude,
          }
        : null,
    };

    return {
      message: "Property retrieved successfully",
      property: property,
    };
  } catch (error) {
    console.error("Error getting property:", error);
    throw new Error(error.message || "Failed to get property");
  }
};

const editPropertyById = async (property_id = "", propertyData = {}) => {
  try {
    if (!property_id) {
      throw new Error("Property ID is required");
    }

    await getSinglePropertyById(property_id);

    const {
      building_name,
      street,
      barangay,
      city,
      province,
      postal_code,
      country,
      latitude,
      longitude,
      address_id,
      showcase_images = [],
      showcase_descriptions = [],
      existing_image_ids = [],
      existing_descriptions = [],
      deleted_image_ids = [],
      ...otherPropertyData
    } = propertyData;

    let finalAddressId = address_id;

    if (!address_id && (street || city)) {
      const newAddress = {
        building_name: building_name || null,
        street: street || null,
        barangay: barangay || null,
        city: city || null,
        province: province || null,
        postal_code: postal_code || null,
        country: country || "Philippines",
        latitude: latitude || null,
        longitude: longitude || null,
      };

      Object.keys(newAddress).forEach(
        (key) => newAddress[key] === undefined && delete newAddress[key]
      );

      const addressFields = Object.keys(newAddress).join(", ");
      const addressPlaceholders = Object.keys(newAddress)
        .map(() => "?")
        .join(", ");
      const addressValues = Object.values(newAddress);

      const addressQuery = `INSERT INTO addresses (${addressFields}, created_at, updated_at) VALUES (${addressPlaceholders}, NOW(), NOW())`;

      const [addressResult] = await pool.query(addressQuery, addressValues);

      finalAddressId = addressResult.insertId;
    }

    const updateFields = [];
    const values = [];

    const allowedFields = [
      "property_name",
      "floor_area_sqm",
      "description",
      "display_image",
      "property_status",
      "base_rent",
      "advance_months",
      "security_deposit_months",
      "minimum_lease_term_months",
    ];

    allowedFields.forEach((field) => {
      if (otherPropertyData[field] !== undefined) {
        updateFields.push(`${field} = ?`);

        if (
          field === "base_rent" ||
          field === "advance_months" ||
          field === "security_deposit_months" ||
          field === "floor_area_sqm"
        ) {
          values.push(
            otherPropertyData[field]
              ? parseFloat(otherPropertyData[field])
              : null
          );
        } else if (field === "minimum_lease_term_months") {
          values.push(
            otherPropertyData[field] ? parseInt(otherPropertyData[field]) : null
          );
        } else if (field === "display_image") {
          values.push(otherPropertyData[field]);
        } else {
          values.push(otherPropertyData[field]);
        }
      }
    });

    if (finalAddressId !== undefined) {
      updateFields.push("address_id = ?");
      values.push(finalAddressId);
    }

    const hasPropertyUpdates = updateFields.length > 0;
    const hasNewImages =
      Array.isArray(showcase_images) && showcase_images.length > 0;
    const hasImageUpdates =
      Array.isArray(existing_image_ids) && existing_image_ids.length > 0;
    const hasImageDeletions =
      Array.isArray(deleted_image_ids) && deleted_image_ids.length > 0;

    if (
      !hasPropertyUpdates &&
      !hasNewImages &&
      !hasImageUpdates &&
      !hasImageDeletions
    ) {
      throw new Error("No valid fields to update");
    }

    if (hasPropertyUpdates) {
      updateFields.push("updated_at = NOW()");

      const query = `
                UPDATE properties 
                SET ${updateFields.join(", ")} 
                WHERE property_id = ?
            `;

      values.push(property_id);

      const [result] = await pool.query(query, values);

      if (result.affectedRows === 0 && updateFields.length > 1) {
        throw new Error("Property not found or no changes made");
      }
    }

    let newImagesCreated = 0;
    let existingImagesUpdated = 0;
    let deletedImagesCount = 0;

    if (hasImageDeletions) {
      for (const imageId of deleted_image_ids) {
        const validImageId = parseInt(imageId);
        if (isNaN(validImageId) || validImageId <= 0) {
          console.warn(`Skipping invalid image ID for deletion: ${imageId}`);
          continue;
        }

        const deleteImageQuery = `
        DELETE FROM properties_pictures 
        WHERE image_id = ? AND property_id = ?
    `;

        const [deleteResult] = await pool.query(deleteImageQuery, [
          validImageId,
          property_id,
        ]);
        if (deleteResult.affectedRows > 0) {
          deletedImagesCount++;
          console.log(`Successfully deleted image ID: ${validImageId}`);
        } else {
          console.warn(
            `No rows affected when deleting image ID: ${validImageId}`
          );
        }
      }
    }

    if (hasNewImages) {
      for (let i = 0; i < showcase_images.length; i++) {
        const imageUrl = showcase_images[i];
        const description = showcase_descriptions[i] || "";

        const insertImageQuery = `
                    INSERT INTO properties_pictures (property_id, image_url, image_desc, created_at, updated_at)
                    VALUES (?, ?, ?, NOW(), NOW())
                `;

        await pool.query(insertImageQuery, [
          property_id,
          imageUrl,
          description,
        ]);
        newImagesCreated++;
      }
    }

    if (hasImageUpdates) {
      for (let i = 0; i < existing_image_ids.length; i++) {
        const imageId = existing_image_ids[i];
        const description = existing_descriptions[i] || "";

        const validImageId = parseInt(imageId);
        if (isNaN(validImageId) || validImageId <= 0) {
          console.warn(`Skipping invalid image ID: ${imageId}`);
          continue;
        }

        const updateImageQuery = `
        UPDATE properties_pictures 
        SET image_desc = ?, updated_at = NOW()
        WHERE image_id = ? AND property_id = ?
    `;

        const [updateResult] = await pool.query(updateImageQuery, [
          description,
          validImageId,
          property_id,
        ]);
        if (updateResult.affectedRows > 0) {
          existingImagesUpdated++;
          console.log(`Successfully updated image ID ${validImageId}`);
        } else {
          console.warn(
            `No rows affected when updating image ID ${validImageId}`
          );
        }
      }
    }

    const updatedProperty = await getSinglePropertyById(property_id);

    return {
      message: `Property ${property_id} has been successfully updated!`,
      property: updatedProperty.property,
      newAddressCreated: finalAddressId && !address_id ? true : false,
      newAddressId: finalAddressId && !address_id ? finalAddressId : null,
      showcaseImagesAdded: newImagesCreated,
      showcaseImagesUpdated: existingImagesUpdated,
      showcaseImagesDeleted: deletedImagesCount,
    };
  } catch (error) {
    console.error("Error updating property:", error);
    throw new Error(error.message || "Failed to update property");
  }
};

const deletePropertyById = async (property_id = "") => {
  try {
    if (!property_id) {
      throw new Error("Property ID is required");
    }

    const property = await getSinglePropertyById(property_id);

    const [leaseRows] = await pool.query(
      "SELECT lease_id FROM leases WHERE property_id = ? AND (lease_status = 'ACTIVE' OR lease_status = 'PENDING')",
      [property_id]
    );

    if (Array.isArray(leaseRows) && leaseRows.length > 0) {
      throw new Error(
        "Cannot delete property: there are active or pending leases associated with this property. Please terminate, cancel, or archive the related lease(s) before deleting the property."
      );
    }

    if (property.property.property_status !== "Available") {
      throw new Error("Only properties with 'Available' status can be deleted");
    }

    const deletePicturesQuery = `DELETE FROM properties_pictures WHERE property_id = ?`;
    try {
      await pool.query(deletePicturesQuery, [property_id]);
    } catch (e) {
      console.warn(
        `Failed to delete property pictures for ${property_id}:`,
        e.message || e
      );
    }

    const deletePropertyQuery = `DELETE FROM properties WHERE property_id = ?`;
    const [result] = await pool.query(deletePropertyQuery, [property_id]);

    if (result.affectedRows === 0) {
      throw new Error("Property not found or could not be deleted");
    }

    return {
      message: `Property ${property_id} has been successfully deleted!`,
      property: property.property,
      deletedRows: result.affectedRows,
    };
  } catch (error) {
    throw new Error(error.message || "Failed to delete property");
  }
};

export default {
  createProperty,
  getProperties,
  getSinglePropertyById,
  editPropertyById,
  deletePropertyById,
};
