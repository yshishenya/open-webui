<script lang="ts">
	import { toast } from 'svelte-sonner';
	import dayjs from 'dayjs';
	import { createEventDispatcher } from 'svelte';
	import { getContext } from 'svelte';

	import { goto } from '$app/navigation';

	import { updateUserById, getUserGroupsById } from '$lib/apis/users';
	import {
		getUserSubscription,
		getActivePlans,
		changeUserSubscription,
		type UserSubscriptionInfo,
		type Plan
	} from '$lib/apis/admin/billing';
	import {
		formatCompactNumber,
		getUsageColor,
		getStatusTextColor
	} from '$lib/utils/billing-formatters';

	import Modal from '$lib/components/common/Modal.svelte';
	import localizedFormat from 'dayjs/plugin/localizedFormat';
	import XMark from '$lib/components/icons/XMark.svelte';
	import SensitiveInput from '$lib/components/common/SensitiveInput.svelte';
	import UserProfileImage from '$lib/components/chat/Settings/Account/UserProfileImage.svelte';

	const i18n = getContext('i18n');
	const dispatch = createEventDispatcher();
	dayjs.extend(localizedFormat);

	// Types
	interface UserFormData {
		id?: string;
		profile_image_url: string;
		role: string;
		name: string;
		email: string;
		password: string;
		oauth?: Record<string, { sub: string }>;
		created_at?: number;
	}

	interface UserGroup {
		id: string;
		name: string;
	}

	// Props
	export let show = false;
	export let selectedUser: UserFormData | null = null;
	export let sessionUser: { id: string; role: string } | null = null;

	// Reactive initialization
	$: if (show && selectedUser) {
		init();
	}

	const init = async () => {
		if (selectedUser) {
			_user = { ...selectedUser, password: '' };
			// Load data in parallel for better performance
			await Promise.all([loadUserGroups(), loadUserSubscription(), loadAvailablePlans()]);
		}
	};

	// State
	let _user: UserFormData = {
		profile_image_url: '',
		role: 'pending',
		name: '',
		email: '',
		password: ''
	};

	let userGroups: UserGroup[] | null = null;
	let userSubscription: UserSubscriptionInfo | null = null;
	let subscriptionLoading = false;
	let plansLoading = false;
	let availablePlans: Plan[] = [];
	let selectedPlanId: string = '';
	let changingPlan = false;

	// Handlers
	const submitHandler = async () => {
		if (!selectedUser?.id) return;

		const res = await updateUserById(localStorage.token, selectedUser.id, _user).catch((error) => {
			toast.error(`${error}`);
			return null;
		});

		if (res) {
			dispatch('save');
			show = false;
		}
	};

	const loadUserGroups = async () => {
		if (!selectedUser?.id) return;
		userGroups = null;

		try {
			userGroups = await getUserGroupsById(localStorage.token, selectedUser.id);
		} catch (error) {
			console.error('Failed to load user groups:', error);
			toast.error($i18n.t('Failed to load user groups'));
			userGroups = [];
		}
	};

	const loadUserSubscription = async () => {
		if (!selectedUser?.id) return;
		subscriptionLoading = true;
		userSubscription = null;

		try {
			userSubscription = await getUserSubscription(localStorage.token, selectedUser.id);
			if (userSubscription?.plan) {
				selectedPlanId = userSubscription.plan.id;
			} else {
				selectedPlanId = '';
			}
		} catch (error) {
			console.error('Failed to load subscription:', error);
			toast.error($i18n.t('Failed to load subscription'));
		} finally {
			subscriptionLoading = false;
		}
	};

	const loadAvailablePlans = async () => {
		plansLoading = true;
		try {
			const plans = await getActivePlans(localStorage.token);
			if (plans) {
				availablePlans = plans;
			}
		} catch (error) {
			console.error('Failed to load plans:', error);
			toast.error($i18n.t('Failed to load plans'));
			availablePlans = [];
		} finally {
			plansLoading = false;
		}
	};

	const handleChangePlan = async () => {
		if (!selectedUser?.id) return;

		// Authorization check - only admins can change plans
		if (sessionUser?.role !== 'admin') {
			toast.error($i18n.t('Unauthorized: Admin access required'));
			return;
		}

		// If plan is cleared, don't save (for now we don't support removing subscription)
		if (!selectedPlanId) {
			// Restore previous plan selection if user clears
			if (userSubscription?.plan) {
				selectedPlanId = userSubscription.plan.id;
			}
			return;
		}

		// Don't save if plan hasn't changed
		if (userSubscription?.plan?.id === selectedPlanId) return;

		changingPlan = true;
		try {
			const result = await changeUserSubscription(localStorage.token, selectedUser.id, {
				plan_id: selectedPlanId,
				reset_usage: false
			});

			if (result?.success) {
				toast.success($i18n.t('Plan changed successfully'));
				await loadUserSubscription();
			}
		} catch (error: unknown) {
			const errorMessage =
				error instanceof Error ? error.message : String(error) || $i18n.t('Failed to change plan');
			toast.error(errorMessage);
			// Restore previous selection on error
			if (userSubscription?.plan) {
				selectedPlanId = userSubscription.plan.id;
			}
		} finally {
			changingPlan = false;
		}
	};
