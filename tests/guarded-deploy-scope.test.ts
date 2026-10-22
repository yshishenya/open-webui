import { spawnSync, type SpawnSyncReturns } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it } from 'vitest';

const script = readFileSync('scripts/deploy_guarded.sh', 'utf8');
const remoteMarker = "<<'REMOTE'\n";
const remoteStart = script.indexOf(remoteMarker);
// Execute only setup and validation: no Docker, SSH connection, backup or deployment.
const remoteSetup = script.slice(remoteStart + remoteMarker.length).split('\nwait_for_health()')[0];
const runSetup = (project: string, composeFiles?: string): SpawnSyncReturns<string> => {
	const env: NodeJS.ProcessEnv = {
		...process.env,
		DEPLOY_ENV_FILE: '/dev/null',
		PROD_PATH: project,
		PROD_SSH_KEY: '',
		PROD_COMPOSE_FILES: composeFiles
	};
	if (composeFiles === undefined) delete env.PROD_COMPOSE_FILES;
	return spawnSync('bash', ['-s', '--', '--tag', 'approved-test', '--yes'], {
		env,
		encoding: 'utf8',
		input:
			String.raw`
ssh() {
  while [[ "$1" != bash ]]; do shift; done
  # Reproduce SSH's remote-shell argument joining without making a connection.
  command bash -c "$*"
}
` +
			script.slice(0, remoteStart) +
			remoteMarker +
			remoteSetup +
			'\nprintf "COMPOSE_ARGS\\n"\nprintf "%s\\0" "${compose[@]}"\nREMOTE\n'
	});
};

it('keeps deploy and rollback scoped to the application and writes private backups', () => {
	const recreations = script.split('\n').filter((line) => line.includes(' up -d '));
	expect(recreations).toHaveLength(2);
	for (const command of recreations) {
		expect(command).toContain('--no-deps --no-build --force-recreate airis');
		expect(command).not.toContain('--remove-orphans');
	}
	expect(script).toContain('umask 077');
	expect(script.indexOf('umask 077')).toBeLessThan(script.indexOf('mkdir -p "${backup_dir}"'));
	expect(script).not.toMatch(/\beval\b/);
	expect(script).toContain('"${compose[@]}" run --rm --no-deps');
});

it('preserves the two-file default and accepts an ordered three-file runtime overlay literally', () => {
	const project = mkdtempSync(join(tmpdir(), 'airis-compose-contract-'));
	try {
		for (const file of ['docker-compose.yaml', 'docker-compose.prod.yml']) {
			writeFileSync(join(project, file), 'services: {}\n');
		}
		const defaults = runSetup(project);
		expect(defaults.status, defaults.stderr).toBe(0);
		expect(defaults.stdout.split('COMPOSE_ARGS\n')[1]?.split('\0')).toEqual([
			'docker',
			'compose',
			'-f',
			'docker-compose.yaml',
			'-f',
			'docker-compose.prod.yml',
			''
		]);
		// Spaces, shell metacharacters and quotes must stay data across the SSH boundary.
		const overlay = join(project, "runtime analytics;$(exit 9) 'quoted'.yaml");
		writeFileSync(overlay, 'services: {}\n');
		const result = runSetup(project, `docker-compose.yaml:docker-compose.prod.yml:${overlay}`);
		expect(result.status, result.stderr).toBe(0);
		expect(result.stdout.split('COMPOSE_ARGS\n')[1]?.split('\0')).toEqual([
			'docker',
			'compose',
			'-f',
			'docker-compose.yaml',
			'-f',
			'docker-compose.prod.yml',
			'-f',
			overlay,
			''
		]);
	} finally {
		rmSync(project, { recursive: true, force: true });
	}
});

it.each(['', ':', ':file', 'file:', 'file::other', 'file\nother', 'file\rother'])(
	'rejects an empty or malformed operator list (%j) before SSH',
	(composeFiles) => {
		const result = runSetup(process.cwd(), composeFiles);
		expect(result.status).not.toBe(0);
		expect(result.stderr).toContain('PROD_COMPOSE_FILES must contain');
		expect(result.stdout).not.toContain('COMPOSE_ARGS');
	}
);

it('fails for a missing target file before any Docker or backup operation', () => {
	const project = mkdtempSync(join(tmpdir(), 'airis-compose-contract-'));
	try {
		const result = runSetup(project, 'missing-compose.yaml');
		expect(result.status).not.toBe(0);
		expect(result.stderr).toContain('Compose file not found: missing-compose.yaml');
		expect(result.stdout).not.toContain('COMPOSE_ARGS');
	} finally {
		rmSync(project, { recursive: true, force: true });
	}
});

it('also rejects an empty list in the remote Bash setup', () => {
	const result = spawnSync(
		'bash',
		['-s', '--', 'test', 'image', process.cwd(), '/unused', 'unused', '10', '1', ''],
		{
			input: remoteSetup,
			encoding: 'utf8'
		}
	);
	expect(result.status).not.toBe(0);
	expect(result.stderr).toContain('PROD_COMPOSE_FILES contains an empty or invalid entry');
});
