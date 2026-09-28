// Generates a random temporary password for new / reset accounts.
// Upper + lowercase letters and digits, with look-alikes (0/O/o, 1/l/I/i) removed.
// Passwords are case-sensitive, so staff must type these exactly as shown.
const CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";

export function generateTempPassword(length = 8) {
  const values = crypto.getRandomValues(new Uint32Array(length));
  return Array.from(values, (n) => CHARS[n % CHARS.length]).join("");
}
