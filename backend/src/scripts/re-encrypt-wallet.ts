/**
 * Fix wallets encrypted with an old/different key.
 * Works for ALL users automatically — no per-user manual steps needed.
 *
 * How it works:
 *   1. For each user, get (or create) their per-user encryption key from MongoDB.
 *   2. For each of their wallets, try decrypting with the per-user key.
 *   3. If that fails AND ENCRYPTION_MASTER_KEY is set in .env, try the legacy key.
 *   4. If legacy succeeds, re-encrypt with the per-user key and save.
 *
 * This is the same auto-migration that runs in the execution worker,
 * but as a one-shot script you can run ahead of time to pre-fix everything.
 *
 * Usage:
 *   npx tsx src/scripts/re-encrypt-wallet.ts            # dry-run: list all wallets + status
 *   npx tsx src/scripts/re-encrypt-wallet.ts --fix      # auto-fix all wallets using ENCRYPTION_MASTER_KEY fallback
 */
import { loadEnv } from '../config/env.js';

loadEnv();

import mongoose from 'mongoose';
import { connectDb } from '../config/db.js';
import { getEnv } from '../config/env.js';
import { User } from '../models/User.js';
import { Wallet } from '../models/Wallet.js';
import { encryptPrivateKey, decryptPrivateKey } from '../utils/crypto.js';
import { getOrCreateUserEncryptionKey } from '../utils/userKey.js';

const FIX_MODE = process.argv.includes('--fix');

async function checkOrFix(): Promise<void> {
  const { ENCRYPTION_MASTER_KEY } = getEnv();
  const users = await User.find().lean();

  if (users.length === 0) {
    console.log('No users found.');
    return;
  }

  let totalOk = 0;
  let totalBroken = 0;
  let totalFixed = 0;
  let totalUnfixable = 0;

  for (const u of users) {
    const wallets = await Wallet.find({ createdBy: u._id }).select('+encryptedPrivateKey');
    if (wallets.length === 0) continue;

    const perUserKey = await getOrCreateUserEncryptionKey(u._id);

    console.log(`\nUser: ${u.email} (${String(u._id)})`);

    for (const w of wallets) {
      // 1. Try per-user key
      try {
        decryptPrivateKey(w.encryptedPrivateKey, perUserKey);
        console.log(`  OK      ${w.address}  [${w.label}]`);
        totalOk++;
        continue;
      } catch {
        // per-user key failed
      }

      // 2. Try legacy ENCRYPTION_MASTER_KEY
      if (!ENCRYPTION_MASTER_KEY) {
        console.log(`  BROKEN  ${w.address}  [${w.label}]  — no legacy key in .env to auto-fix`);
        totalBroken++;
        totalUnfixable++;
        continue;
      }

      try {
        const pk = decryptPrivateKey(w.encryptedPrivateKey, ENCRYPTION_MASTER_KEY);

        if (FIX_MODE) {
          w.encryptedPrivateKey = encryptPrivateKey(pk, perUserKey);
          await w.save();
          console.log(`  FIXED   ${w.address}  [${w.label}]  — re-encrypted with per-user key`);
          totalFixed++;
        } else {
          console.log(`  FIXABLE ${w.address}  [${w.label}]  — legacy key works, run with --fix to migrate`);
          totalBroken++;
        }
      } catch {
        console.log(`  BROKEN  ${w.address}  [${w.label}]  — both keys failed; wallet must be re-imported`);
        totalBroken++;
        totalUnfixable++;
      }
    }
  }

  console.log('\n─────────────────────────────────');
  console.log(`OK:         ${totalOk}`);
  if (FIX_MODE) {
    console.log(`Fixed:      ${totalFixed}`);
    console.log(`Unfixable:  ${totalUnfixable} (re-import these wallets manually)`);
  } else {
    console.log(`Fixable:    ${totalBroken - totalUnfixable} (run with --fix to auto-migrate)`);
    console.log(`Unfixable:  ${totalUnfixable} (re-import these wallets manually)`);
    if (totalBroken > 0) {
      console.log('\nRun:  npx tsx src/scripts/re-encrypt-wallet.ts --fix');
    }
  }
  console.log('─────────────────────────────────\n');
}

async function main(): Promise<void> {
  await connectDb();
  if (FIX_MODE) {
    console.log('MODE: Fix — re-encrypting all fixable wallets with per-user keys\n');
  } else {
    console.log('MODE: Dry-run — showing status only (add --fix to actually migrate)\n');
  }
  await checkOrFix();
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
