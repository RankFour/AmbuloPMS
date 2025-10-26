import expressAsync from "express-async-handler";
import usersServices from "../services/usersServices.js";

const authUser = expressAsync(async (req, res) => {
  try {
    if (!req.body) {
      return res.status(400).json({ message: "Request body is missing" });
    }

    const { email, password } = req.body;

    if (!email || !password) {
      return res
        .status(400)
        .json({ message: "Email and password are required" });
    }

    const response = await usersServices.authUser(email, password);

    res.cookie("token", response.token, {
      httpOnly: false,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 24 * 60 * 60 * 1000,
    });

    res.json(response);
  } catch (error) {
    console.error("Error in login controller:", error);
    res.status(401).json({ message: error.message });
  }
});

const createUser = expressAsync(async (req, res) => {
  try {
    const avatar =
      req.files && req.files["avatar"] ? req.files["avatar"][0].path : "";

    const tenant_id_file =
      req.files && req.files["tenant_id_file"]
        ? req.files["tenant_id_file"].map((file) => ({ id_url: file.path }))
        : [];

    const payload = {
      ...req.body,
      avatar,
      tenant_id_file,
    };

    const response = await usersServices.createUser(payload);
    res.json(response);
  } catch (error) {
    console.error("Error creating user:", error);
    throw new Error(error.message || "Failed to create user");
  }
});

const getUsers = expressAsync(async (req, res) => {
  try {
    const response = await usersServices.getUsers(req.query);
    res.json(response);
  } catch (error) {
    console.error("Error getting users:", error);
    throw new Error(error.message || "Failed to get users");
  }
});

const getSingleUserById = expressAsync(async (req, res) => {
  try {
    const response = await usersServices.getSingleUserById(req.params.user_id);
    res.json(response);
  } catch (error) {
    console.error("Error getting user:", error);
    throw new Error(error.message || "Failed to get user");
  }
});

const updateSingleUserById = expressAsync(async (req, res) => {
  try {
    const currentUser = await usersServices.getSingleUserById(
      req.params.user_id
    );

    let keepFiles = [];
    if (req.body.tenant_id_files) {
      keepFiles =
        typeof req.body.tenant_id_files === "string"
          ? JSON.parse(req.body.tenant_id_files)
          : req.body.tenant_id_files;
    }

    let newFiles = [];
    if (req.files && req.files["tenant_id_file"]) {
      newFiles = req.files["tenant_id_file"].map((file) => ({
        id_url: file.path,
      }));
    }

    let mergedFiles = [];
    if (Array.isArray(keepFiles)) {
      const prevFiles = Array.isArray(currentUser.tenant_id_files)
        ? currentUser.tenant_id_files
        : [];
      mergedFiles = keepFiles.filter((f) =>
        prevFiles.some((pf) => pf.id_url === f.id_url)
      );
    }
    mergedFiles = mergedFiles.concat(newFiles);

    const avatar =
      req.files && req.files["avatar"] && req.files["avatar"][0]
        ? req.files["avatar"][0].path
        : req.body.avatar || currentUser.avatar || "";

    const payload = {
      ...req.body,
      avatar,
      tenant_id_files: mergedFiles,
    };

    const response = await usersServices.updateSingleUserById(
      req.params.user_id,
      payload
    );
    res.json(response);
  } catch (error) {
    console.error("Error updating user:", error);
    throw new Error(error.message || "Failed to update user");
  }
});

const deleteUserById = expressAsync(async (req, res) => {
  try {
    const response = await usersServices.deleteUserById(req.params.user_id);
    res.json(response);
  } catch (error) {
    console.error("Error deleting user:", error);
    throw new Error(error.message || "Failed to delete user");
  }
});

const logoutUser = (req, res) => {
  const cookieDomain =
    process.NODE_ENV === "production"
      ? process.env.COOKIE_DOMAIN
      : process.env.COOKIE_DOMAIN_LOCAL;
  res.clearCookie("token", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    domain: cookieDomain,
  });
  res.json({ message: "Logged out successfully" });
};

export {
  authUser,
  createUser,
  getUsers,
  getSingleUserById,
  updateSingleUserById,
  deleteUserById,
  logoutUser,
};
