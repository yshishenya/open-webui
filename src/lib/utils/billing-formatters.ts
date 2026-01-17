/**
 * Shared utility functions for billing-related formatting
 */

/**
 * Format a number in compact notation (K, M)
 * @param value - Number to format
 * @returns Formatted string
 */
export const formatCompactNumber = (value: number | null | undefined): string => {
	if (value === null || value === undefined) return '0';
	if (value >= 1000000) return (value / 1000000).toFixed(1) + 'M';
	if (value >= 1000) return (value / 1000).toFixed(1) + 'K';
	return value.toString();
};

/**
 * Calculate usage percentage
 * @param used - Amount used
 * @param limit - Quota limit
 * @returns Percentage (0-100)
 */
export const getUsagePercentage = (used: number, limit: number | null | undefined): number => {
	if (!limit || limit === 0) return 0;
	return Math.min(100, Math.round((used / limit) * 100));
};

/**
 * Get Tailwind CSS color class based on usage percentage
 * @param percentage - Usage percentage (0-100)
 * @returns Tailwind CSS class for background color
 */
export const getUsageColor = (percentage: number): string => {
	if (percentage >= 90) return 'bg-red-500';
	if (percentage >= 70) return 'bg-yellow-500';
	return 'bg-green-500';
};

/**
 * Get Tailwind CSS color class for subscription/payment status
 * @param status - Status string
 * @returns Tailwind CSS classes for badge styling
 */
export const getStatusColor = (status: string): string => {
	const colors: Record<string, string> = {
		active: 'bg-green-500/20 text-green-700 dark:text-green-300',
		trialing: 'bg-blue-500/20 text-blue-700 dark:text-blue-300',
		canceled: 'bg-red-500/20 text-red-700 dark:text-red-300',
		past_due: 'bg-orange-500/20 text-orange-700 dark:text-orange-300',
		pending: 'bg-yellow-500/20 text-yellow-700 dark:text-yellow-300',
		succeeded: 'bg-green-500/20 text-green-700 dark:text-green-300',
		failed: 'bg-red-500/20 text-red-700 dark:text-red-300'
	};
	return colors[status] || 'bg-gray-500/20 text-gray-700 dark:text-gray-300';
};

/**
 * Get Tailwind CSS text color class for subscription status
 * @param status - Status string
 * @returns Tailwind CSS classes for text color
 */
export const getStatusTextColor = (status: string): string => {
	const colors: Record<string, string> = {
		active: 'text-green-600 dark:text-green-400',
		trialing: 'text-blue-600 dark:text-blue-400',
		canceled: 'text-red-600 dark:text-red-400',
		past_due: 'text-orange-600 dark:text-orange-400',
		pending: 'text-yellow-600 dark:text-yellow-400'
	};
	return colors[status] || 'text-gray-500';
};

/**
 * Format quota value with infinity symbol for unlimited
 * @param value - Quota value or null for unlimited
 * @returns Formatted string
 */
export const formatQuotaValue = (value: number | null | undefined): string => {
	if (value === null || value === undefined) return '∞';
	return formatCompactNumber(value);
};

/**
 * Get human-readable label for usage metric
 * @param metric - Metric key (e.g., 'tokens_input')
 * @param i18nFn - i18n translation function
 * @returns Human-readable label
 */
export const getQuotaLabel = (
	metric: string,
	i18nFn: (key: string) => string = (k) => k
): string => {
	const labels: Record<string, string> = {
		tokens_input: i18nFn('Input tokens'),
		tokens_output: i18nFn('Output tokens'),
		requests: i18nFn('Requests'),
		images: i18nFn('Images'),
		audio_minutes: i18nFn('Audio minutes'),
		tts_seconds: i18nFn('TTS seconds'),
		stt_seconds: i18nFn('STT seconds')
	};
	return labels[metric] || metric.replace(/_/g, ' ');
};
