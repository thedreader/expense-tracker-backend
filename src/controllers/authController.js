import User from "../models/User.js";
import Category from "../models/Category.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import {
  generateAccessToken,
  generateRefreshToken,
} from "../utils/generateToken.js";

const isProd = process.env.NODE_ENV === "production";

const accessCookieOptions = {
  httpOnly: true,
  secure: isProd,
  sameSite: isProd ? "none" : "lax",
  path: "/",
  maxAge: 7 * 15 * 60 * 1000,
};

const refreshCookieOptions = {
  httpOnly: true,
  secure: isProd,
  sameSite: isProd ? "none" : "lax",
  path: "/",
  maxAge: 15 * 24 * 60 * 60 * 1000,
};

export const register = async (req, res) => {
  const { name, email, password } = req.body;

  try {
    const existingUser = await User.findOne({ email: email });
    if (existingUser) {
      return res.status(400).json({ message: "User already exists" });
    }
    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(password, salt);
    const newUser = new User({ name: name, email: email, password: hash });

    const accessToken = generateAccessToken({ id: newUser._id });
    const refreshToken = generateRefreshToken({ id: newUser._id });

    newUser.refreshToken = refreshToken;
    await newUser.save();

    await Category.insertMany([
      { userId: newUser._id, name: "Food", budgetType: "needs" },
      { userId: newUser._id, name: "Travel", budgetType: "needs" },
      { userId: newUser._id, name: "Bills and Utilities", budgetType: "needs" },
      { userId: newUser._id, name: "Shopping", budgetType: "wants" },
      { userId: newUser._id, name: "Entertainment", budgetType: "wants" },
      { userId: newUser._id, name: "Health", budgetType: "needs" },
      { userId: newUser._id, name: "Education", budgetType: "needs" },
      { userId: newUser._id, name: "Rent", budgetType: "needs" },
      { userId: newUser._id, name: "Misc", budgetType: "wants" },
    ]);

    res.cookie("refreshToken", refreshToken, refreshCookieOptions);
    res.cookie("accessToken", accessToken, accessCookieOptions);

    res.status(201).json({ message: "User registered successfully" });
  } catch (err) {
    console.error("Registration error: ", err);
    res.status(500).json({ message: "Error registering user" });
  }
};

export const login = async (req, res) => {
  const { email, password } = req.body;
  try {
    const userExist = await User.findOne({ email: email });
    if (!userExist) {
      return res
        .status(400)
        .json({ message: "User does not exist! Please Sign Up" });
    }

    const isMatch = await bcrypt.compare(password, userExist.password);
    if (!isMatch) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const accessToken = generateAccessToken({ id: userExist._id });
    const refreshToken = generateRefreshToken({ id: userExist._id });

    userExist.refreshToken = refreshToken;
    await userExist.save();

    res.cookie("refreshToken", refreshToken, refreshCookieOptions);
    res.cookie("accessToken", accessToken, accessCookieOptions);

    res.status(200).json({ message: "Login successful" });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ message: "Error logging in" });
  }
};

export const refresh = async (req, res) => {
  const { refreshToken } = req.cookies;

  if (!refreshToken)
    return res.status(401).json({ message: "No refresh token" });

  try {
    const user = await User.findOne({ refreshToken: refreshToken });
    if (!user) {
      console.log("No user found with this refresh token");
      return res.status(403).json({ message: "Invalid refresh token" });
    }

    jwt.verify(
      refreshToken,
      process.env.REFRESH_TOKEN_SECRET,
      (err, decoded) => {
        if (err) {
          console.log(user._id.toString() + " " + decoded);
          return res.status(403).json({ message: "Invalid refresh token" });
        }

        const accessToken = generateAccessToken({ id: user._id });
        res.cookie("accessToken", accessToken, accessCookieOptions);
        res.status(200).json({ accessToken });
      },
    );
  } catch (err) {
    console.error("Refresh token error:", err);
    res.status(500).json({ message: "Error refreshing token" });
  }
};

export const logout = async (req, res) => {
  try {
    const { refreshToken } = req.cookies;
    res.clearCookie("refreshToken", {
      httpOnly: true,
      secure: isProd,
      sameSite: isProd ? "none" : "lax",
      path: "/",
    });
    res.clearCookie("accessToken", {
      httpOnly: true,
      secure: isProd,
      sameSite: isProd ? "none" : "lax",
      path: "/",
    });

    const user = await User.findOne({ refreshToken: refreshToken });
    if (user) {
      user.refreshToken = null;
      await user.save();
    }

    res.status(200).json({ message: "Logged out successfully" });
  } catch (err) {
    console.error("Logout error:", err);
    res.status(500).json({ message: "Error logging out" });
  }
};
