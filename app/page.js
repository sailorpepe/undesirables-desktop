import crypto from 'node:crypto';
import HomeClient from './HomeClient';

// Generates the ephemeral cryptographic signature shielding the desktop client structurally
const BOOT_TOKEN = global.__BOOT_TOKEN || (global.__BOOT_TOKEN = crypto.randomBytes(32).toString('hex'));

export default function Page() {
  return <HomeClient bootToken={BOOT_TOKEN} />;
}
