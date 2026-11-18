// scripts/reset-persona.ts
//
// Put one test persona (or all of them) back at its starting stage on the emulators:
//   npm run reset-persona -- fresh
//   npm run reset-persona -- all
// See scripts/personas.ts and docs/user-states.md.
import { PASSWORD } from "./emulator";
import { PERSONA_KEYS, PERSONAS, isPersonaKey, resetPersona } from "./personas";

declare const process: { argv: string[]; exit(code?: number): never };

const usage = () => {
  console.log("Usage: npm run reset-persona -- <persona|all>\n");
  for (const key of PERSONA_KEYS) {
    console.log(`  ${key.padEnd(7)} ${PERSONAS[key].email.padEnd(17)} ${PERSONAS[key].stage}`);
  }
  console.log(`\nEvery persona signs in with ${PASSWORD}.`);
};

async function main() {
  const arg = process.argv[2];
  if (!arg || (arg !== "all" && !isPersonaKey(arg))) {
    usage();
    process.exit(arg ? 1 : 0);
  }
  const keys = arg === "all" ? PERSONA_KEYS : [arg];
  for (const key of keys) {
    const p = await resetPersona(key);
    console.log(`✅ ${p.key}: ${p.email} (${p.replaced ? "reset" : "created"}): ${p.stage}`);
  }
  console.log(`\nSign in with ${PASSWORD}. Open the app with ?fresh-device to forget this`);
  console.log("browser's stored tips and preferences too.");
  process.exit(0);
}

main().catch((error: unknown) => {
  console.error("❌", error instanceof Error ? error.message : error);
  process.exit(1);
});
