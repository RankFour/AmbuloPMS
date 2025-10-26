import { v4 as uuidv4 } from "uuid";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import conn from "./../config/db.js";

const pool = await conn();

const authUser = async (email, password) => {
  try {
    if (!email || !password) {
      throw new Error("Email and password are required");
    }

    const query = `SELECT * FROM users WHERE email = ?`;
    const [users] = await pool.query(query, [email]);

    if (users.length === 0) {
      throw new Error("Invalid email or password");
    }

    const user = users[0];
    const isPasswordValid = await bcrypt.compare(password, user.password_hash);

    if (!isPasswordValid) {
      throw new Error("Invalid email or password");
    }

    const token = jwt.sign(
      {
        user_id: user.user_id,
        email: user.email,
        role: user.role,
        first_name: user.first_name,
        last_name: user.last_name,
      },
      process.env.JWT_SECRET,
      { expiresIn: "1d" }
    );

    const { password_hash, ...userWithoutPassword } = user;

    return {
      message: "Login successful",
      token,
      user: userWithoutPassword,
    };
  } catch (error) {
    console.error("Error logging in user:", error);
    throw new Error(error.message || "Failed to login");
  }
};

const createUser = async (userData = {}) => {
  let {
    first_name,
    last_name,
    middle_name,
    suffix,
    birthdate,
    gender,
    avatar,
    email,
    phone_number,
    alt_phone_number,
    password,
    role,
    status,
    address,
    emergency_contacts,
    tenant_id_file,
  } = userData || {};

  if (typeof address === "string") {
    try {
      address = JSON.parse(address);
    } catch (e) {
      address = null;
    }
  }

  if (typeof emergency_contacts === "string") {
    try {
      emergency_contacts = JSON.parse(emergency_contacts);
    } catch (e) {
      emergency_contacts = [];
    }
  }

  if (userData.birthdate instanceof Date) {
    userData.birthdate = userData.birthdate.toISOString().split("T")[0];
  } else if (
    typeof userData.birthdate === "string" &&
    userData.birthdate.includes("T")
  ) {
    userData.birthdate = userData.birthdate.split("T")[0];
  }

  const user_id = uuidv4();

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    let user_address_id = null;
    if (address) {
      const addressQuery = `
        INSERT INTO user_addresses (house_no, street_address, city, province, zip_code, country, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())
      `;
      const [addressResult] = await conn.query(addressQuery, [
        address.house_no,
        address.street_address,
        address.city,
        address.province,
        address.zip_code,
        address.country,
      ]);
      user_address_id = addressResult.insertId;
    }

    if (!password) throw new Error("Password is required to create a user.");
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const newUser = {
      user_id,
      first_name,
      middle_name,
      last_name,
      suffix,
      birthdate,
      gender,
      avatar,
      email,
      phone_number,
      alt_phone_number,
      user_address_id,
      password_hash: hashedPassword,
      role,
      status,
    };

    Object.keys(newUser).forEach(
      (key) => newUser[key] === undefined && delete newUser[key]
    );

    const fields = Object.keys(newUser).join(", ");
    const placeholders = Object.keys(newUser)
      .map(() => "?")
      .join(", ");
    const values = Object.values(newUser);

    const userQuery = `INSERT INTO users (${fields}) VALUES (${placeholders})`;
    await conn.query(userQuery, values);

    if (Array.isArray(emergency_contacts)) {
      for (const contact of emergency_contacts) {
        await conn.query(
          `INSERT INTO tenant_emergency_contacts (user_id, contact_name, contact_phone, contact_relationship, created_at, updated_at)
       VALUES (?, ?, ?, ?, NOW(), NOW())`,
          [
            user_id,
            contact.contact_name,
            contact.contact_phone,
            contact.contact_relationship,
          ]
        );
      }
    }

    if (tenant_id_file) {
      const files = Array.isArray(tenant_id_file)
        ? tenant_id_file
        : [tenant_id_file];
      for (const file of files) {
        if (file && file.id_url) {
          await conn.query(
            `INSERT INTO tenant_ids (user_id, id_url, created_at)
         VALUES (?, ?, NOW())`,
            [user_id, file.id_url]
          );
        }
      }
    }

    await conn.commit();

    let addressResult = null;
    if (user_address_id) {
      const [addressRows] = await conn.query(
        "SELECT * FROM user_addresses WHERE user_address_id = ?",
        [user_address_id]
      );
      addressResult = addressRows[0] || null;
    }

    let tenantIdFiles = [];
    const [tenantIdRows] = await conn.query(
      "SELECT * FROM tenant_ids WHERE user_id = ?",
      [user_id]
    );
    tenantIdFiles = tenantIdRows;

    let emergencyContacts = [];
    const [emergencyRows] = await conn.query(
      "SELECT * FROM tenant_emergency_contacts WHERE user_id = ?",
      [user_id]
    );
    emergencyContacts = emergencyRows;

    conn.release();

    return {
      message: "User created successfully",
      userData: newUser,
      address: addressResult,
      tenant_id_files: tenantIdFiles,
      emergency_contacts: emergencyContacts,
    };
  } catch (error) {
    await conn.rollback();
    conn.release();
    console.error("Error creating user:", error);
    throw new Error(error.message || "Failed to create user");
  }
};

