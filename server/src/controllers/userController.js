import User from "../models/User.js";
import { ROLES } from "../utils/constants.js";

export const getUsers = async (req, res) => {
  const users = await User.find().select("-password").sort({ createdAt: -1 });
  return res.json(users);
};

export const updateUserRole = async (req, res) => {
  const { id } = req.params;
  const { role } = req.body;

  if (String(id) === String(req.user._id)) {
    return res.status(409).json({ message: "Administrators cannot change their own role" });
  }

  if (!Object.values(ROLES).includes(role)) {
    return res.status(400).json({ message: "Invalid role" });
  }

  const user = await User.findById(id);
  if (!user) {
    return res.status(404).json({ message: "User not found" });
  }
  if (user.role === ROLES.ADMIN && role !== ROLES.ADMIN && await User.countDocuments({ role: ROLES.ADMIN }) <= 1) {
    return res.status(409).json({ message: "The final administrator cannot be demoted" });
  }
  user.role = role;
  await user.save();

  return res.json({ message: "Role updated", user: { id: user._id, role: user.role } });
};
