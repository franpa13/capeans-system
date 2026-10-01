import { config } from "dotenv";

config({ path: ".env" });
process.env.DATABASE_URL = process.env.DATABASE_URL_TEST;
