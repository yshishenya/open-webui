<script lang="ts">
	import { toast } from 'svelte-sonner';
	import { goto } from '$app/navigation';
	import { skills } from '$lib/stores';
	import { onMount, getContext } from 'svelte';

	const i18n = getContext<Readable<I18n>>('i18n');
	import type { Readable } from 'svelte/store';
	import type { i18n as I18n } from 'i18next';
	import type { SkillForm } from '$lib/apis/skills';

	import { getSkillById, getSkills, updateSkillById } from '$lib/apis/skills';
	import { page } from '$app/stores';

	import SkillEditor from '$lib/components/workspace/Skills/SkillEditor.svelte';

	let skill: SkillForm | null = null;
	let disabled = false;

	$: skillId = $page.url.searchParams.get('id');

	const onSubmit = async (_skill: SkillForm): Promise<import('$lib/apis/skills').SkillRecord | null | undefined> => {
		if (!skillId) return;
		const updatedSkill = await updateSkillById(localStorage.token, skillId, _skill).catch(
			(error) => {
				toast.error(`${error}`);
				return null;
			}
		);

		if (updatedSkill) {
			toast.success($i18n.t('Skill updated successfully'));
			await getSkills(localStorage.token)
				.then((items) => skills.set(items))
				.catch(() => toast.error($i18n.t('Could not load skills. Try again.')));
			skill = updatedSkill;
		}
		return updatedSkill;
	};

	onMount(async () => {
		if (skillId) {
			const _skill = await getSkillById(localStorage.token, skillId).catch((error) => {
				toast.error(`${error}`);
				return null;
			});

			if (_skill) {
				disabled = !(_skill.write_access ?? false);
				skill = _skill;
			} else {
				goto('/workspace/skills');
			}
		} else {
			goto('/workspace/skills');
		}
	});
</script>

{#if skill}
	<SkillEditor {skill} {onSubmit} {disabled} edit />
{/if}