const getUsers = async (queryObj = {}) => {
  try {
    const {
      page = 1,
      limit = 10,
      search,
      status,
      sort,
      ...otherFilters
    } = queryObj;
    const skip = (page - 1) * limit;

    let query =
      'SELECT user_id, first_name, last_name, avatar, email, phone_number, role, created_at, status FROM users WHERE role = ?';
    const params = ["TENANT"];

    if (search && search.trim() !== "") {
      query += ` AND (
        first_name LIKE ? OR 
        last_name LIKE ? OR 
        email LIKE ? OR 
        phone_number LIKE ?
      )`;
      const searchTerm = `%${search.trim()}%`;
      params.push(searchTerm, searchTerm, searchTerm, searchTerm);
    }

    if (status && status.trim() !== "") {
      query += " AND status = ?";
      params.push(status);
    }

    const otherFilterConditions = Object.entries(otherFilters)
      .filter(([_, value]) => value !== undefined && value !== "")
      .map(([key, value]) => {
        params.push(value);
        return `${key} = ?`;
      });

    if (otherFilterConditions.length > 0) {
      query += " AND " + otherFilterConditions.join(" AND ");
    }

    let orderBy = "created_at DESC"; 
    switch (sort) {
      case "name_asc":
        orderBy = "first_name ASC, last_name ASC";
        break;
      case "name_desc":
        orderBy = "first_name DESC, last_name DESC";
        break;
      // case "lease_end_asc":
      //   orderBy = "lease_end_date ASC";
      //   break;
      // case "lease_end_desc":
      //   orderBy = "lease_end_date DESC";
      //   break;
      // case "balance_asc":
      //   orderBy = "balance ASC";
      //   break;
      // case "balance_desc":
      //   orderBy = "balance DESC";
      //   break;
      case "date_added_asc":
        orderBy = "created_at ASC";
        break;
      case "date_added_desc":
        orderBy = "created_at DESC";
        break;
      default:
        break;
    }
    query += ` ORDER BY ${orderBy}`;
    query += " LIMIT ? OFFSET ?";
    params.push(parseInt(limit), parseInt(skip));

    let countQuery = 'SELECT COUNT(*) as total FROM users WHERE role = ?';
    const countParams = ["TENANT"];

    if (search && search.trim() !== "") {
      countQuery += ` AND (
        first_name LIKE ? OR 
        last_name LIKE ? OR 
        email LIKE ? OR 
        phone_number LIKE ?
      )`;
      const searchTerm = `%${search.trim()}%`;
      countParams.push(searchTerm, searchTerm, searchTerm, searchTerm);
    }

    if (status && status.trim() !== "") {
      countQuery += " AND status = ?";
      countParams.push(status);
    }

    Object.entries(otherFilters)
      .filter(([_, value]) => value !== undefined && value !== "")
      .forEach(([key, value]) => {
        countQuery += ` AND ${key} = ?`;
        countParams.push(value);
      });

    const [rows] = await pool.query(query, params);
    const [countResult] = await pool.query(countQuery, countParams);
    const total = countResult[0].total;

    return {
      users: rows,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / limit),
        totalUsers: total,
        hasNextPage: page * limit < total,
        hasPrevPage: page > 1,
      },
    };
  } catch (error) {
    console.error("Error getting users:", error);
    throw new Error(error.message || "Failed to get users");
  }
};

