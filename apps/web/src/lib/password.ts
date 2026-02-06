import bcrypt from "bcrypt";

const SALT_ROUNDS = 12;

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export async function verifyPassword(
  password: string,
  hashedPassword: string
): Promise<boolean> {
  return bcrypt.compare(password, hashedPassword);
}

// Password strength validation
export function validatePassword(password: string): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (password.length < 8) {
    errors.push("Wachtwoord moet minimaal 8 tekens bevatten");
  }

  if (!/[A-Z]/.test(password)) {
    errors.push("Wachtwoord moet minimaal 1 hoofdletter bevatten");
  }

  if (!/[a-z]/.test(password)) {
    errors.push("Wachtwoord moet minimaal 1 kleine letter bevatten");
  }

  if (!/[0-9]/.test(password)) {
    errors.push("Wachtwoord moet minimaal 1 cijfer bevatten");
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
