import assert from "node:assert/strict";
import { describe, test } from "node:test";
import type {
	AgentSessionEvent,
	RpcExtensionUIRequest,
	RpcExtensionUIResponse,
	RpcResponse,
} from "@reitaard/repi-coding-agent";
import { MaestroDashboard } from "../src/dashboard.ts";
import type {
	MaestroDashboardAttachment,
	MaestroDashboardClient,
	MaestroDashboardSnapshot,
} from "../src/dashboard-client.ts";
import type { InstanceSummary } from "../src/ipc/protocol.ts";

function flush(): Promise<void> {
	return new Promise((resolve) => setImmediate(resolve));
}

function createInstance(): InstanceSummary {
	return {
		id: "instance-12345678",
		label: "Release audit",
		status: "waiting-input",
		lifecycleState: "WAITING_INPUT",
		stateConsistent: true,
		cwd: "/workspace/recode",
		createdAt: "2026-07-29T00:00:00.000Z",
		lastSeenAt: "2026-07-29T00:01:00.000Z",
		workspace: {
			access: "read-only",
			worktreeRoot: "/workspace/recode",
			branch: "agent-harness",
			worktreeIdentity: "c".repeat(64),
		},
		currentActivity: "Reviewing service ownership",
		activityUpdatedAt: "2026-07-29T00:01:00.000Z",
		pendingInput: true,
		latestOutput: "Found one lifecycle edge case",
	};
}

function createSnapshot(instance: InstanceSummary): MaestroDashboardSnapshot {
	return {
		health: {
			schemaVersion: 1,
			serviceId: "service-1",
			state: "ready",
			ready: true,
			acceptingRequests: true,
			supervisionMode: "systemd",
			processIdentity: { pid: 123, startReceipt: "a".repeat(64) },
			startedAt: "2026-07-29T00:00:00.000Z",
			updatedAt: "2026-07-29T00:01:00.000Z",
			endpoint: "/tmp/maestro.sock",
			liveInstances: 1,
			waitingInput: 1,
			adapters: { radius: "ready" },
			restartLoopDetected: false,
			restartDiagnostics: [],
		},
		instances: [instance],
	};
}

class FakeDashboardClient implements MaestroDashboardClient {
	private readonly snapshot: MaestroDashboardSnapshot;
	readonly sent: Array<RpcExtensionUIResponse | { type: string }> = [];
	stopped: string[] = [];
	cancelled: string[] = [];
	closed = false;
	onUiRequest: ((request: RpcExtensionUIRequest) => void) | undefined;

	constructor(snapshot: MaestroDashboardSnapshot) {
		this.snapshot = snapshot;
	}

	async refresh(): Promise<MaestroDashboardSnapshot> {
		return this.snapshot;
	}

	async attach(
		_instanceId: string,
		onEvent: (event: AgentSessionEvent) => void,
		onUiRequest: (request: RpcExtensionUIRequest) => void,
		_onResponse: (response: RpcResponse) => void,
		_onClose: (error?: Error) => void,
	): Promise<MaestroDashboardAttachment> {
		this.onUiRequest = onUiRequest;
		void onEvent;
		return {
			ownerId: "dashboard:test",
			ownerGeneration: 1,
			replay: { events: [] },
			send: (command) => this.sent.push(command),
			close: () => {
				this.closed = true;
			},
		};
	}

	async cancel(instanceId: string): Promise<void> {
		this.cancelled.push(instanceId);
	}

	async stop(instanceId: string): Promise<void> {
		this.stopped.push(instanceId);
	}
}

describe("Maestro dashboard", () => {
	test("renders bounded health, workspace, activity, input, and latest-output state", async () => {
		const instance = createInstance();
		const client = new FakeDashboardClient(createSnapshot(instance));
		const dashboard = new MaestroDashboard({
			client,
			requestRender() {},
			onQuit() {},
			now: () => Date.parse("2026-07-29T00:02:00.000Z"),
		});
		await dashboard.refresh();
		const rendered = dashboard.render(120).join("\n");
		assert.match(rendered, /RECODE/);
		assert.match(rendered, /MAESTRO/);
		assert.match(rendered, /Release audit/);
		assert.match(rendered, /agent-harness/);
		assert.match(rendered, /Reviewing service ownership/);
		assert.match(rendered, /Found one lifecycle edge case/);
		assert.match(rendered, /INPUT/);
	});

	test("detaches non-destructively and requires a double stop confirmation", async () => {
		const instance = createInstance();
		const client = new FakeDashboardClient(createSnapshot(instance));
		let now = Date.parse("2026-07-29T00:02:00.000Z");
		const dashboard = new MaestroDashboard({ client, requestRender() {}, onQuit() {}, now: () => now });
		await dashboard.refresh();
		dashboard.handleInput("a");
		await flush();
		assert.match(dashboard.render(120).join("\n"), /ATTACHED/);
		dashboard.handleInput("d");
		assert.equal(client.closed, true);
		assert.deepEqual(client.stopped, []);

		dashboard.handleInput("s");
		await flush();
		assert.deepEqual(client.stopped, []);
		now += 100;
		dashboard.handleInput("s");
		await flush();
		assert.deepEqual(client.stopped, [instance.id]);
	});

	test("surfaces pending extension input through the interactive attachment", async () => {
		const client = new FakeDashboardClient(createSnapshot(createInstance()));
		const dashboard = new MaestroDashboard({ client, requestRender() {}, onQuit() {} });
		await dashboard.refresh();
		dashboard.handleInput("a");
		await flush();
		client.onUiRequest?.({
			type: "extension_ui_request",
			id: "confirm-1",
			method: "confirm",
			title: "Approve change",
			message: "Continue with the reviewed service update?",
		});
		assert.match(dashboard.render(100).join("\n"), /INPUT REQUIRED/);
		dashboard.handleInput("y");
		assert.deepEqual(client.sent.at(-1), { type: "extension_ui_response", id: "confirm-1", confirmed: true });
	});
});
