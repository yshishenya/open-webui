<script lang="ts">
	interface FooterLink {
		href: string;
		label: string;
	}

	export let links: FooterLink[] = [
		{ href: '/about', label: 'О проекте' },
		{ href: '/pricing', label: 'Тарифы' },
		{ href: '/features', label: 'Возможности' },
		{ href: '/contact', label: 'Контакты' },
		{ href: '/documents', label: 'Документы' },
		{ href: '/terms', label: 'Оферта' },
		{ href: '/privacy', label: 'Политика конфиденциальности' }
	];

	export let copyright: string = `${new Date().getFullYear()} Airis. Все права защищены.`;
	export let tone: 'light' | 'dark' = 'light';
</script>

<div
	class:footer-dark={tone === 'dark'}
	class="footer-links airis-public-footer-links mt-16 pt-8 border-t"
>
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
