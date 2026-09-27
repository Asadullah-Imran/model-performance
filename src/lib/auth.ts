import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { connectToDatabase } from '@/lib/mongodb';
import { User, IUser } from '@/models/User';

const JWT_SECRET = process.env.JWT_SECRET || 'spatial-multiomics-dashboard-jwt-secret-key-2026';
const JWT_EXPIRES_IN = '7d';

export interface TokenPayload {
  userId: string;
  username: string;
  role: 'student' | 'faculty' | 'admin';
  name?: string;
}

// Master accounts to seed automatically into MongoDB
export const MASTER_ACCOUNTS = [
  {
    username: 'student',
    passwordPlain: 'fdsa4321',
    role: 'student' as const,
    name: 'Research Student',
  },
  {
    username: 'faculty',
    passwordPlain: 'asdf1234',
    role: 'faculty' as const,
    name: 'Faculty Researcher',
  },
  {
    username: 'admin',
    passwordPlain: 'asdf4321',
    role: 'admin' as const,
    name: 'System Administrator',
  },
];

/**
 * Ensure the 3 master accounts exist in the database with properly hashed passwords.
 */
export async function seedMasterAccountsIfMissing() {
  const db = await connectToDatabase();
  if (!db) return;

  try {
    for (const acc of MASTER_ACCOUNTS) {
      const existing = await User.findOne({ username: acc.username });
      if (!existing) {
        const hashedPassword = await bcrypt.hash(acc.passwordPlain, 10);
        await User.create({
          username: acc.username,
          password: hashedPassword,
          role: acc.role,
          name: acc.name,
        });
        console.log(`✅ Seeded master account in MongoDB: ${acc.username} (${acc.role})`);
      }
    }
  } catch (err) {
    console.error('Error seeding master accounts:', err);
  }
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
 * Validates login credentials against MongoDB (or auto-seeds if fresh DB)
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
  if (db) {
    await seedMasterAccountsIfMissing();
  }

  let dbUser = null;
  if (db) {
    dbUser = await User.findOne({ username: cleanUsername });
  }

  if (dbUser) {
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

  // Fallback for offline local development if MongoDB is unreachable
  const masterAcc = MASTER_ACCOUNTS.find(a => a.username === cleanUsername);
  if (masterAcc && masterAcc.passwordPlain === passwordPlain) {
    const payload: TokenPayload = {
      userId: `local_${masterAcc.username}`,
      username: masterAcc.username,
      role: masterAcc.role,
      name: masterAcc.name,
    };
    const token = signJwtToken(payload);
    return { user: payload, token };
  }

  return { user: null, token: null, error: 'Invalid username or password' };
}
