import { timingSafeEqual } from "node:crypto";
import type { ProcessIdentityRecord } from "./types.ts";

function receiptsEqual(left: string, right: string): boolean {
	const leftBytes = Buffer.from(left);
	const rightBytes = Buffer.from(right);
	return leftBytes.length === rightBytes.length && timingSafeEqual(leftBytes, rightBytes);
}

/**
 * Verify both PID and an independently observed process-start receipt.
 * PID equality alone is never sufficient because operating systems reuse PIDs.
 */
export function verifyProcessIdentity(
	expected: Readonly<ProcessIdentityRecord>,
	observed: Readonly<ProcessIdentityRecord> | undefined,
): boolean {
	return Boolean(
		observed &&
			Number.isSafeInteger(expected.pid) &&
			expected.pid > 0 &&
			Number.isSafeInteger(observed.pid) &&
			observed.pid > 0 &&
			expected.pid === observed.pid &&
			typeof expected.startReceipt === "string" &&
			expected.startReceipt.length > 0 &&
			typeof observed.startReceipt === "string" &&
			observed.startReceipt.length > 0 &&
			receiptsEqual(expected.startReceipt, observed.startReceipt),
	);
}
