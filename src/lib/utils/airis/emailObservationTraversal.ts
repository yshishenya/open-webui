import {
	DiagnosticRequestError,
	type DiagnosticScope,
	type DiagnosticLease,
	type DiagnosticStart,
	type ObservationApi
} from '$lib/apis/airis/emailObservations';

/** One browser owns one sequential traversal; uncertain writes are reconciled by GET. */
export class DiagnosticTraversal {
	busy = false;
	stopping = false;
	error: 'busy' | 'unavailable' | 'conflict' | null = null;
	scope: DiagnosticScope | null = null;
	private lease: DiagnosticLease | null = null;
	private pendingStart: DiagnosticStart | null = null;
	private pendingScopeId: string | null = null;

	constructor(
		private api: ObservationApi,
		private changed: () => void,
		private newKey: () => string = () => crypto.randomUUID()
	) {}

	stop(): void {
		// A request already sent may still commit. Let it settle and retain its saved cursor.
		this.stopping = true;
		this.changed();
	}

	private adopt(scope: DiagnosticScope): void {
		this.scope = scope;
		this.changed();
	}

	async run(selected: DiagnosticScope): Promise<void> {
		if (this.busy || selected.closed_at !== null) return;
		this.busy = true;
		this.stopping = false;
		this.error = null;
		this.adopt(selected);
		try {
			await this.acquire(selected);
			while (
				!this.stopping &&
				this.scope?.closed_at === null &&
				this.scope.last_run?.status === 'running'
			) {
				const before = this.scope;
				const lease = this.lease;
				if (!lease?.claim_id || lease.run_id !== before.last_run?.id) {
					this.error = 'conflict';
					break;
				}
				try {
					const next = await this.api.page(before.id, {
						run_id: lease.run_id,
						claim_id: lease.claim_id,
						expected_cursor: before.last_run.cursor
					});
					if (
						next.last_run?.id !== lease.run_id ||
						next.last_run.cursor < before.last_run.cursor ||
						(next.last_run.status === 'running' && next.last_run.cursor === before.last_run.cursor)
					) {
						this.error = 'conflict';
						break;
					}
					this.adopt(next);
				} catch (error) {
					// An aborted/lost response is not evidence of rollback or of failure.
					const current = await this.api.read(before.id);
					this.adopt(current);
					if (
						current.last_run?.id === lease.run_id &&
						current.last_run.cursor > before.last_run.cursor
					) {
						continue;
					}
					if (error instanceof DiagnosticRequestError && error.status === 409) this.lease = null;
					this.error =
						error instanceof DiagnosticRequestError && error.status === 409
							? 'conflict'
							: 'unavailable';
					break;
				}
			}
		} catch (error) {
			this.error =
				error instanceof DiagnosticRequestError && error.code === 'busy' ? 'busy' : 'unavailable';
			try {
				this.adopt(await this.api.read(selected.id));
			} catch {
				// Keep the last observed state, explicitly marked unavailable.
				this.error = 'unavailable';
			}
		} finally {
			this.busy = false;
			this.changed();
		}
	}

	private async acquire(selected: DiagnosticScope): Promise<void> {
		if (
			this.lease?.scope.id === selected.id &&
			this.lease.run_id === selected.last_run?.id &&
			this.lease.claim_id &&
			selected.last_run.status === 'running' &&
			(selected.last_run.lease_until ?? 0) > Math.floor(Date.now() / 1000)
		)
			return;
		if (!this.pendingStart || this.pendingScopeId !== selected.id) {
			this.pendingStart = {
				request_key: this.newKey(),
				expected_run_id: selected.last_run?.id ?? null
			};
			this.pendingScopeId = selected.id;
		}
		try {
			const result = await this.api.start(selected.id, this.pendingStart);
			this.lease = result;
			this.pendingStart = null;
			this.adopt(result.scope);
			if (!result.claim_id && result.scope.last_run?.status === 'running') {
				throw new DiagnosticRequestError(409, 'busy');
			}
		} catch (error) {
			// Only explicit conflicts allow a new command after the state is reread.
			if (error instanceof DiagnosticRequestError && error.status === 409) this.pendingStart = null;
			throw error;
		}
	}
}
