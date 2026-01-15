<script lang="ts">
	export let title: string;
	export let description: string;
	export let iconColor: 'purple' | 'blue' | 'green' = 'purple';
</script>

<div class="bg-white rounded-xl p-6 shadow-md hover:shadow-lg transition-shadow">
	<div class="w-12 h-12 bg-{iconColor}-100 rounded-lg flex items-center justify-center mb-4 mx-auto">
		<slot name="icon">
			<!-- Default icon slot -->
		</slot>
	</div>
	<h3 class="text-lg font-semibold text-gray-800 mb-2">
		{title}
	</h3>
	<p class="text-gray-600 text-sm">
		{description}
	</p>
</div>

<style>
	.bg-purple-100 { background-color: rgb(243 232 255); }
	.bg-blue-100 { background-color: rgb(219 234 254); }
	.bg-green-100 { background-color: rgb(220 252 231); }
</style>
