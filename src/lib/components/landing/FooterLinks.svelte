<script lang="ts">
	interface FooterLink {
		href: string;
		label: string;
	}

	export let links: FooterLink[] = [
		{ href: '/about', label: 'О нас' },
		{ href: '/pricing', label: 'Тарифы' },
		{ href: '/features', label: 'Возможности' },
		{ href: '/contact', label: 'Контакты' },
		{ href: '/documents', label: 'Документы' },
		{ href: '/terms', label: 'Оферта' },
		{ href: '/privacy', label: 'Политика конфиденциальности' }
	];

	export let copyright: string = '2025 AIris. Все права защищены.';
</script>

<div class="mt-16 pt-8 border-t border-gray-200/70 text-gray-500">
	<div class="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
		<div class="flex flex-wrap gap-4 text-sm">
			{#each links as link}
				<a href={link.href} class="hover:text-gray-900 transition-colors">{link.label}</a>
			{/each}
		</div>
		<div class="text-sm">&copy; {copyright}</div>
	</div>
	<div class="mt-6 text-xs leading-relaxed">
		<div class="font-semibold text-gray-600">Реквизиты</div>
		<div>ИП Шишеня Ян Александрович</div>
		<div>ИНН 667803118920 · ОГРНИП 320665800036109</div>
	</div>
</div>