const getSingleUserById = async (user_id = "") => {
  try {
    const [userRows] = await pool.query(
      `SELECT * FROM users WHERE user_id = ?`,
      [user_id]
    );
    if (userRows.length === 0) {
      throw new Error("[User] not found!.");
    }
    const user = userRows[0];

    if (user.birthdate instanceof Date) {
      user.birthdate = user.birthdate.toISOString().split("T")[0];
    }

    let address = null;
    if (user.user_address_id) {
      const [addressRows] = await pool.query(
        `SELECT * FROM user_addresses WHERE user_address_id = ?`,
        [user.user_address_id]
      );
      address = addressRows[0] || null;
    }

    const [emergencyRows] = await pool.query(
      `SELECT contact_name, contact_phone, contact_relationship FROM tenant_emergency_contacts WHERE user_id = ?`,
      [user_id]
    );
    const emergency_contacts = emergencyRows;

    const [tenantIdRows] = await pool.query(
      `SELECT id_url FROM tenant_ids WHERE user_id = ?`,
      [user_id]
    );
    const tenant_id_files = tenantIdRows;

    return {
      ...user,
      address,
      emergency_contacts,
      tenant_id_files,
    };
  } catch (error) {
    console.error("Error getting user:", error);
    throw new Error(error.message || "Failed to get user");
  }
};

