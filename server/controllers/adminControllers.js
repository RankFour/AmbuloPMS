import expressAsync from "express-async-handler";
import usersServices from "../services/usersServices.js";

const verifyPassword = expressAsync(async (req, res) => {
  try {
    const userId = req.user?.user_id;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const { password } = req.body || {};
    if (!password) return res.status(400).json({ message: "Password is required" });

    const ok = await usersServices.verifyUserPassword(userId, password);
    if (!ok) return res.status(401).json({ message: "Invalid password" });

    return res.status(200).json({ message: "Password verified" });
  } catch (error) {
    console.error("Error in verifyPassword:", error);
    return res.status(400).json({ message: error.message || "Failed to verify password" });
  }
});

export { verifyPassword };
