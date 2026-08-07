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
	<div class="grid gap-8 md:grid-cols-[1.2fr_1fr_1fr]">
		<div>
			<a href="/welcome" class="text-lg font-semibold text-inherit">Airis</a>
			<p class="mt-2 max-w-xs text-sm leading-relaxed">AI-модели без VPN — в одном чате.</p>
		</div>
		<div>
			<div class="airis-public-footer-heading">Продукт</div>
			<div class="mt-3 flex flex-col items-start gap-2 text-sm">
				{#each links.filter((link) => ['/features', '/pricing'].includes(link.href)) as link}
					<a href={link.href}>{link.label}</a>
				{/each}
			</div>
		</div>
		<div>
			<div class="airis-public-footer-heading">Компания и документы</div>
			<div class="mt-3 flex flex-col items-start gap-2 text-sm">
				{#each links.filter((link) => !['/features', '/pricing'].includes(link.href)) as link}
					<a href={link.href}>{link.label}</a>
				{/each}
			</div>
		</div>
	</div>
	<div
		class="mt-8 flex flex-col gap-2 border-t border-inherit pt-5 text-xs leading-relaxed md:flex-row md:items-end md:justify-between"
	>
		<div>
			<div>ИП Шишеня Ян Александрович · ИНН 667803118920 · ОГРНИП 320665800036109</div>
			<div>&copy; {copyright}</div>
		</div>
	</div>
</div>
