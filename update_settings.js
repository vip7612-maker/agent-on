import { createClient } from "@libsql/client";
import dotenv from "dotenv";

dotenv.config();

const db = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN
});

async function update() {
  try {
    await db.execute({
      sql: "REPLACE INTO settings (key, value) VALUES ('ANTIGRAVITY_WEBHOOK_URL', 'https://defensive-females-given-send.trycloudflare.com/webhook')"
    });
    console.log("Antigravity url saved");
    
    await db.execute({
      sql: "REPLACE INTO settings (key, value) VALUES ('AION_WEBHOOK_URL', 'https://agent-on.vercel.app/api/webhook/inbound')"
    });
    console.log("AiON url saved");
    
    process.exit(0);
  } catch(e) {
    console.error(e);
    process.exit(1);
  }
}
update();
