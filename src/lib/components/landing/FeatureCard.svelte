<script lang="ts">
	export let title: string;
	export let description: string;
	export let iconColor: 'purple' | 'blue' | 'green' = 'purple';
</script>

<div class="bg-white rounded-2xl border border-gray-200/70 p-6 shadow-sm hover:shadow-md transition-shadow">
	<div class="w-12 h-12 bg-gray-100 rounded-xl flex items-center justify-center mb-4 mx-auto border border-gray-200">
		<slot name="icon">
			<!-- Default icon slot -->
		</slot>
	</div>
	<h3 class="text-lg font-semibold text-gray-900 mb-2">
		{title}
	</h3>
	<p class="text-gray-600 text-sm">
		{description}
	</p>
</div>
