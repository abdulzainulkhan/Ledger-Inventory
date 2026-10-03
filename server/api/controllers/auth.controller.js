const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const pool = require("../db/connection");

/* =========================
   REGISTER USER
========================= */
exports.register = async (req, res) => {
  const { fullName, email, phone, password } = req.body;

  if (!fullName || !email || !phone || !password) {
    return res.status(400).json({ message: "All fields are required" });
  }

  try {
    const [existing] = await pool.query(
      `SELECT id FROM users WHERE email = ? OR phone = ?`,
      [email, phone],
    );

    if (existing.length > 0) {
      return res.status(409).json({ message: "User already exists" });
    }

    // Generate username: name + random number
    const baseUsername = fullName.toLowerCase().replace(/\s+/g, "");
    let username;
    let exists = true;

    while (exists) {
      username = `${baseUsername}${Math.floor(1000 + Math.random() * 9000)}`;
      const [u] = await pool.query(`SELECT id FROM users WHERE username = ?`, [
        username,
      ]);
      exists = u.length > 0;
    }

    const passwordHash = await bcrypt.hash(password, 10);

    await pool.query(
      `INSERT INTO users (full_name, username, email, phone, password_hash)
       VALUES (?, ?, ?, ?, ?)`,
      [fullName, username, email, phone, passwordHash],
    );

    return res.status(201).json({
      message: "User registered successfully",
      username,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Server error" });
  }
};

/* =========================
   LOGIN USER
========================= */
exports.login = async (req, res) => {
  const { identifier, password } = req.body;

  if (!identifier) {
    return res.status(400).json({ message: "Credentials required" });
  }

  try {
    const [rows] = await pool.query(
      `SELECT * FROM users
       WHERE (email = ? OR phone = ? OR username = ?)
       AND is_deleted = 0`,
      [identifier, identifier, identifier],
    );

    if (rows.length === 0) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const user = rows[0];

    if (!user.password_hash) {
      const resetToken = jwt.sign(
        {
          id: user.id,
          purpose: "password-reset",
        },
        process.env.JWT_SECRET,
        { expiresIn: "10m" },
      );

      return res.json({
        resetRequired: true,
        resetToken,
      });
    }

    const match = await bcrypt.compare(password, user.password_hash);

    if (!match) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const token = jwt.sign(
      {
        id: user.id,
        username: user.username,
        email: user.email,
      },
      process.env.JWT_SECRET,
      { expiresIn: "7d" },
    );

    return res.json({
      token,
      user: {
        id: user.id,
        fullName: user.full_name,
        username: user.username,
        email: user.email,
      },
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Server error" });
  }
};

exports.resetPassword = async (req, res) => {
  const { resetToken, newPassword } = req.body;

  if (!resetToken || !newPassword) {
    return res.status(400).json({
      message: "Reset token and new password are required",
    });
  }

  try {
    const decoded = jwt.verify(resetToken, process.env.JWT_SECRET);

    if (decoded.purpose !== "password-reset") {
      return res.status(401).json({
        message: "Invalid reset token",
      });
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);

    const [result] = await pool.query(
      `UPDATE users
       SET password_hash = ?
       WHERE id = ? AND is_deleted = 0`,
      [passwordHash, decoded.id],
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    const [rows] = await pool.query(
      `SELECT * FROM users WHERE id = ? AND is_deleted = 0`,
      [decoded.id],
    );

    const user = rows[0];

    const token = jwt.sign(
      {
        id: user.id,
        username: user.username,
        email: user.email,
      },
      process.env.JWT_SECRET,
      { expiresIn: "7d" },
    );

    return res.json({
      token,
      user: {
        id: user.id,
        fullName: user.full_name,
        username: user.username,
        email: user.email,
      },
    });
  } catch (err) {
    if (err.name === "TokenExpiredError" || err.name === "JsonWebTokenError") {
      return res.status(401).json({
        message: "Invalid or expired reset token",
      });
    }

    console.error(err);
    return res.status(500).json({
      message: "Server error",
    });
  }
};
