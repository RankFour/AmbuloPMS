import express from "express";
import { protect } from "../middlewares/authMiddleware.js";
import {
  authUser,
  createUser,
  getUsers,
  getSingleUserById,
  updateSingleUserById,
  deleteUserById,
  logoutUser,
  setInitialPassword,
  resendSetupEmail,
} from "../controllers/usersControllers.js";

import createUploadMiddleware from "../middlewares/multer/uploadMiddleware.js";
const router = express.Router();

router.post("/login", authUser);
router.post("/set-initial-password", setInitialPassword);

router.post(
  "/create-user",
  createUploadMiddleware({
    fields: [
      { name: "avatar", maxCount: 1 },
      { name: "tenant_id_file", maxCount: 4 },
    ],
    fieldFolders: {
      avatar: "user_avatars",
      tenant_id_file: "tenant_id_files",
    },
  }),
  protect,
  createUser
);

router.get("/", protect, getUsers);
router.get("/:user_id", protect, getSingleUserById);

router.post("/:user_id/resend-setup-email", protect, resendSetupEmail);

router.patch(
  "/:user_id",
  createUploadMiddleware({
    fields: [
      { name: "avatar", maxCount: 1 },
      { name: "tenant_id_file", maxCount: 4 },
    ],
    fieldFolders: {
      avatar: "user_avatars",
      tenant_id_file: "tenant_id_files",
    },
  }),
  protect,
  updateSingleUserById
);

router.delete("/:user_id", protect, deleteUserById);
router.post("/logout", logoutUser);

export default router;