const updateSingleUserById = async (user_id = "", userData = {}) => {
  if (!user_id) throw new Error("User ID is required");

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const user = await getSingleUserById(user_id);

    const allowedFields = [
      "first_name",
      "middle_name",
      "last_name",
      "suffix",
      "birthdate",
      "gender",
      "avatar",
      "email",
      "phone_number",
      "alt_phone_number",
      "status",
    ];

    if (userData.birthdate instanceof Date) {
      userData.birthdate = userData.birthdate.toISOString().split("T")[0];
    } else if (
      typeof userData.birthdate === "string" &&
      userData.birthdate.includes("T")
    ) {
      userData.birthdate = userData.birthdate.split("T")[0];
    }

    const updatedUser = {};
    for (const key of allowedFields) {
      if (userData[key] !== undefined && userData[key] !== null) {
        updatedUser[key] = userData[key];
      }
    }

    if (Object.keys(updatedUser).length > 0) {
      const fields = Object.keys(updatedUser)
        .map((key) => `\`${key}\` = ?`)
        .join(", ");
      const values = Object.values(updatedUser);
      await conn.query(`UPDATE users SET ${fields} WHERE user_id = ?`, [
        ...values,
        user_id,
      ]);
    }

    if (userData.address && user.user_address_id) {
      let address = userData.address;
      if (typeof address === "string") {
        try {
          address = JSON.parse(address);
        } catch {
          address = {};
        }
      }
      const addressFields = [
        "house_no",
        "street_address",
        "city",
        "province",
        "zip_code",
        "country",
      ];
      const addressUpdate = {};
      for (const key of addressFields) {
        if (address[key] !== undefined && address[key] !== null) {
          addressUpdate[key] = address[key];
        }
      }
      if (Object.keys(addressUpdate).length > 0) {
        const fields = Object.keys(addressUpdate)
          .map((key) => `\`${key}\` = ?`)
          .join(", ");
        const values = Object.values(addressUpdate);
        await conn.query(
          `UPDATE user_addresses SET ${fields}, updated_at = NOW() WHERE user_address_id = ?`,
          [...values, user.user_address_id]
        );
      }
    }

    if (userData.emergency_contacts) {
      let contacts = userData.emergency_contacts;
      if (typeof contacts === "string") {
        try {
          contacts = JSON.parse(contacts);
        } catch {
          contacts = [];
        }
      }
      await conn.query(
        "DELETE FROM tenant_emergency_contacts WHERE user_id = ?",
        [user_id]
      );
      for (const contact of contacts) {
        if (
          contact.contact_name ||
          contact.contact_phone ||
          contact.contact_relationship
        ) {
          await conn.query(
            `INSERT INTO tenant_emergency_contacts (user_id, contact_name, contact_phone, contact_relationship, created_at, updated_at)
             VALUES (?, ?, ?, ?, NOW(), NOW())`,
            [
              user_id,
              contact.contact_name || "",
              contact.contact_phone || "",
              contact.contact_relationship || "",
            ]
          );
        }
      }
    }

    if (userData.tenant_id_files) {
      let newFiles = userData.tenant_id_files;
      if (typeof newFiles === "string") {
        try {
          newFiles = JSON.parse(newFiles);
        } catch {
          newFiles = [];
        }
      }
      const [currentRows] = await conn.query(
        "SELECT id_url FROM tenant_ids WHERE user_id = ?",
        [user_id]
      );
      const currentUrls = currentRows.map((f) => f.id_url);

      const newUrls = newFiles.map((f) => f.id_url);

      const toDelete = currentUrls.filter((url) => !newUrls.includes(url));
      const toAdd = newFiles.filter((f) => !currentUrls.includes(f.id_url));

      if (toDelete.length > 0) {
        await conn.query(
          `DELETE FROM tenant_ids WHERE user_id = ? AND id_url IN (${toDelete
            .map(() => "?")
            .join(",")})`,
          [user_id, ...toDelete]
        );
      }
      for (const file of toAdd) {
        if (file && file.id_url) {
          await conn.query(
            `INSERT INTO tenant_ids (user_id, id_url, created_at)
             VALUES (?, ?, NOW())`,
            [user_id, file.id_url]
          );
        }
      }
    }

    await conn.commit();
    conn.release();

    return {
      user: {
        user_id: user.user_id,
        first_name: user.first_name,
        last_name: user.last_name,
        email: user.email,
        phone_number: user.phone_number,
        status: user.status,
        role: user.role,
        address: user.address,
        emergency_contacts: user.emergency_contacts,
        tenant_id_files: user.tenant_id_files,
      },
      message: "User updated successfully",
    };
  } catch (error) {
    await conn.rollback();
    conn.release();
    console.error("Error updating user:", error);
    throw new Error(error.message || "Failed to update user");
  }
};

const deleteUserById = async (user_id = "") => {
  try {
    const user = await getSingleUserById(user_id);

    const query = `DELETE FROM users WHERE user_id = ?`;
    const [result] = await pool.query(query, [user_id]);

    if (result.affectedRows === 0) {
      throw new Error("User could not be deleted");
    }

    return {
      message: `User with an id of ${user_id} has been successfully deleted.`,
      deletedUser: {
        user_id: user.user_id,
        first_name: user.first_name,
        last_name: user.last_name,
        email: user.email,
      },
    };
  } catch (error) {
    console.error("Error deleting user:", error);
    throw new Error(error.message || "Failed to delete user");
  }
};

export default {
  authUser,
  createUser,
  getUsers,
  getSingleUserById,
  updateSingleUserById,
  deleteUserById,
};
