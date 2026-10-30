<script lang="ts">
	import { toast } from 'svelte-sonner';
	import { skills, user, config } from '$lib/stores';
	import { COMMUNITY_ORIGINS } from '$lib/constants';
	import { onMount, getContext } from 'svelte';

	const i18n = getContext<Readable<I18n>>('i18n');
	import type { Readable } from 'svelte/store';
	import type { i18n as I18n } from 'i18next';
	import type { SkillForm } from '$lib/apis/skills';

	import { createNewSkill, getSkills } from '$lib/apis/skills';
	import SkillEditor from '$lib/components/workspace/Skills/SkillEditor.svelte';

	let skill: SkillForm | null = null;

	let clone = false;

	const onSubmit = async (_skill: SkillForm) => {
		const res = await createNewSkill(localStorage.token, _skill);

		if (res) {
			toast.success($i18n.t('Skill created successfully'));
			await getSkills(localStorage.token)
				.then((items) => skills.set(items))
				.catch(() => toast.error($i18n.t('Could not load skills. Try again.')));
			return res;
		}
	};

	onMount(() => {
		const receiveSkill = (event: MessageEvent) => {
			if (!COMMUNITY_ORIGINS.includes(event.origin) || event.source !== window.opener) return;
			if (
				!$config?.features?.enable_community_sharing ||
				($user?.role !== 'admin' && !$user?.permissions?.workspace?.skills_import)
			)
				return;
			try {
				const data = JSON.parse(event.data);
				if (
					!Array.isArray(data.files) ||
					typeof data.id !== 'string' ||
					typeof data.name !== 'string'
				)
					throw new Error('Invalid skill JSON');
				skill = {
					id: data.id,
					name: data.name,
					description: data.description ?? '',
					files: data.files,
					content:
						data.files.find((file: { path: string }) => file.path === 'SKILL.md')?.content ?? '',
					is_active: true,
					access_grants: []
				};
				window.removeEventListener('message', receiveSkill);
			} catch (error) {
				toast.error(error instanceof Error ? error.message : 'Invalid skill JSON');
			}
		};
		window.addEventListener('message', receiveSkill);
		if (window.opener) window.opener.postMessage('loaded', '*');

		if (sessionStorage.skill) {
			const _skill = JSON.parse(sessionStorage.skill);
			sessionStorage.removeItem('skill');

			clone = true;
			skill = {
				name: _skill.name || 'Skill',
				id: _skill.id || '',
				description: _skill.description || '',
				content: _skill.content || '',
				files: _skill.files,
				meta: _skill.meta ?? {},
				is_active: _skill.is_active ?? true,
				access_grants: _skill.access_grants !== undefined ? _skill.access_grants : []
			};
		}
		return () => window.removeEventListener('message', receiveSkill);
	});
</script>

{#key skill}
	<SkillEditor {skill} {onSubmit} {clone} />
{/key}
