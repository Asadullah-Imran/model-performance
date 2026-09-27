import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { connectToDatabase } from '@/lib/mongodb';
import { User } from '@/models/User';

const JWT_SECRET = process.env.JWT_SECRET || 'spatial-multiomics-dashboard-jwt-secret-key-2026';
const JWT_EXPIRES_IN = '7d';

export interface TokenPayload {
  userId: string;
  username: string;
  role: 'student' | 'faculty' | 'admin';
  name?: string;
}

/**
 * Signs a JWT token for the user
 */
export function signJwtToken(payload: TokenPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

/**
 * Verifies and decodes a JWT token
 */
export function verifyJwtToken(token: string): TokenPayload | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as TokenPayload;
    return decoded;
  } catch (err) {
    return null;
  }
}

/**
 * Validates login credentials directly against the MongoDB User collection.
 * No passwords are stored in the codebase; everything is verified using bcrypt hashes in the database.
 */
export async function authenticateUser(username: string, passwordPlain: string): Promise<{
  user: TokenPayload | null;
  token: string | null;
  error?: string;
}> {
  const cleanUsername = (username || '').trim().toLowerCase();
  if (!cleanUsername || !passwordPlain) {
    return { user: null, token: null, error: 'Username and password are required' };
  }

  const db = await connectToDatabase();
  if (!db) {
    return { user: null, token: null, error: 'Database connection failed. Please check MONGO_URI.' };
  }

  const dbUser = await User.findOne({ username: cleanUsername });
  if (!dbUser) {
    return { user: null, token: null, error: 'Invalid username or password' };
  }

  const isMatch = await bcrypt.compare(passwordPlain, dbUser.password);
  if (!isMatch) {
    return { user: null, token: null, error: 'Invalid username or password' };
  }

  const payload: TokenPayload = {
    userId: dbUser._id.toString(),
    username: dbUser.username,
    role: dbUser.role,
    name: dbUser.name,
  };

  const token = signJwtToken(payload);
  return { user: payload, token };
}
