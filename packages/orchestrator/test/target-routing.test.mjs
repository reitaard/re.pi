import assert from "node:assert/strict";
import test from "node:test";

import {
	dispatchPhase4ATarget,
	parseOrchestratorTarget,
	resolvePhase4ATarget,
	TargetRoutingError,
} from "../src/target-routing.ts";

function assertRoutingError(error, code) {
	assert.ok(error instanceof TargetRoutingError);
	assert.equal(error.code, code);
	return true;
}

test("omitted target preserves the existing local route", async () => {
	const command = { type: "get_state" };
	let calls = 0;
	const result = await dispatchPhase4ATarget(undefined, async () => {
		calls += 1;
		return command;
	});

	assert.equal(calls, 1);
	assert.equal(result, command);
	assert.deepEqual(parseOrchestratorTarget(undefined), {
		target: { kind: "local" },
		explicit: false,
	});
});

test("explicit local target reaches the same unchanged inner command", async () => {
	const command = { type: "prompt", message: "use the registered browser tool" };
	let forwarded;
	const result = await dispatchPhase4ATarget({ kind: "local" }, () => {
		forwarded = command;
		return { ok: true };
	});

	assert.equal(forwarded, command);
	assert.deepEqual(result, { ok: true });
	assert.deepEqual(resolvePhase4ATarget({ kind: "local" }), {
		target: { kind: "local" },
		explicit: true,
	});
});

test("node and sandbox targets fail before local execution", async () => {
	for (const target of [{ kind: "node", nodeId: "node-1" }, { kind: "sandbox" }]) {
		let called = false;
		await assert.rejects(
			dispatchPhase4ATarget(target, () => {
				called = true;
				return undefined;
			}),
			(error) => assertRoutingError(error, "target_not_authorized"),
		);
		assert.equal(called, false);
	}
});

test("target validation rejects malformed, secret-bearing, and scheduler-only fields", async () => {
	const invalidTargets = [
		"local",
		null,
		{},
		{ kind: "remote" },
		{ kind: "local", endpoint: "http://127.0.0.1:9000" },
		{ kind: "local", token: "secret" },
		{ kind: "node" },
		{ kind: "node", nodeId: "node-1", schedulerPolicy: "fastest" },
		{ kind: "node", nodeId: "https://node.invalid" },
		{ kind: "sandbox", image: "private/image" },
	];

	for (const target of invalidTargets) {
		let called = false;
		await assert.rejects(
			dispatchPhase4ATarget(target, () => {
				called = true;
				return undefined;
			}),
			(error) => assertRoutingError(error, "target_invalid"),
		);
		assert.equal(called, false);
	}
});

test("node identifiers are bounded and credential-free", () => {
	assert.deepEqual(parseOrchestratorTarget({ kind: "node", nodeId: "node.prod_1:browser" }), {
		target: { kind: "node", nodeId: "node.prod_1:browser" },
		explicit: true,
	});
	assert.throws(
		() => parseOrchestratorTarget({ kind: "node", nodeId: `n${"x".repeat(128)}` }),
		(error) => assertRoutingError(error, "target_invalid"),
	);
	assert.throws(
		() => parseOrchestratorTarget({ kind: "node", nodeId: "user:password@node" }),
		(error) => assertRoutingError(error, "target_invalid"),
	);
});
