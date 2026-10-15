<script lang="ts">
	import { toast } from 'svelte-sonner';
	import { goto } from '$app/navigation';
	import { skills } from '$lib/stores';
	import { onMount, getContext } from 'svelte';

	const i18n = getContext<Readable<I18n>>('i18n');
	import type { Readable } from 'svelte/store';
	import type { i18n as I18n } from 'i18next';
	import type { SkillForm } from '$lib/apis/skills';

	import { createNewSkill, getSkills } from '$lib/apis/skills';
	import SkillEditor from '$lib/components/workspace/Skills/SkillEditor.svelte';

	let skill: SkillForm | null = null;

	let clone = false;

	const onSubmit = async (_skill: SkillForm): Promise<void> => {
		const res = await createNewSkill(localStorage.token, _skill).catch((error) => {
			toast.error(`${error}`);
			return null;
		});

		if (res) {
			toast.success($i18n.t('Skill created successfully'));
			await getSkills(localStorage.token)
				.then((items) => skills.set(items))
				.catch(() => toast.error($i18n.t('Could not load skills. Try again.')));
			await goto('/workspace/skills');
		}
	};

	onMount(async () => {
		if (sessionStorage.skill) {
			const _skill = JSON.parse(sessionStorage.skill);
			sessionStorage.removeItem('skill');

			clone = true;
			skill = {
				name: _skill.name || 'Skill',
				id: _skill.id || '',
				description: _skill.description || '',
				content: _skill.content || '',
				meta: _skill.meta,
				is_active: _skill.is_active ?? true,
				access_grants: _skill.access_grants !== undefined ? _skill.access_grants : []
			};
		}
	});
</script>

{#key skill}
	<SkillEditor {skill} {onSubmit} {clone} />
{/key}
