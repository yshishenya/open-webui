<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	
	let tempSession = '';
	let name = '';
	let email = '';
	let termsAccepted = false;
	let loading = false;
	let error = '';
	
	onMount(() => {
		tempSession = sessionStorage.getItem('telegram_temp_session') || '';
		name = sessionStorage.getItem('telegram_name') || '';
		
		if (!tempSession) {
			goto('/');
		}
	});
	
	const handleSubmit = async () => {
		if (!email) {
			error = 'Пожалуйста, введите email';
			return;
		}
		
		if (!termsAccepted) {
			error = 'Необходимо принять условия использования';
			return;
		}
		
		loading = true;
		error = '';
		
		try {
			const response = await fetch('/api/v1/oauth/telegram/complete-profile', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					temp_session: tempSession,
					email: email,
					terms_accepted: termsAccepted
				})
			});
			
			if (!response.ok) {
				const data = await response.json();
				throw new Error(data.detail || 'Ошибка регистрации');
			}
			
			const data = await response.json();
			
			// Save token
			localStorage.setItem('token', data.token);
			
			// Clear session storage
			sessionStorage.removeItem('telegram_temp_session');
			sessionStorage.removeItem('telegram_name');
			
			// Redirect to home
			goto('/home');
		} catch (err: any) {
			error = err.message || 'Произошла ошибка';
		} finally {
			loading = false;
		}
	};
</script>

<svelte:head>
	<title>Завершение регистрации - Open WebUI</title>
</svelte:head>

<div class="min-h-screen bg-gradient-to-br from-purple-50 via-white to-blue-50 flex items-center justify-center p-4">
	<div class="max-w-md w-full">
		<div class="bg-white rounded-2xl shadow-xl p-8">
			<!-- Header -->
			<div class="text-center mb-8">
				<div class="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
					<svg class="w-8 h-8 text-blue-600" fill="currentColor" viewBox="0 0 24 24">
						<path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.894 8.221l-1.97 9.28c-.145.658-.537.818-1.084.508l-3-2.21-1.446 1.394c-.14.18-.357.295-.6.295-.002 0-.003 0-.005 0l.213-3.054 5.56-5.022c.24-.213-.054-.334-.373-.121L7.48 13.83l-2.97-.924c-.64-.203-.658-.64.135-.954l11.566-4.458c.538-.196 1.006.128.832.941z"/>
					</svg>
				</div>
				<h1 class="text-2xl font-bold text-gray-900 mb-2">
					Привет, {name}!
				</h1>
				<p class="text-gray-600">
					Для завершения регистрации укажите ваш email
				</p>
			</div>

			<!-- Form -->
			<form on:submit|preventDefault={handleSubmit} class="space-y-4">
				<!-- Email Input -->
				<div>
					<label for="email" class="block text-sm font-medium text-gray-700 mb-1">
						Email адрес
					</label>
					<input
						type="email"
						id="email"
						bind:value={email}
						required
						placeholder="your@email.com"
						class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition-all"
					/>
					<p class="mt-1 text-xs text-gray-500">
						На этот адрес будет отправлено письмо для подтверждения
					</p>
				</div>

				<!-- Terms Checkbox -->
				<div class="flex items-start">
					<input
						type="checkbox"
						id="terms"
						bind:checked={termsAccepted}
						required
						class="mt-1 w-4 h-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
					/>
					<label for="terms" class="ml-2 text-sm text-gray-700">
						Я принимаю <a href="/terms" class="text-purple-600 hover:underline" target="_blank">условия использования</a>
						и <a href="/privacy" class="text-purple-600 hover:underline" target="_blank">политику конфиденциальности</a>
					</label>
				</div>

				<!-- Error Message -->
				{#if error}
					<div class="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
						{error}
					</div>
				{/if}

				<!-- Submit Button -->
				<button
					type="submit"
					disabled={loading || !email || !termsAccepted}
					class="w-full bg-gradient-to-r from-purple-600 to-blue-600 text-white py-3 px-4 rounded-lg font-semibold hover:from-purple-700 hover:to-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-md hover:shadow-lg"
				>
					{loading ? 'Регистрация...' : 'Завершить регистрацию'}
				</button>
			</form>

			<!-- Info -->
			<div class="mt-6 p-4 bg-blue-50 rounded-lg">
				<div class="flex gap-3">
					<svg class="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
					</svg>
					<p class="text-sm text-blue-800">
						После регистрации на ваш email будет отправлено письмо для подтверждения адреса. 
						Проверьте папку "Спам", если письмо не пришло в течение нескольких минут.
					</p>
				</div>
			</div>
		</div>
	</div>
</div>
