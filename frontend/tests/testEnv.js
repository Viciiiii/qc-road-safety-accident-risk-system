// Shared settings for the end-to-end tests. Everything comes from environment variables
// so no real password is ever written into the repository.
import pg from "pg";

export const API = (process.env.TEST_API_URL || "http://localhost:8000").replace(/\/+$/, "");
export const APP = (process.env.TEST_APP_URL || "http://localhost:5173").replace(/\/+$/, "");
export const ADMIN_EMAIL = process.env.TEST_ADMIN_EMAIL || "test-admin@example.com";
export const ADMIN_PASSWORD = process.env.TEST_ADMIN_PASSWORD || "TestAdmin1";

// Same database the backend under test is using. Accepts the Python form too
// (postgresql+psycopg2://...).
const DB_URL = (process.env.TEST_DATABASE_URL || "").replace("postgresql+psycopg2://", "postgresql://");

// Empties the incidents table so counts start from zero. Refuses anything that isn't
// clearly a test database, because this deletes data.
export async function resetIncidents() {
  if (!DB_URL) throw new Error("Set TEST_DATABASE_URL to the test database (see frontend/tests/README.md).");
  // database name = the path after the host: ...@localhost:5432/<name>?options
  const name = (DB_URL.split("@").pop().split("/")[1] || "").split("?")[0];
  if (!/test/i.test(name)) throw new Error(`Refusing to reset '${name}': its name doesn't contain 'test'.`);
  const client = new pg.Client({ connectionString: DB_URL });
  await client.connect();
  try {
    await client.query("DELETE FROM incidents");
  } finally {
    await client.end();
  }
}