</script>

<Modal size="sm" bind:show>
	<div>
		<div class=" flex justify-between dark:text-gray-300 px-5 pt-4 pb-2">
			<div class=" text-lg font-medium self-center">{$i18n.t('Edit User')}</div>
			<button
				class="self-center"
				on:click={() => {
					show = false;
				}}
			>
				<XMark className={'size-5'} />
			</button>
		</div>

		<div class="flex flex-col md:flex-row w-full md:space-x-4 dark:text-gray-200">
			<div class=" flex flex-col w-full sm:flex-row sm:justify-center sm:space-x-6">
				<form
					class="flex flex-col w-full"
					on:submit|preventDefault={() => {
						submitHandler();
					}}
				>
					<div class=" px-5 pt-3 pb-5 w-full">
						<div class="flex self-center w-full">
							<div class=" self-start h-full mr-6">
								<UserProfileImage
									imageClassName="size-14"
									bind:profileImageUrl={_user.profile_image_url}
									user={_user}
								/>
							</div>

							<div class=" flex-1">
								<div class="overflow-hidden w-ful mb-2">
									<div class=" self-center capitalize font-medium truncate">
										{selectedUser?.name || ''}
									</div>

									<div class="text-xs text-gray-500">
										{$i18n.t('Created at')}
										{selectedUser?.created_at
											? dayjs(selectedUser.created_at * 1000).format('LL')
											: '-'}
									</div>
								</div>

								<div class=" flex flex-col space-y-1.5">
									{#if (userGroups ?? []).length > 0}
										<div class="flex flex-col w-full text-sm">
											<div class="mb-1 text-xs text-gray-500">{$i18n.t('User Groups')}</div>

											<div class="flex flex-wrap gap-1 my-0.5 -mx-1">
												{#each userGroups as userGroup}
													<span
														class="px-1.5 py-0.5 rounded-xl bg-gray-100 dark:bg-gray-850 text-xs"
													>
														<a
															href={'/admin/users/groups?id=' + userGroup.id}
															on:click|preventDefault={() =>
																goto('/admin/users/groups?id=' + userGroup.id)}
														>
															{userGroup.name}
														</a>
													</span>
												{/each}
											</div>
										</div>
									{/if}

									<!-- Subscription Plan -->
									<div class="flex flex-col w-full">
										<div class=" mb-1 text-xs text-gray-500">{$i18n.t('Subscription Plan')}</div>

										<div class="flex-1">
											<select
												class="w-full dark:bg-gray-900 text-sm bg-transparent outline-hidden"
												bind:value={selectedPlanId}
												disabled={changingPlan || plansLoading}
												on:change={handleChangePlan}
											>
												<option value="">{$i18n.t('No plan')}</option>
												{#each availablePlans as plan}
													<option value={plan.id}>
														{plan.name_ru || plan.name}{plan.price > 0
															? ` (${plan.price} ${plan.currency})`
															: ''}
													</option>
												{/each}
											</select>
										</div>

										{#if subscriptionLoading}
											<div class="text-xs text-gray-400 mt-1">{$i18n.t('Loading...')}</div>
										{:else if userSubscription?.subscription}
											<div class="text-xs text-gray-500 mt-1">
												{$i18n.t('Status')}:
												<span
													class={userSubscription.subscription.status === 'active'
														? 'text-green-600 dark:text-green-400'
														: 'text-gray-500'}>{userSubscription.subscription.status}</span
												>
												{#if userSubscription.subscription.current_period_end}
													· {$i18n.t('until')}
													{dayjs(userSubscription.subscription.current_period_end * 1000).format(
														'LL'
													)}
												{/if}
											</div>
											<!-- Usage -->
											{#if userSubscription.usage && Object.keys(userSubscription.usage).length > 0}
												<div class="flex flex-col gap-1 mt-2">
													{#each Object.entries(userSubscription.usage) as [metric, data]}
														{#if data.limit}
															<div class="text-xs">
																<div class="flex justify-between mb-0.5">
																	<span class="text-gray-600 dark:text-gray-400"
																		>{metric.replace('_', ' ')}</span
																	>
																	<span
																		>{formatCompactNumber(data.used)} / {formatCompactNumber(
																			data.limit
																		)}</span
																	>
																</div>
																<div
																	class="w-full h-1 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden"
																>
																	<div
																		class="h-full {getUsageColor(
																			data.percentage || 0
																		)} transition-all"
																		style="width: {Math.min(100, data.percentage || 0)}%"
																	></div>
																</div>
															</div>
														{/if}
													{/each}
												</div>
											{/if}
										{/if}
									</div>

									<div class="flex flex-col w-full">
										<div class=" mb-1 text-xs text-gray-500">{$i18n.t('Role')}</div>

										<div class="flex-1">
											<select
												class="w-full dark:bg-gray-900 text-sm bg-transparent disabled:text-gray-500 dark:disabled:text-gray-500 outline-hidden"
												bind:value={_user.role}
												disabled={_user.id == sessionUser.id}
												required
											>
												<option value="admin">{$i18n.t('Admin')}</option>
												<option value="user">{$i18n.t('User')}</option>
												<option value="pending">{$i18n.t('Pending')}</option>
											</select>
										</div>
									</div>

									<div class="flex flex-col w-full">
										<div class=" mb-1 text-xs text-gray-500">{$i18n.t('Name')}</div>

										<div class="flex-1">
											<input
												class="w-full text-sm bg-transparent outline-hidden"
												type="text"
												bind:value={_user.name}
												placeholder={$i18n.t('Enter Your Name')}
												autocomplete="off"
												required
											/>
										</div>
									</div>

									<div class="flex flex-col w-full">
										<div class=" mb-1 text-xs text-gray-500">{$i18n.t('Email')}</div>

										<div class="flex-1">
											<input
												class="w-full text-sm bg-transparent disabled:text-gray-500 dark:disabled:text-gray-500 outline-hidden"
												type="email"
												bind:value={_user.email}
												placeholder={$i18n.t('Enter Your Email')}
												autocomplete="off"
												required
											/>
										</div>
									</div>

									{#if _user?.oauth}
										<div class="flex flex-col w-full">
											<div class=" mb-1 text-xs text-gray-500">{$i18n.t('OAuth ID')}</div>

											<div class="flex-1 text-sm break-all mb-1 flex flex-col space-y-1">
												{#each Object.keys(_user.oauth) as key}
													<div>
														<span class="text-gray-500">{key}</span>
														<span class="">{_user.oauth[key]?.sub}</span>
													</div>
												{/each}
											</div>
										</div>
									{/if}

									<div class="flex flex-col w-full">
										<div class=" mb-1 text-xs text-gray-500">{$i18n.t('New Password')}</div>

										<div class="flex-1">
											<SensitiveInput
												class="w-full text-sm bg-transparent outline-hidden"
												type="password"
												placeholder={$i18n.t('Enter New Password')}
												bind:value={_user.password}
												autocomplete="new-password"
												required={false}
											/>
										</div>
									</div>
								</div>
							</div>
						</div>

						<div class="flex justify-end pt-3 text-sm font-medium">
							<button
								class="px-3.5 py-1.5 text-sm font-medium bg-black hover:bg-gray-900 text-white dark:bg-white dark:text-black dark:hover:bg-gray-100 transition rounded-full flex flex-row space-x-1 items-center"
								type="submit"
							>
								{$i18n.t('Save')}
							</button>
						</div>
					</div>
				</form>
			</div>
		</div>
	</div>
</Modal>

<style>
	input::-webkit-outer-spin-button,
	input::-webkit-inner-spin-button {
		/* display: none; <- Crashes Chrome on hover */
		-webkit-appearance: none;
		margin: 0; /* <-- Apparently some margin are still there even though it's hidden */
	}

	.tabs::-webkit-scrollbar {
		display: none; /* for Chrome, Safari and Opera */
	}

	.tabs {
		-ms-overflow-style: none; /* IE and Edge */
		scrollbar-width: none; /* Firefox */
	}

	input[type='number'] {
		-moz-appearance: textfield; /* Firefox */
	}
</style>
