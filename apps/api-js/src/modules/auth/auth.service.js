import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

import { env } from "../../config/env.js";
import { prisma } from "../../config/prisma.js";
import { AppError } from "../../utils/app-error.js";

const publicUserSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
  createdAt: true,
};

export function signToken(user) {
  return jwt.sign(
    { role: user.role, email: user.email },
    env.JWT_SECRET,
    { subject: user.id, expiresIn: env.JWT_EXPIRES_IN },
  );
}

export async function registerUser(input) {
  const email = input.email.trim().toLowerCase();
  const existing = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (existing) {
    throw new AppError("Este e-mail já está em uso.", "EMAIL_IN_USE", 409);
  }

  const passwordHash = await bcrypt.hash(input.password, 12);
  const user = await prisma.user.create({
    data: { name: input.name.trim(), email, passwordHash },
    select: publicUserSelect,
  });

  return { user, token: signToken(user) };
}

export async function loginUser(input) {
  const email = input.email.trim().toLowerCase();
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !(await bcrypt.compare(input.password, user.passwordHash))) {
    throw new AppError("E-mail ou senha inválidos.", "INVALID_CREDENTIALS", 401);
  }

  const safeUser = Object.fromEntries(
    Object.keys(publicUserSelect).map((key) => [key, user[key]]),
  );
  return { user: safeUser, token: signToken(user) };
}
