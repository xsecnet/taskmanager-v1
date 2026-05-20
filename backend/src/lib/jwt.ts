import jwt from "jsonwebtoken";
import { config } from "./config";

export type SessionPayload = {
  uid: string;
  email: string;
  role: string;
};

export function signSession(payload: SessionPayload) {
  return jwt.sign(payload, config.jwtSecret, { expiresIn: "7d" });
}

export function verifySession(token: string): SessionPayload {
  return jwt.verify(token, config.jwtSecret) as SessionPayload;
}
