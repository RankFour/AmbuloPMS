import { v4 as uuidv4 } from "uuid";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import conn from "./../config/db.js";
import mailer from "../utils/mailer.js";
import companyDetailsServices from "./companyDetailsServices.js";
import { buildBrandedEmail } from "../utils/emailTemplates.js";

const pool = await conn();


const generateTempPassword = (length = 12) => {
  const upper = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const lower = "abcdefghijklmnopqrstuvwxyz";
  const digits = "0123456789";
  const specials = "!@#$%^&*()_+-=[]{}|;:',.<>/?";
  const all = upper + lower + digits + specials;

  const pick = (chars) => chars[Math.floor(Math.random() * chars.length)];
  let pwd = [pick(upper), pick(lower), pick(digits), pick(specials)];
  for (let i = pwd.length; i < length; i++) pwd.push(pick(all));
  
  for (let i = pwd.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pwd[i], pwd[j]] = [pwd[j], pwd[i]];
  }
  return pwd.join("");
};

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
      require_password_change: !!user.must_change_password,
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

  // Validate required email and ensure no duplicate email exists (case-insensitive)
  if (!email || !String(email).trim()) {
    throw new Error("Email is required to create a user.");
  }
  const [dup] = await pool.query(
    "SELECT user_id FROM users WHERE LOWER(email) = LOWER(?) LIMIT 1",
    [email]
  );
  if (dup && dup.length > 0) {
    throw new Error("Email already in use");
  }

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

    const forceFirstLoginReset = process.env.FORCE_FIRST_LOGIN_RESET === 'true';
    let password_setup_token = null;
    let password_setup_expires = null;
    if (forceFirstLoginReset) {
      password_setup_token = uuidv4();
      const expires = new Date();
      expires.setHours(expires.getHours() + 24);
      password_setup_expires = expires.toISOString().slice(0, 19).replace('T', ' ');
    }
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
      must_change_password: forceFirstLoginReset ? 1 : 0,
      password_setup_token,
      password_setup_expires,
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

    const sendCredentialsEmail = process.env.SEND_CREDENTIALS_EMAIL !== 'false';
    const forceReset = forceFirstLoginReset;
    
    
    const includePlaintextPassword = true;

    try {
      if (sendCredentialsEmail && email) {
        
        let company = null;
        try {
          const rows = await companyDetailsServices.getCompanyDetails();
          company = Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
        } catch (_) { /* non-fatal */ }

        const escapeHtml = (str = "") => String(str)
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;")
          .replace(/"/g, "&quot;")
          .replace(/'/g, "&#39;");

        const baseDomain = (() => {
          const candidate = (company && (company.email || company.support_email)) || "";
          const domainPart = candidate.includes("@") ? candidate.split("@")[1] : null;
          return domainPart || "ambulo.local";
        })();
        const noReply = process.env.NO_REPLY_EMAIL || `no-reply@${baseDomain}`;
        const loginBase = process.env.NODE_ENV === 'production' ? (process.env.API_BASE || "").replace(/\/+$/, "") : (process.env.API_BASE_LOCAL || "").replace(/\/+$/, "");
        const loginUrl = loginBase ? `${loginBase}/login` : "/login";
        const setPwdUrl = (() => {
          const base = loginBase ? `${loginBase}/set-password` : `/set-password`;
          const emailQS = `email=${encodeURIComponent(email || '')}`;
          const tokenQS = password_setup_token ? `&token=${encodeURIComponent(password_setup_token)}` : '';
          return `${base}?${emailQS}${tokenQS}`;
        })();
        const companyName = company?.company_name || "AmbuloPMS";

        const pwdLineHtml = includePlaintextPassword
          ? `<p style=\"margin:0 0 12px\"><strong>Temporary Password:</strong> ${escapeHtml(password || '')}</p>`
          : `<p style=\"margin:0 0 12px\"><strong>Password Setup Required:</strong> You'll be prompted to change/set your password on first login.</p>`;
        const pwdLineText = includePlaintextPassword
          ? `Temporary Password: ${password}`
          : `Password Setup Required: You'll be prompted to change/set your password on first login.`;

        const securityLineHtml = forceReset
          ? `<p style=\"margin:0 0 12px\">For security, you'll need to set a new password immediately after logging in.</p>`
          : `<p style=\"margin:0 0 12px\">For security, please change your password after logging in.</p>`;
        const securityLineText = forceReset
          ? `For security, you'll need to set a new password immediately after logging in.`
          : `For security, please change your password after logging in.`;

        const bodyHtml = `
          <p style="margin:0 0 12px">Hi ${escapeHtml(first_name || '')},</p>
          <p style="margin:0 0 12px">Welcome to ${escapeHtml(companyName)}! Your tenant account has been created.</p>
          <p style="margin:0 0 12px"><strong>Login Email:</strong> ${escapeHtml(email)}</p>
          ${pwdLineHtml}
          <p style="margin:0 0 12px">Set your password here: <a href="${setPwdUrl}" target="_blank" style="color:#2563eb;text-decoration:none">${setPwdUrl}</a></p>
          ${password_setup_token ? `<p style=\"margin:0 0 12px\"><em>This setup link expires in 24 hours.</em></p>` : ''}
          <p style="margin:0 0 12px">Or login here: <a href="${loginUrl}" target="_blank" style="color:#2563eb;text-decoration:none">${loginUrl}</a></p>
          ${securityLineHtml}
          <p style="margin:0 0 12px" data-no-reply>This is an automated notification from the ${escapeHtml(companyName)} system. Replies to this address are not monitored.</p>
          <p style="margin:0 0 12px">Best regards,<br/>${escapeHtml(companyName)} Team</p>
        `;
        const bodyText = [
          `Hi ${first_name || ''},`,
          `Welcome to ${companyName}! Your tenant account has been created.`,
          `Login Email: ${email}`,
          pwdLineText,
          `Set Password URL${password_setup_token ? ' (expires in 24h)' : ''}: ${setPwdUrl}`,
          `Alternate Login URL: ${loginUrl}`,
          securityLineText,
          `This is an automated notification. Replies are not monitored.`,
          `Best regards,`,
          `${companyName} Team`,
        ].join('\n\n');

        const { html: wrappedHtml, text: wrappedText, attachments } = buildBrandedEmail(
          { bodyHtml, bodyText },
          company || {}
        );

        await mailer.sendMail({
          to: email,
          subject: `Your ${companyName} Account Credentials`,
          html: wrappedHtml,
          text: wrappedText,
          replyTo: noReply,
          from: noReply,
          headers: {
            'Auto-Submitted': 'auto-generated',
            'X-Auto-Response-Suppress': 'All',
          },
          attachments,
        });
        try { console.info('[Users] Credentials email sent', { to: email }); } catch (_) {}
      }
    } catch (e) {
      console.error('[Users] Failed to send credentials email', e);
      
    }

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
      'SELECT user_id, first_name, last_name, avatar, email, phone_number, role, created_at, status, must_change_password, password_setup_expires FROM users WHERE role = ?';
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

    // If email is being changed, enforce uniqueness (case-insensitive)
    if (updatedUser.email && updatedUser.email !== user.email) {
      const [dup] = await conn.query(
        "SELECT user_id FROM users WHERE LOWER(email) = LOWER(?) AND user_id <> ? LIMIT 1",
        [updatedUser.email, user_id]
      );
      if (dup && dup.length > 0) {
        throw new Error("Email already in use");
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


const verifyUserPassword = async (user_id = "", password = "") => {
  try {
    if (!user_id) throw new Error("User ID is required");
    if (!password) throw new Error("Password is required");

    const [rows] = await pool.query(
      `SELECT password_hash FROM users WHERE user_id = ?`,
      [user_id]
    );
    if (!rows || rows.length === 0) throw new Error("User not found");
    const user = rows[0];
    const isMatch = await bcrypt.compare(password, user.password_hash);
    return isMatch;
  } catch (error) {
    console.error("Error verifying user password:", error);
    throw new Error(error.message || "Failed to verify password");
  }
};


const setInitialPassword = async ({ email, token, current_password, new_password }) => {
  if (!email) throw new Error('Email is required');
  if (!new_password) throw new Error('New password is required');

  const [rows] = await pool.query(`SELECT * FROM users WHERE email = ?`, [email]);
  if (!rows || rows.length === 0) throw new Error('User not found');
  const user = rows[0];
  if (!user.must_change_password) throw new Error('Password setup not required');

  
  let validated = false;
  if (token) {
    if (!user.password_setup_token || token !== user.password_setup_token) {
      throw new Error('Invalid setup token');
    }
    if (user.password_setup_expires && new Date(user.password_setup_expires) < new Date()) {
      throw new Error('Setup token expired');
    }
    validated = true;
  }
  if (!validated && current_password) {
    const match = await bcrypt.compare(current_password, user.password_hash);
    if (!match) throw new Error('Invalid current password');
    validated = true;
  }
  if (!validated) throw new Error('Missing validation (token or current_password)');

  const salt = await bcrypt.genSalt(10);
  const newHash = await bcrypt.hash(new_password, salt);
  await pool.query(
    `UPDATE users SET password_hash = ?, must_change_password = 0, password_setup_token = NULL, password_setup_expires = NULL, updated_at = NOW() WHERE user_id = ?`,
    [newHash, user.user_id]
  );

  
  const tokenJwt = jwt.sign({
    user_id: user.user_id,
    email: user.email,
    role: user.role,
    first_name: user.first_name,
    last_name: user.last_name,
  }, process.env.JWT_SECRET, { expiresIn: '1d' });

  const { password_hash, password_setup_token, password_setup_expires, ...cleanUser } = { ...user, must_change_password: 0 };
  return {
    message: 'Password set successfully',
    token: tokenJwt,
    user: cleanUser,
  };
};


const resendSetupEmail = async (user_id = "") => {
  if (!user_id) throw new Error("User ID is required");

  
  const [rows] = await pool.query(`SELECT * FROM users WHERE user_id = ?`, [user_id]);
  if (!rows || rows.length === 0) throw new Error('User not found');
  const user = rows[0];

  
  const newToken = uuidv4();
  const expires = new Date();
  expires.setHours(expires.getHours() + 24);
  const expiresSql = expires.toISOString().slice(0, 19).replace('T', ' ');

  
  const tempPassword = generateTempPassword(12);
  const salt = await bcrypt.genSalt(10);
  const newHash = await bcrypt.hash(tempPassword, salt);

  
  await pool.query(
    `UPDATE users SET password_hash = ?, must_change_password = 1, password_setup_token = ?, password_setup_expires = ?, updated_at = NOW() WHERE user_id = ?`,
    [newHash, newToken, expiresSql, user_id]
  );

  
  let company = null;
  try {
    const rows = await companyDetailsServices.getCompanyDetails();
    company = Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
  } catch (_) { /* non-fatal */ }

  const escapeHtml = (str = "") => String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

  const baseDomain = (() => {
    const candidate = (company && (company.email || company.support_email)) || "";
    const domainPart = candidate.includes("@") ? candidate.split("@")[1] : null;
    return domainPart || "ambulo.local";
  })();
  const noReply = process.env.NO_REPLY_EMAIL || `no-reply@${baseDomain}`;

  const loginBase = (process.env.API_BASE_LOCAL || "").replace(/\/+$/, "");
  const loginUrl = loginBase ? `${loginBase}/login` : "/login";
  const setPwdUrl = (() => {
    const base = loginBase ? `${loginBase}/set-password` : `/set-password`;
    const emailQS = `email=${encodeURIComponent(user.email || '')}`;
    const tokenQS = `&token=${encodeURIComponent(newToken)}`;
    return `${base}?${emailQS}${tokenQS}`;
  })();
  const companyName = company?.company_name || "AmbuloPMS";

  const bodyHtml = `
    <p style="margin:0 0 12px">Hi ${escapeHtml(user.first_name || '')},</p>
    <p style="margin:0 0 12px">We're resending your ${escapeHtml(companyName)} account setup details.</p>
    <p style="margin:0 0 12px"><strong>Login Email:</strong> ${escapeHtml(user.email)}</p>
    <p style=\"margin:0 0 12px\"><strong>Temporary Password:</strong> ${escapeHtml(tempPassword)}</p>
    <p style="margin:0 0 12px">Set your password here: <a href="${setPwdUrl}" target="_blank" style="color:#2563eb;text-decoration:none">${setPwdUrl}</a></p>
    <p style=\"margin:0 0 12px\"><em>This setup link expires in 24 hours.</em></p>
    <p style="margin:0 0 12px">Or login here: <a href="${loginUrl}" target="_blank" style="color:#2563eb;text-decoration:none">${loginUrl}</a></p>
    <p style="margin:0 0 12px">For security, you'll need to set a new password immediately after logging in.</p>
    <p style="margin:0 0 12px" data-no-reply>This is an automated notification from the ${escapeHtml(companyName)} system. Replies to this address are not monitored.</p>
    <p style="margin:0 0 12px">Best regards,<br/>${escapeHtml(companyName)} Team</p>
  `;
  const bodyText = [
    `Hi ${user.first_name || ''},`,
    `We're resending your ${companyName} account setup details.`,
    `Login Email: ${user.email}`,
    `Temporary Password: ${tempPassword}`,
    `Set Password URL (expires in 24h): ${setPwdUrl}`,
    `Alternate Login URL: ${loginUrl}`,
    `For security, you'll need to set a new password immediately after logging in.`,
    `This is an automated notification. Replies are not monitored.`,
    `Best regards,`,
    `${companyName} Team`,
  ].join('\n\n');

  const { html: wrappedHtml, text: wrappedText, attachments } = buildBrandedEmail(
    { bodyHtml, bodyText },
    company || {}
  );

  await mailer.sendMail({
    to: user.email,
    subject: `Your ${companyName} Account Setup` ,
    html: wrappedHtml,
    text: wrappedText,
    replyTo: noReply,
    from: noReply,
    headers: {
      'Auto-Submitted': 'auto-generated',
      'X-Auto-Response-Suppress': 'All',
    },
    attachments,
  });

  return { message: 'Setup email resent', password_setup_expires: expiresSql };
};

export default {
  authUser,
  createUser,
  getUsers,
  getSingleUserById,
  updateSingleUserById,
  deleteUserById,
  verifyUserPassword,
  setInitialPassword,
  resendSetupEmail,
};
