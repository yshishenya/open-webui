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
		{ href: '/terms', label: 'Условия использования' },
		{ href: '/privacy', label: 'Политика конфиденциальности' }
	];

	export let copyright: string = '2025 Open WebUI. Все права защищены.';
</script>

<div class="mt-16 pt-8 border-t border-gray-200">
	<div class="flex flex-wrap justify-center gap-6 text-sm text-gray-600">
		{#each links as link}
			<a href={link.href} class="hover:text-purple-600 transition-colors">{link.label}</a>
		{/each}
	</div>
	<div class="mt-6 text-sm text-gray-500">
		&copy; {copyright}
	</div>
</div>
